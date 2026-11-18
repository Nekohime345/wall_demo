# The little wall

A sunny message wall built with Next.js App Router, React, Tailwind CSS, shadcn-style UI primitives, and Supabase. New posts appear at the top and Supabase Realtime updates the feed as people share. Without Supabase variables, the app runs a browser-local preview.

## Run locally

```sh
npm install
npm run dev
```

## Connect Supabase

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor. It creates the `posts` table and optional `image_url` field, enables row level security, adds anonymous read and insert policies, adds the table to Realtime, and creates the public `wall-photos` Storage bucket with a 5 MB image limit.
3. Copy `.env.example` to `.env.local` and fill in the Project URL and publishable key from the project's **Connect** dialog or **Project Settings → API Keys**. The app also accepts a legacy anon key via `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Restart Next.js. The feed fetches the newest 50 posts and subscribes to new post events. Visitors can optionally attach a JPG, PNG, or GIF photo (up to 5 MB) to a message.

Visitors choose a display name; it is remembered in that browser, and no account is needed. The public insert policy accepts non-empty names up to 40 characters. Since names are not authenticated, visitors can choose any name. Add rate limiting or another abuse control before opening a high-traffic public site.

Replace [`public/profile-placeholder.svg`](public/profile-placeholder.svg) with your own profile photo (or update its `src` in `src/App.jsx`). The composer keeps the poster name separate from the message body. Photo uploads use the public Supabase Storage bucket named `wall-photos`; if upload fails, run the SQL setup above and confirm that bucket exists.

## Deploy to Vercel

Push the project to GitHub, import it in Vercel, and add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the project's Environment Variables. Vercel will detect Next.js and use `npm run build`.

The publishable/anon key is designed for browser use. Never expose a Supabase service role key in a `NEXT_PUBLIC_` variable.
