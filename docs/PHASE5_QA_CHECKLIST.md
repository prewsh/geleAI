# Phase 5 QA Checklist (No Deployment)

## Scope
- Validate MVP quality before deployment.
- Confirm end-to-end flow for upload -> processing -> result.
- Confirm API reliability behavior from Phase 4 (timeouts, retries, rate limits, request IDs).

## Golden Portrait Set (Manual)
Create and test with at least 12 images:
- 4 front-facing portraits
- 4 side-angle portraits (left/right)
- 2 low-light portraits
- 2 portraits with existing headwear/hair volume

For each image, test with:
- `geleColor=auto`
- one explicit color (`red`, `blue`, `gold`, or `green`)
- one custom style prompt

Pass criteria:
- Face identity remains recognizable.
- Gele aligns with head pose/hairline.
- Lighting and shadow remain consistent.
- No major artifacts around forehead/ears/hairline.

## Functional QA
1. Upload valid image (`jpg/png/webp` <= 10 MB): success path works.
2. Upload invalid type (`gif`): clear validation error shown.
3. Upload image > 10 MB: clear size validation error shown.
4. Click transform without image: button remains disabled.
5. During processing: button is disabled and progress state is visible.
6. On success: result screen shows before/after and download action.
7. Retry action after failure: same image can be retried without re-upload.

## Reliability QA
1. Simulate provider timeout: API returns timeout error and UI shows recovery.
2. Simulate transient provider failure: API retries once and succeeds if second call succeeds.
3. Trigger rate limit from same IP/session: API returns `429` with `retry-after`.
4. Check every API response includes `x-request-id`.

## Release Readiness Gate (Local)
All must pass:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Known Non-Deployment Items
- No Vercel deployment performed in this phase (by request).
- Final deployment validation (preview/prod URL checks) is deferred to deployment phase.
