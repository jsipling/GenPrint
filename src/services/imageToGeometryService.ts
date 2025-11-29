import { GoogleGenAI } from '@google/genai'
import type {
  ImageToGeometryService,
  ImageToGeometryRequest,
  ImageToGeometryResponse,
  GeometryAnalysis
} from './imageToGeometryTypes'
import { BUILDER_RESERVED_CONSTANTS } from '../generators/manifold/printingConstants'
import { compressSketchImage, parseDataUrl } from '../utils/imageCompression'

// Build the list of all reserved variable names for builder code
// These are passed as function parameters and must not be redeclared
const RESERVED_VARIABLES = ['M', 'params', ...BUILDER_RESERVED_CONSTANTS] as const

const ANALYSIS_PROMPT = `You are a 3D modeling expert that converts images into parametric 3D geometry code.

Analyze this image as a 3D printable design and generate Manifold-3D compatible JavaScript builder code.

## Your Task

1. **Describe** what you see - identify the shape, features, and purpose
2. **Generate** JavaScript code that builds this geometry using the Manifold-3D API
3. **Extract** configurable parameters that would make this design customizable
4. **Name** the model appropriately

## Manifold-3D API Reference

Available operations (via the M object):
- \`M.Manifold.cube([width, depth, height], centered)\` - Create a box
- \`M.Manifold.cylinder(height, bottomRadius, topRadius, segments)\` - Create a cylinder
- \`M.Manifold.sphere(radius, segments)\` - Create a sphere
- \`manifold.add(other)\` - Union two manifolds
- \`M.Manifold.union([array])\` - Union multiple manifolds
- \`M.Manifold.difference(base, [tools])\` - Subtract tools from base
- \`manifold.translate([x, y, z])\` - Move geometry
- \`manifold.rotate([x, y, z])\` - Rotate geometry (degrees)
- \`manifold.scale([x, y, z])\` - Scale geometry

## Code Requirements

- Access parameters via \`params['paramName']\` or \`params.paramName\`
- Always provide fallback defaults: \`const width = Number(params['width']) || 50;\`
- **IMPORTANT**: Return an array of named parts to enable hover highlighting. Each part is an object with:
  - \`name\`: Human-readable name for the part (e.g., "Base", "Handle", "Top Cover")
  - \`manifold\`: The Manifold geometry for this part
  - \`dimensions\` (optional): Array of dimension labels
  - \`params\` (optional): Parameters used for this part
- Even for simple single-piece models, wrap in an array with one named part
- Use 16 segments for cylinders (smooth circles)
- Use 8 segments per 90° for corners
- Minimum wall thickness: 1.2mm
- Minimum feature size: 1.5mm

## Multi-Part Return Format Example

\`\`\`javascript
const width = Number(params['width']) || 50;
const height = Number(params['height']) || 20;
const baseManifold = M.Manifold.cube([width, width, height], true);

return [
  {
    name: 'Base',
    manifold: baseManifold,
    dimensions: [
      { label: 'Width', param: 'width', format: '{value}mm' },
      { label: 'Height', param: 'height', format: '{value}mm' }
    ],
    params: { width: width, height: height }
  }
];
\`\`\`

For models with multiple distinct parts:
\`\`\`javascript
const base = M.Manifold.cube([50, 50, 10], true);
const handle = M.Manifold.cylinder(30, 5, 5, 16).translate([0, 0, 20]);

return [
  { name: 'Base Plate', manifold: base },
  { name: 'Handle', manifold: handle }
];
\`\`\`

## IMPORTANT: Reserved Variables (DO NOT REDECLARE)

The following variables are already defined in the execution context. DO NOT declare them:
${RESERVED_VARIABLES.map(v => `- \`${v}\``).join('\n')}

Your code must NOT use ${RESERVED_VARIABLES.map(v => `\`const ${v}\``).join(', ')}, etc.

## Working with Existing Models

If you're provided with an existing model's code, analyze the user's intent:

MODIFICATION INTENT (when user says things like "add", "put on", "attach", "modify", "on top of", "to the side"):
- Your builderCode should execute the existing model's code first, then add your new geometry as a SEPARATE PART
- Keep existing parts separate - spread them with ...existingParts and add new parts to the array
- This preserves hover highlighting for each distinct part
- Include the existing model's parameters in your parameters array
- Use the provided existing model code as an IIFE to get the base model

REPLACEMENT INTENT (when user describes a complete standalone object):
- Generate completely new code that replaces the existing model
- Don't reference the existing model

## Response Format

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "description": "Brief description of what the model is",
  "suggestedName": "Human-readable name for the model",
  "builderCode": "const width = Number(params['width']) || 50; const height = Number(params['height']) || 20; const cube = M.Manifold.cube([width, width, height], true); return [{ name: 'Cube', manifold: cube, params: { width: width, height: height } }];",
  "parameters": [
    {
      "type": "number",
      "name": "width",
      "label": "Width",
      "min": 10,
      "max": 200,
      "default": 50,
      "step": 1,
      "unit": "mm",
      "description": "Width of the model"
    }
  ],
  "defaultParams": {
    "width": 50
  }
}

## Parameter Types

Number parameters require: type, name, label, min, max, default
Optional number fields: step, unit, description

Boolean parameters require: type, name, label, default
Optional boolean fields: description

Select parameters require: type, name, label, options (array), default

## User's Design Intent

`

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
 * Validate that the analysis response contains all required fields.
 */
function validateAnalysis(data: unknown): data is GeometryAnalysis {
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
type GeometryModelId = 'gemini-2.5-pro-preview-06-05' | 'gemini-2.5-flash'

function getGeometryModelName(modelId: GeometryModelId): string {
  switch (modelId) {
    case 'gemini-2.5-flash':
      return 'gemini-2.5-flash'
    case 'gemini-2.5-pro-preview-06-05':
    default:
      return 'gemini-2.5-pro-preview-06-05'
  }
}

/**
 * Creates an ImageToGeometryService using Google's Gemini API.
 */
export function createImageToGeometryService(apiKey: string, modelId: GeometryModelId = 'gemini-2.5-pro-preview-06-05'): ImageToGeometryService {
  const modelName = getGeometryModelName(modelId)
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
    const fullPrompt = `${ANALYSIS_PROMPT}${request.prompt}${modelContext}${errorContext}`

    // Log the request (without image data)
    if (import.meta.env.DEV) {
      console.log(`[${modelName}] Image-to-Geometry Request:`, {
        model: modelName,
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
      const inputCost = (promptTokens / 1_000_000) * 2.0
      const outputCost = (responseTokens / 1_000_000) * 12.0
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

    // Validate the response structure
    if (!validateAnalysis(parsedData)) {
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
        console.log(
          '[Gemini 3 Pro Preview] Code validation failed:',
          codeValidation.error
        )
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
