# Gele AI - Product Requirements Document (PRD)

## 1. Product Summary
**Product name:** Gele AI  
**Vision:** Let users upload a portrait and get back a realistic, culturally respectful edit where a Nigerian gele head tie is added naturally to the person.

This is an MVP web app with **3 screens**, optimized for simplicity, brightness, and clean UI.

## 2. Problem Statement
People want to quickly visualize themselves (or subjects in portraits) wearing a gele style without manual photo editing skills. Existing tools are generic and do not specifically target natural gele placement and styling.

## 3. Goals
- Deliver a clean 3-screen web MVP.
- Accept one portrait image upload.
- Return one AI-edited image with realistic gele fit on the subject's head.
- Keep cost near-zero for a free-tier launch.
- Keep average generation time under 25 seconds for standard images.

## 4. Non-Goals (MVP)
- No video generation.
- No multi-image batch processing.
- No user accounts/login.
- No advanced manual masking tools.
- No e-commerce/payment.

## 5. Target Users
- Individuals experimenting with cultural fashion styles.
- Creators/social media users making portrait edits.
- Event planners/stylists doing quick concept previews.

## 6. User Stories
- As a user, I can upload a portrait photo from my device.
- As a user, I can choose a gele style prompt (or keep default) and submit.
- As a user, I can view and download the generated image.
- As a user, I can restart and try another image easily.

## 7. Core MVP Features
1. **Image Upload & Validation**
- Supported types: JPG, JPEG, PNG, WebP.
- Max size: 10 MB.
- Basic client-side checks before upload.

2. **AI Transformation**
- Backend sends image + prompt to selected AI provider.
- Prompt enforces realistic gele fit, correct head alignment, natural shadows/light, and preserved facial identity.

3. **Result & Download**
- Display transformed image.
- Download button (PNG/JPG).
- "Try another" action resets flow.

## 8. UX Requirements (3 Screens)
1. **Screen 1: Upload**
- Bright, classy landing block.
- Upload zone + short helper text + sample prompt chip.

2. **Screen 2: Processing**
- Clear progress state with short status messages.
- Soft animation/skeleton, no clutter.

3. **Screen 3: Result**
- Side-by-side or toggle (original vs transformed).
- Download and "Generate again" buttons.

## 9. Functional Requirements
- App must handle one image generation request at a time per browser session.
- API must return structured errors (validation/provider/timeout).
- Client must show failure message with retry action.
- Generated images are stored temporarily (TTL), then auto-cleaned.

## 10. Success Metrics (MVP)
- Task completion rate (upload -> successful result): >= 70%.
- Median generation time: <= 25s.
- User-rated output quality (internal test panel): >= 3.8/5.
- Crash-free sessions: >= 99%.

## 11. Constraints
- User is on free tier, no paid subscriptions.
- Need low operational overhead.
- Must remain respectful in cultural representation.

## 12. Recommendation: Gemini vs Sora for this MVP
**Recommended primary provider: Gemini 2.5 Flash (image editing path)**.

Reasoning:
- Gemini API currently exposes free-tier usage and published quotas/pricing for Flash models, making it practical for zero-cost MVP tests.
- Sora is primarily video-focused and its app/API access has rollout and verification constraints that add friction for a simple portrait image-edit MVP.
- Your required output is still image transformation, not video.

**Decision:** Build provider abstraction now, ship MVP on Gemini first, keep Sora as future extension.

## 13. Risks and Mitigations
- Risk: Unnatural gele placement.  
  Mitigation: stricter prompts, optional 2-pass edit (head localization then style render), and curated test set.
- Risk: Free-tier quota exhaustion.  
  Mitigation: request queue, rate limits, graceful quota messaging.
- Risk: Inconsistent identity preservation.  
  Mitigation: prompt constraints and regression image tests.

## 14. Future Scope (Post-MVP)
- Multiple gele presets (auto-generated style cards).
- Strength slider (subtle <-> dramatic).
- Optional manual head-region adjustment.
- Sora short-video reveal from the edited portrait.
