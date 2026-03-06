# Gele AI

MVP web app to upload a portrait and generate a realistic Nigerian gele style image.

## Current Status
- Phase 0-5 completed.
- Supabase auth added:
  - Email/password login and signup
  - Signup captures full name and country
  - Username defaults to first name
  - Forgot password + reset password flow
  - Signup password policy: 8+ chars, uppercase, number
- Transform flow is auth-gated:
  - User can upload first
  - On transform click, login/signup is required
  - After successful auth, generation proceeds
- User dashboard added:
  - Shows generated images for logged-in user
  - Images auto-expire after 7 days
- Daily free quota:
  - 3 free generations per user per day
  - Reset countdown shown when free limit is exhausted

## Supabase Setup
1. Create a Supabase project.
2. In SQL editor, run: `supabase/schema.sql`
3. Create a private storage bucket named `generated-images` (or set `SUPABASE_GENERATIONS_BUCKET`).
4. Ensure email/password auth is enabled.

## Run Locally
1. Copy `.env.example` to `.env.local`
2. Fill all required env vars
3. Install dependencies:
```bash
npm install
```
4. Start dev server:
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
Required:
- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY=...`
- `GEMINI_MODEL=gemini-2.5-flash-image`
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SUPABASE_GENERATIONS_BUCKET=generated-images`
