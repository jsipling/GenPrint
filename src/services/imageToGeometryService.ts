import { GoogleGenAI } from '@google/genai'
import type {
  ImageToGeometryService,
  ImageToGeometryRequest,
  ImageToGeometryResponse,
  GeometryAnalysis
} from './imageToGeometryTypes'
import { BUILDER_RESERVED_CONSTANTS } from '../generators/manifold/printingConstants'
import { compressSketchImage, parseDataUrl } from '../utils/imageCompression'
import MANIFOLD_PROMPT_TEMPLATE from '../prompts/manifoldBuilder.prompt.md?raw'
import OPENSCAD_PROMPT_TEMPLATE from '../prompts/openscadBuilder.prompt.md?raw'
import {
  transpileOpenSCAD,
  OpenSCADParseError,
  OpenSCADTranspileError,
  OpenSCADLexError
} from '../openscad'

/**
 * Output format for geometry generation.
 * - 'manifold': AI generates Manifold JavaScript directly
 * - 'openscad': AI generates OpenSCAD code which is transpiled to Manifold JS
 */
export type OutputFormat = 'manifold' | 'openscad'

// Build the list of all reserved variable names for builder code
// These are passed as function parameters and must not be redeclared
const RESERVED_VARIABLES = ['M', 'params', ...BUILDER_RESERVED_CONSTANTS] as const

// Build the Manifold analysis prompt from the template
const MANIFOLD_ANALYSIS_PROMPT = MANIFOLD_PROMPT_TEMPLATE
  .replace('{{RESERVED_VARIABLES_LIST}}', RESERVED_VARIABLES.map(v => `- \`${v}\``).join('\n'))
  .replace('{{RESERVED_VARIABLES_CONST_LIST}}', RESERVED_VARIABLES.map(v => `\`const ${v}\``).join(', '))

// OpenSCAD prompt doesn't need reserved variables substitution
const OPENSCAD_ANALYSIS_PROMPT = OPENSCAD_PROMPT_TEMPLATE

/**
 * Build current model context string for the prompt.
 */
function buildCurrentModelContext(request: ImageToGeometryRequest): string {
  if (!request.currentBuilderCode || !request.currentModelName) {
    return ''
  }

  return `
## Current Model Context

Current model: "${request.currentModelName}"
Current parameters: ${JSON.stringify(request.currentParams ?? {})}

**IMPORTANT:** Always preserve existing parts as separate items to maintain hover highlighting. Add new features as additional parts in the array.

\`\`\`javascript
// Build the existing model (returns array of parts)
const existingParts = (function() { ${request.currentBuilderCode} })();

// Create your new geometry
const newFeature = M.Manifold.cube([10, 10, 5], true).translate([0, 0, 25]);

// Return all existing parts PLUS the new one as a separate part
return [
  ...existingParts,
  { name: 'New Feature', manifold: newFeature }
];
\`\`\`

Do NOT merge parts together unless the user explicitly asks to combine/merge/fuse them into one piece.

`
}

/**
 * OpenSCAD analysis response from AI (before transpilation).
 */
interface OpenSCADAnalysis {
  description: string
  openscadCode: string
  suggestedName: string
  parameters: GeometryAnalysis['parameters']
  defaultParams: GeometryAnalysis['defaultParams']
}

/**
 * Validate that the analysis response contains all required fields for Manifold format.
 */
function validateManifoldAnalysis(data: unknown): data is GeometryAnalysis {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const obj = data as Record<string, unknown>

  // Check required string fields
  if (typeof obj.description !== 'string' || !obj.description) {
    return false
  }
  if (typeof obj.builderCode !== 'string' || !obj.builderCode) {
    return false
  }
  if (typeof obj.suggestedName !== 'string' || !obj.suggestedName) {
    return false
  }

  // Check parameters array
  if (!Array.isArray(obj.parameters)) {
    return false
  }

  // Check defaultParams object
  if (typeof obj.defaultParams !== 'object' || obj.defaultParams === null) {
    return false
  }

  return true
}

/**
 * Validate that the analysis response contains all required fields for OpenSCAD format.
 */
function validateOpenSCADAnalysis(data: unknown): data is OpenSCADAnalysis {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const obj = data as Record<string, unknown>

  // Check required string fields
  if (typeof obj.description !== 'string' || !obj.description) {
    return false
  }
  if (typeof obj.openscadCode !== 'string' || !obj.openscadCode) {
    return false
  }
  if (typeof obj.suggestedName !== 'string' || !obj.suggestedName) {
    return false
  }

  // Check parameters array
  if (!Array.isArray(obj.parameters)) {
    return false
  }

  // Check defaultParams object
  if (typeof obj.defaultParams !== 'object' || obj.defaultParams === null) {
    return false
  }

  return true
}

/**
 * Extract JSON from response text, handling potential markdown code blocks.
 */
function extractJson(text: string): string {
  // Try to extract JSON from markdown code block if present
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonBlockMatch) {
    return jsonBlockMatch[1]?.trim() ?? text
  }

  // Otherwise return trimmed text
  return text.trim()
}

/**
 * Validate that the generated builder code is syntactically valid JavaScript.
 * Uses the same function signature as the Manifold worker.
 */
function validateBuilderCode(code: string): { valid: boolean; error?: string } {
  try {
    // Try to create a function from the code to check for syntax errors
    // Must match the worker's function signature: new Function('M', ...BUILDER_RESERVED_CONSTANTS, 'params', code)
    new Function('M', ...BUILDER_RESERVED_CONSTANTS, 'params', code)
    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown syntax error'
    }
  }
}

/**
 * Build error context string for retry prompts.
 */
function buildErrorContext(previousError: string | undefined): string {
  if (!previousError) {
    return ''
  }

  return `
## IMPORTANT: Previous Attempt Failed

Your previous code had this error: "${previousError}"

Please fix this error in your new response. Common issues:
- DO NOT redeclare reserved variables: ${RESERVED_VARIABLES.join(', ')}
- These are already defined - just use them directly (e.g., \`params['width']\` not \`const params = ...\`)
- Make sure all YOUR variables have unique names
- Ensure the code returns a valid Manifold object

`
}

const MAX_RETRIES = 2

// Map our model IDs to actual Google model names
type GeometryModelId = 'gemini-3-pro-preview' | 'gemini-2.5-pro' | 'gemini-2.5-flash'

function getGeometryModelName(modelId: GeometryModelId): string {
  switch (modelId) {
    case 'gemini-2.5-flash':
      return 'gemini-2.5-flash'
    case 'gemini-2.5-pro':
      return 'gemini-2.5-pro'
    case 'gemini-3-pro-preview':
    default:
      return 'gemini-3-pro-preview'
  }
}

// Model pricing per 1M tokens (USD)
// Source: https://ai.google.dev/pricing
function getModelPricing(modelName: string): { input: number; output: number } {
  switch (modelName) {
    case 'gemini-2.5-flash':
      // Gemini 2.5 Flash: $0.15/1M input, $0.60/1M output (<=200k context)
      return { input: 0.15, output: 0.60 }
    case 'gemini-2.5-pro':
      // Gemini 2.5 Pro: $1.25/1M input, $10.00/1M output (<=200k context)
      return { input: 1.25, output: 10.00 }
    case 'gemini-3-pro-preview':
      // Gemini 3 Pro Preview: $2.00/1M input, $12.00/1M output
      return { input: 2.00, output: 12.00 }
    default:
      // Default to Gemini 3 Pro Preview pricing
      return { input: 2.00, output: 12.00 }
  }
}

/**
 * Creates an ImageToGeometryService using Google's Gemini API.
 * @param apiKey - Google AI API key
 * @param modelId - Model to use for generation
 * @param format - Output format: 'manifold' for direct Manifold JS, 'openscad' for OpenSCAD transpilation
 */
export function createImageToGeometryService(
  apiKey: string,
  modelId: GeometryModelId = 'gemini-3-pro-preview',
  format: OutputFormat = 'manifold'
): ImageToGeometryService {
  const modelName = getGeometryModelName(modelId)
  const analysisPrompt = format === 'openscad' ? OPENSCAD_ANALYSIS_PROMPT : MANIFOLD_ANALYSIS_PROMPT
  let analyzing = false
  let abortController: AbortController | null = null

  const ai = new GoogleGenAI({ apiKey })

  /**
   * Internal function to make a single API call.
   * Returns the parsed analysis or an error response.
   */
  async function callGeminiApi(
    request: ImageToGeometryRequest,
    previousError?: string
  ): Promise<
    | { success: true; analysis: GeometryAnalysis }
    | { success: false; error: string; isCodeValidationError?: boolean }
  > {
    // Compress image for reduced latency and cost
    const compressedImage = await compressSketchImage(request.imageDataUrl)

    if (import.meta.env.DEV) {
      console.log(`[${modelName}] Image compression:`, {
        original: `${Math.round(request.imageDataUrl.length / 1024)}KB`,
        compressed: `${Math.round(compressedImage.length / 1024)}KB`,
        reduction: `${Math.round((1 - compressedImage.length / request.imageDataUrl.length) * 100)}%`
      })
    }

    // Parse the compressed image data URL
    const { data, mimeType } = parseDataUrl(compressedImage)

    // Build the full prompt with user context, optional model context, and error context
    const modelContext = buildCurrentModelContext(request)
    const errorContext = buildErrorContext(previousError)
    const fullPrompt = `${analysisPrompt}${request.prompt}${modelContext}${errorContext}`

    // Log the request (without image data)
    if (import.meta.env.DEV) {
      console.log(`[${modelName}] Image-to-Geometry Request:`, {
        model: modelName,
        format,
        userPrompt: request.prompt,
        hasCurrentModel: !!request.currentBuilderCode,
        currentModelName: request.currentModelName ?? 'N/A',
        imageSizeSent: `${Math.round(compressedImage.length / 1024)}KB`,
        fullPromptLength: `${fullPrompt.length} chars`,
        isRetry: !!previousError
      })
      if (previousError) {
        console.log(`[${modelName}] Retry due to error:`, previousError)
      }
      console.log(`[${modelName}] Full prompt:\n`, fullPrompt)
    }

    // Call Gemini API with image and prompt
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data
              }
            },
            {
              text: fullPrompt
            }
          ]
        }
      ]
    })

    // Log response metadata with cost calculation
    if (import.meta.env.DEV) {
      const promptTokens = response?.usageMetadata?.promptTokenCount ?? 0
      const responseTokens = response?.usageMetadata?.candidatesTokenCount ?? 0

      // Model-specific pricing per 1M tokens
      const pricing = getModelPricing(modelName)
      const inputCost = (promptTokens / 1_000_000) * pricing.input
      const outputCost = (responseTokens / 1_000_000) * pricing.output
      const totalCost = inputCost + outputCost

      console.log(`[${modelName}] Response metadata:`, {
        promptTokens,
        responseTokens,
        totalTokens: response?.usageMetadata?.totalTokenCount,
        responseLength: response?.text?.length ?? 0,
        estimatedCost: `$${totalCost.toFixed(4)} (input: $${inputCost.toFixed(4)}, output: $${outputCost.toFixed(4)})`
      })
    }

    // Check for cancellation
    if (abortController?.signal.aborted) {
      return {
        success: false,
        error: 'Analysis was cancelled'
      }
    }

    // Extract text from response
    const responseText = response?.text
    if (!responseText) {
      return {
        success: false,
        error: 'Empty response from AI - no analysis generated'
      }
    }

    // Log the AI's full response
    if (import.meta.env.DEV) {
      console.log(`[${modelName}] AI Response:`, responseText)
    }

    // Parse JSON response
    let parsedData: unknown
    try {
      const jsonText = extractJson(responseText)
      parsedData = JSON.parse(jsonText)
    } catch {
      return {
        success: false,
        error: 'Invalid JSON format in AI response - could not parse'
      }
    }

    // Handle format-specific validation and processing
    if (format === 'openscad') {
      // Validate OpenSCAD response structure
      if (!validateOpenSCADAnalysis(parsedData)) {
        return {
          success: false,
          error:
            'AI response missing required fields (description, openscadCode, suggestedName, parameters, defaultParams)'
        }
      }

      // Log OpenSCAD code before transpilation
      if (import.meta.env.DEV) {
        console.log(`[${modelName}] OpenSCAD code to transpile:`, parsedData.openscadCode)
      }

      // Transpile OpenSCAD to Manifold JavaScript
      let manifoldCode: string
      try {
        if (import.meta.env.DEV) {
          console.log(`[${modelName}] OpenSCAD parse phase starting...`)
        }
        manifoldCode = transpileOpenSCAD(parsedData.openscadCode)
        if (import.meta.env.DEV) {
          console.log(`[${modelName}] OpenSCAD transpile phase completed successfully`)
          console.log(`[${modelName}] Transpiled Manifold code:`, manifoldCode)
        }
      } catch (err) {
        // Handle parse errors
        if (err instanceof OpenSCADParseError) {
          if (import.meta.env.DEV) {
            console.log(`[${modelName}] OpenSCAD parse error:`, err.message)
          }
          return {
            success: false,
            error: `OpenSCAD Parse Error: ${err.toRetryContext()}`,
            isCodeValidationError: true
          }
        }

        // Handle lex errors
        if (err instanceof OpenSCADLexError) {
          if (import.meta.env.DEV) {
            console.log(`[${modelName}] OpenSCAD lex error:`, err.message)
          }
          return {
            success: false,
            error: `OpenSCAD Lex Error at line ${err.line}, column ${err.column}: ${err.message}`,
            isCodeValidationError: true
          }
        }

        // Handle transpile errors
        if (err instanceof OpenSCADTranspileError) {
          if (import.meta.env.DEV) {
            console.log(`[${modelName}] OpenSCAD transpile error:`, err.message)
          }
          return {
            success: false,
            error: `OpenSCAD Transpile Error: ${err.message}`,
            isCodeValidationError: true
          }
        }

        // Unknown error
        const errorMessage = err instanceof Error ? err.message : 'Unknown transpilation error'
        return {
          success: false,
          error: `OpenSCAD Transpilation Failed: ${errorMessage}`,
          isCodeValidationError: true
        }
      }

      // Validate the transpiled Manifold JavaScript syntax
      const codeValidation = validateBuilderCode(manifoldCode)
      if (!codeValidation.valid) {
        if (import.meta.env.DEV) {
          console.log(`[${modelName}] Transpiled code validation failed:`, codeValidation.error)
        }
        return {
          success: false,
          error: `Invalid JavaScript syntax in transpiled code: ${codeValidation.error}`,
          isCodeValidationError: true
        }
      }

      // Return GeometryAnalysis with transpiled Manifold code as builderCode
      return {
        success: true,
        analysis: {
          description: parsedData.description,
          builderCode: manifoldCode,
          suggestedName: parsedData.suggestedName,
          parameters: parsedData.parameters,
          defaultParams: parsedData.defaultParams
        }
      }
    }

    // Manifold format: existing behavior
    // Validate the response structure
    if (!validateManifoldAnalysis(parsedData)) {
      return {
        success: false,
        error:
          'AI response missing required fields (description, builderCode, suggestedName, parameters, defaultParams)'
      }
    }

    // Validate the generated code syntax
    const codeValidation = validateBuilderCode(parsedData.builderCode)
    if (!codeValidation.valid) {
      if (import.meta.env.DEV) {
        console.log(`[${modelName}] Code validation failed:`, codeValidation.error)
      }
      return {
        success: false,
        error: `Invalid JavaScript syntax in generated code: ${codeValidation.error}`,
        isCodeValidationError: true
      }
    }

    return {
      success: true,
      analysis: parsedData
    }
  }

  return {
    async analyzeImage(request: ImageToGeometryRequest): Promise<ImageToGeometryResponse> {
      // Validate request
      if (!request.imageDataUrl) {
        return {
          success: false,
          error: 'Image data URL is required - no image provided'
        }
      }

      if (!request.prompt) {
        return {
          success: false,
          error: 'Prompt is required - no prompt provided'
        }
      }

      // Check if already analyzing
      if (analyzing) {
        return {
          success: false,
          error: 'Analysis already in progress - please wait or cancel'
        }
      }

      analyzing = true
      abortController = new AbortController()

      try {
        let retryCount = 0
        let previousError: string | undefined

        while (retryCount <= MAX_RETRIES) {
          try {
            const result = await callGeminiApi(request, previousError)

            if (result.success) {
              return {
                success: true,
                analysis: result.analysis
              }
            }

            // Only retry on code validation errors
            if (result.isCodeValidationError && retryCount < MAX_RETRIES) {
              retryCount++
              previousError = result.error
              if (import.meta.env.DEV) {
                console.log(
                  `[Gemini 3 Pro Preview] Retry attempt ${retryCount}/${MAX_RETRIES}`
                )
              }
              continue
            }

            // Non-retryable error or max retries reached
            return {
              success: false,
              error: result.error
            }
          } catch (error) {
            // Check for cancellation
            if (abortController?.signal.aborted) {
              return {
                success: false,
                error: 'Analysis was cancelled'
              }
            }

            // API errors are not retried
            // Log full error details for debugging
            if (import.meta.env.DEV) {
              console.error(`[${modelName}] API Error:`, error)
              if (error && typeof error === 'object') {
                console.error(`[${modelName}] Error details:`, JSON.stringify(error, null, 2))
              }
            }
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error occurred'
            return {
              success: false,
              error: `Analysis failed: ${errorMessage}`
            }
          }
        }

        // Should not reach here, but return error if we do
        return {
          success: false,
          error: 'Maximum retry attempts exceeded'
        }
      } finally {
        analyzing = false
        abortController = null
      }
    },

    isAnalyzing(): boolean {
      return analyzing
    },

    cancelAnalysis(): void {
      if (abortController) {
        abortController.abort()
      }
    }
  }
}
