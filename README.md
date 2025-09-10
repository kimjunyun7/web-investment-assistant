This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment Setup (Supabase Auth)

Create a `.env.local` file in the project root with the following variables (do not commit this file):

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Then, in Supabase Dashboard:

- Create a user (email/password) manually under Authentication > Users.
- Ensure Email Confirmations are disabled or that the user is confirmed so sign-in works immediately.

## Auth Flow

- `src/lib/supabase/server.ts` and `src/lib/supabase/browser.ts` create Supabase clients for server and browser.
- `src/lib/auth.ts` provides `getCurrentUser()` for server-side user retrieval.
- API routes:
  - `POST /api/auth/login` with body `{ email, password }` to sign in.
  - `POST /api/auth/logout` to sign out.
- Pages:
  - `src/app/login/page.tsx` renders the login form and calls the login API.
  - `src/app/page.tsx` is protected; unauthenticated users are redirected to `/login`.

## Phase 2 Setup

### Environment Variables (APIs)

Add the following to `.env.local`:

```
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
SERPER_API_KEY=your_serper_key
GEMINI_API_KEY=your_gemini_key
```

Restart the dev server after adding keys.

### Database Schema (Supabase)

Open Supabase SQL editor and run the SQL at `supabase/schema.sql`. It creates:

- `public.searches` — records analysis requests by user
- `public.analysis_reports` — stores status and report JSON

Row Level Security (RLS) policies restrict access to the requesting user.

### API Endpoints

- `POST /api/analyze` — body: `{ ticker, asset_type: 'stock' | 'crypto', investment_level: 1..5 }`
  - Creates a search and a pending report, runs the analysis in background, and returns `{ search_id, report_id }` immediately.
- `GET /api/report?id=...` — returns the latest status and `report_data` when completed.

