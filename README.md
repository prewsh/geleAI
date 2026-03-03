# Gele AI

MVP web app to upload a portrait and preview an AI-style transformation that adds a natural Nigerian gele.

## Current Status
- Phase 0 complete: scaffold, lint/type/test/format scripts, env template.
- Phase 1 complete: 3-screen flow implemented.
  - Screen 1: Upload + style prompt
  - Screen 2: Processing states
  - Screen 3: Result + download + retry
- Phase 2 and 3 complete:
  - `/api/transform` now validates multipart input and calls a provider adapter.
  - Gemini adapter implemented with robust error mapping and response parsing.
  - Frontend now calls real API flow and renders provider metadata.
  - Unit + integration tests added for prompt, validation, provider, and route behavior.
- Phase 4 complete:
  - API timeout, transient retry, rate limiting, and request IDs implemented.
  - UI error/retry states hardened.
- Phase 5 complete (without deployment):
  - Added UI flow tests for upload/validation/success transitions.
  - Added manual QA and release-readiness checklist in `docs/PHASE5_QA_CHECKLIST.md`.

## Run Locally
1. Install dependencies:
```bash
npm install
```
2. Start dev server:
```bash
npm run dev
```

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run format`
- `npm run format:write`

## Environment
Copy `.env.example` to `.env.local` and fill:
- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY=...`
- `GEMINI_MODEL=gemini-2.5-flash-image` (or another compatible image-capable Gemini model)
