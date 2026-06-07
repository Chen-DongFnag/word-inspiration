<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Quick reference

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- No test framework is configured. No `test` script exists.
- Language: Chinese (zh-CN). Keep UI text in Chinese.

# Tech stack

- Next.js 16.2.6 (App Router, `src/app/` directory)
- React 19.2.4, Tailwind CSS v4 (`@tailwindcss/postcss` plugin), TypeScript 5
- d3-force for canvas-based mind map visualization
- ESLint 9 with flat config (`eslint.config.mjs`)

# Architecture

Single-package Next.js app. Two visualization components exist:

- `src/components/MindMap.tsx` — **active**. Canvas-based force-directed graph (d3-force). This is the main UI rendered by `src/app/page.tsx`.
- `src/components/WordTree.tsx` — **unused alternative**. Tree-based DOM view. Not imported anywhere in the app routes.
- `src/app/api/expand/route.ts` — POST endpoint. Calls an AI API (小米 MiMo) to generate 6 related words for a given input word. Has in-memory 5-min cache.
- `src/types/index.ts` — shared types (`WordNode`, `ExpandRequest`, `ExpandResponse`).

# Environment

Requires `.env.local` (copy from `.env.example`):

```
AI_API_KEY=your-api-key-here
AI_API_BASE_URL=https://api.xiaomimimo.com/v1
AI_MODEL=mimo-v2.5
```

The app returns a 400 error if `AI_API_KEY` is missing or still the placeholder value.

# Path alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`). Use `@/components/...`, `@/types/...`, etc.

# Deployment

Deployed on Vercel. Build/install commands are in `vercel.json`.
