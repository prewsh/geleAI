# Gele AI - Technical Design Document

## 1. Technical Objective
Build a production-lean MVP web app that transforms one portrait image by adding a realistic Nigerian gele, using a free-tier-friendly AI provider.

## 2. Architecture Overview
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS.
- **Backend API:** Next.js Route Handlers (`/api/transform`).
- **AI Provider Layer:** pluggable adapter (`GeminiAdapter`, `SoraAdapter` placeholder).
- **Storage:** local temp storage (dev) -> object storage (optional later).
- **Observability:** structured logs + request IDs.

### Request Flow
1. User uploads image on Screen 1.
2. Frontend sends multipart request to `/api/transform`.
3. Backend validates image and sanitizes prompt.
4. Backend calls provider adapter (Gemini for MVP).
5. Backend returns transformed image URL or base64 payload.
6. Frontend shows Screen 3 with download controls.

## 3. Why Gemini 2.5 Flash for MVP
- Better alignment with free-tier API experimentation for lightweight MVPs.
- Faster and cheaper iteration on prompt tuning.
- Sora is better reserved for future video-centric features.

## 4. API Design
### POST `/api/transform`
**Input:** `multipart/form-data`
- `image`: file
- `stylePrompt`: optional string
- `geleColor`: optional string enum (`red`, `blue`, `gold`, `green`, `auto`)

**Output (200):**
```json
{
  "jobId": "uuid",
  "status": "completed",
  "outputImageUrl": "...",
  "meta": {
    "provider": "gemini",
    "durationMs": 14320
  }
}
```

**Errors:**
- `400` validation (bad file type/size)
- `429` rate-limited/quota reached
- `502` provider failure
- `504` timeout

## 5. AI Prompting Strategy
### Base instruction template
- Keep subject identity and face unchanged.
- Add a realistic Nigerian gele fitted naturally on the head.
- Respect head angle, hairline, lighting direction, shadows, and skin tone.
- Maintain photorealistic texture and perspective.
- Preserve image background unless occluded by gele.

### Guardrails
- Reject non-portrait images where no head is confidently visible.
- Reject unsafe content according to provider policy.

## 6. Domain Model
```ts
type TransformRequest = {
  imageMimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  stylePrompt?: string;
  geleColor?: 'red' | 'blue' | 'gold' | 'green' | 'auto';
};

type TransformResult = {
  jobId: string;
  outputImageUrl: string;
  provider: 'gemini' | 'sora';
  durationMs: number;
};
```

## 7. Frontend Screen Design
1. **Upload Screen**
- Large upload card, bright background gradient, concise instructions.
- Optional style chips (Classic, Wedding, Bold, Minimal).

2. **Processing Screen**
- Progress indicator with deterministic states:
  - Uploading
  - Analyzing head position
  - Applying gele style
  - Finalizing image

3. **Result Screen**
- Before/after toggle.
- Download button.
- Retry/new upload button.

## 8. Security and Privacy
- Validate file signatures, not just extensions.
- Enforce max upload size (10 MB).
- Short-lived file retention (e.g., 1 hour TTL).
- No permanent storage of user images in MVP.
- Rate limit by IP/session.

## 9. Reliability and Performance
- Timeout external provider requests (e.g., 35s hard limit).
- Retry policy: max 1 retry for transient provider failures.
- Return user-friendly errors with retry option.
- Cache static assets aggressively.

## 10. Testing Strategy
- Unit tests for validation and prompt builder.
- Integration tests for `/api/transform` with mocked adapter.
- UI tests for 3-screen flow and error states.
- Golden-image manual QA set (10-20 portraits) for realism checks.

## 11. Deployment Strategy
- Host on Vercel.
- Store secrets in environment variables:
  - `GEMINI_API_KEY`
  - `AI_PROVIDER=gemini`
- Feature flag provider switching.

## 12. Technical Debt to Track
- Replace temp local storage with cloud object storage.
- Add async job queue when traffic increases.
- Introduce dedicated moderation layer if needed.
