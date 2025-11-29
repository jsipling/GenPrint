# Google AI Integration for GenPrint

This document describes the Google AI (Gemini + Imagen) service integration for the AI assist panel.

## Overview

The AI assist panel now supports Google AI services using:
- **Gemini 2.0 Flash (Experimental)** for vision analysis of sketches
- **Google Imagen** for image generation (placeholder implementation)

The system automatically selects between the Google AI service and a mock service based on API key availability.

## Files Created/Modified

### New Files
- `/src/services/googleAiService.ts` - Google AI service implementation
- `/src/services/googleAiService.test.ts` - Comprehensive test suite for Google AI service
- `/.env.local` - Environment variable template

### Modified Files
- `/src/services/types.ts` - Updated to support optional sketch and prompt
- `/src/services/aiService.ts` - Service selection logic (Google AI vs Mock)
- `/src/services/mockAiService.ts` - Enhanced with proper error handling

## Setup Instructions

### 1. Get Google AI API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the generated key

### 2. Configure Environment

1. Edit `.env.local` in the project root
2. Uncomment the `VITE_GOOGLE_AI_API_KEY` line
3. Replace `your_api_key_here` with your actual API key
4. Save the file

Example:
```bash
VITE_GOOGLE_AI_API_KEY=AIzaSyA_your_actual_api_key_here
```

### 3. Restart Development Server

```bash
npm run dev
```

The console will log which service is being used:
- `[AI Service] Using Google AI service` - Google AI is active
- `[AI Service] No API key found, using mock service` - Mock service is active

## Usage Modes

The Google AI service supports three input modes:

### 1. Sketch + Prompt (Full Analysis)
- User provides both a sketch and a text prompt
- Gemini analyzes the sketch with user context
- Result: Detailed description incorporating both inputs

### 2. Sketch Only (Auto Analysis)
- User provides only a sketch
- Gemini analyzes the sketch automatically
- Result: Technical description of the sketch

### 3. Prompt Only (Direct Generation)
- User provides only a text prompt
- Skips vision analysis, uses prompt directly
- Result: Image based on text description

## Architecture

### Service Selection (`aiService.ts`)

```typescript
export function createAiService(): ImageGenerationService {
  const apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY

  if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
    return createGoogleAiService(apiKey)
  }

  return createMockAiService()
}
```

### Google AI Workflow

1. **Validation**: Ensures either sketch or prompt is provided
2. **Vision Analysis** (if sketch provided):
   - Converts data URL to base64
   - Sends to Gemini 2.0 Flash with context
   - Receives detailed technical description
3. **Image Generation**:
   - Currently uses placeholder implementation
   - Returns SVG with processed description
   - TODO: Integrate Vertex AI Imagen API

### Error Handling

The service provides typed errors with retry guidance:

| Error Code | Description | Retryable |
|------------|-------------|-----------|
| `VALIDATION` | Invalid input (missing sketch/prompt, bad format) | No |
| `API_ERROR` | Google AI API error | Yes |
| `RATE_LIMIT` | API quota exceeded | Yes |
| `NETWORK` | Network connection failed or user cancelled | Yes |

## Testing

### Run Service Tests Only

```bash
npm test -- src/services/
```

### Test Coverage

- ✅ Sketch + prompt generation
- ✅ Sketch only generation
- ✅ Prompt only generation
- ✅ Conversation mode with history
- ✅ Input validation (sketch format, missing inputs)
- ✅ Concurrent request prevention
- ✅ Generation cancellation
- ✅ Error handling for API failures

### Mock Implementation

The tests use Vitest mocks to simulate Google AI responses without making actual API calls.

## Current Limitations

### Image Generation Placeholder

The current implementation uses a placeholder for image generation because:
1. The `@google/generative-ai` SDK (as of v0.21.0) doesn't support image generation
2. Full Imagen integration requires Vertex AI setup with additional authentication
3. The placeholder returns an SVG showing the processed description

### Future Enhancement

To implement full image generation:
1. Set up Google Cloud Project with Vertex AI API enabled
2. Install `@google-cloud/aiplatform` package
3. Implement authentication with service account
4. Replace placeholder in `generateImage()` function
5. Handle image upload/storage for results

## API Usage

### Request Structure

```typescript
interface ImageGenerationRequest {
  sketchDataUrl?: string      // Optional base64 data URL
  prompt?: string              // Optional text prompt
  continueConversation: boolean
  conversationHistory?: ConversationMessage[]
}
```

### Response Structure

```typescript
interface ImageGenerationResponse {
  imageUrl: string             // Generated image data URL
  conversationId?: string      // For conversation tracking
  timestamp: number            // Generation timestamp
}
```

## Development Notes

- The service uses proper memory management with AbortController for cancellation
- All intermediate state is cleaned up in finally blocks
- Logging only appears in development mode (`import.meta.env.DEV`)
- The mock service mimics real service behavior for seamless testing

## Troubleshooting

### API Key Not Working

1. Verify the key is valid in Google AI Studio
2. Check for extra spaces in `.env.local`
3. Ensure the line is uncommented (no `#` at start)
4. Restart the dev server after changes

### "Invalid API key" Error

- The API key may have been revoked or expired
- Generate a new key in Google AI Studio

### Rate Limit Errors

- Google AI has daily quotas for free tier
- Wait for quota reset or upgrade to paid tier
- The error is marked as retryable - user can try again later

## Security Notes

- Never commit `.env.local` to version control (already in `.gitignore`)
- API keys should be kept secret
- For production, use server-side API calls with key storage
- Current implementation is client-side for development convenience
