# Gele AI - Implementation Plan (MVP)

## Status Summary (Updated)
- Phase 0: Completed
- Phase 1: Completed
- Phase 2: Completed
- Phase 3: Completed
- Phase 4: Completed
- Phase 5: Completed (deployment intentionally deferred)

## Phase 0 - Setup (Day 1)
- Initialize Next.js + TypeScript + Tailwind project.
- Configure linting/formatting/testing baseline.
- Add `.env.example` with required keys.

**Exit criteria**
- App runs locally.
- CI checks pass for lint + typecheck.

## Phase 1 - 3-Screen UI Skeleton (Day 1-2)
- Build route and state machine for:
  1. Upload
  2. Processing
  3. Result
- Implement bright, simple, classy visual style.
- Add responsive behavior for mobile and desktop.

**Exit criteria**
- User can move through screens with mocked data.

## Phase 2 - Backend Transform API (Day 2-3)
- Implement `/api/transform` route.
- Add file validation (mime, size, dimensions basic checks).
- Add provider adapter interface and Gemini adapter implementation.

**Exit criteria**
- API accepts a real image and returns mocked transformed output.

## Phase 3 - Gemini Integration (Day 3-4)
- Connect Gemini 2.5 Flash image transformation flow.
- Implement prompt template for realistic gele placement.
- Add error mapping (quota/timeout/provider errors).

**Exit criteria**
- End-to-end real generation works on test portraits.

## Phase 4 - Quality + Safety Hardening (Day 4-5)
- Add retry + timeout handling.
- Add rate limiting and request IDs.
- Improve empty/error/retry UX states.

**Exit criteria**
- App gracefully handles failures and shows clear recovery actions.

## Phase 5 - Test + Release (Day 5-6)
- Unit tests for validation + prompt builder.
- Integration tests for API route.
- Manual QA using curated portrait set.
- Deploy preview + production on Vercel.

**Exit criteria**
- MVP stable and publicly accessible.

**Current note**
- Testing and release-readiness tasks are complete.
- Deployment tasks are intentionally pending per user request.

## Work Breakdown (Engineering Tasks)
1. Project bootstrap and tooling.
2. Reusable UI components (`UploadCard`, `ProgressStage`, `ResultPanel`).
3. API contract and schema validation.
4. Provider abstraction + Gemini adapter.
5. Prompt tuning pass with golden test set.
6. Error handling and analytics events.
7. Deployment and smoke testing.

## Acceptance Criteria (MVP)
- User can upload a portrait and receive a transformed image with gele.
- Three-screen flow is smooth and understandable.
- Median generation time <= 25 seconds.
- Failures provide actionable retry messaging.
- Works on current Chrome/Safari/Edge mobile + desktop.

## Risk Register
- **Output realism variance**: mitigate with test set + iterative prompt tuning.
- **Free-tier quota limits**: mitigate with rate limiting and usage messaging.
- **Provider API changes**: isolate through adapter abstraction.

## Immediate Next Step
Proceed with deployment process separately (preview first, then production).
