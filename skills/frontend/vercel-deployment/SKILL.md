---
name: vercel-deployment
description: >
  Vercel deployment best practices for frontend and fullstack applications.
  Use this skill when configuring deployments, serverless/edge functions,
  caching strategies, or custom domains on Vercel. Covers vercel.json
  configuration, environment management, ISR, and monorepo support.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: frontend
  tags: vercel, deployment, serverless, edge, hosting
---

# Vercel Deployment Best Practices

## Project Configuration

Use `vercel.json` at the project root. Do not rely on dashboard settings alone because they are not version-controlled.

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "headers": [
    { "source": "/api/(.*)", "headers": [{ "key": "Cache-Control", "value": "no-store" }] },
    { "source": "/(.*)\\.(?:js|css|woff2)$", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```

## Environment Variables

Scope variables to `production`, `preview`, and `development`. Do not commit `.env` files with real secrets. Prefix client-exposed variables with `NEXT_PUBLIC_` (Next.js) or `VITE_` (Vite) -- server-only secrets must never use these prefixes.

```bash
vercel env add DATABASE_URL production
vercel env pull .env.local
```

## Serverless Functions

Place API routes in `api/` or `app/api/`. Keep functions small to reduce cold starts.

```ts
// api/users.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const users = await fetchUsers();
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  return res.status(200).json(users);
}
```

## Edge Functions

Use Edge Functions for latency-sensitive logic close to users. They lack full Node.js APIs (`fs`, etc.) but start faster than serverless.

```ts
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.geo?.country === 'DE') {
    return NextResponse.redirect(new URL('/de', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next/static|favicon.ico).*)'] };
```

## Preview Deployments

Every non-production push creates a preview URL. Use `VERCEL_ENV` to differentiate behavior:

```ts
const isPreview = process.env.VERCEL_ENV === 'preview';
const dbUrl = isPreview ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
```

## Redirects and Rewrites

Use rewrites for API proxying (avoids CORS). Use redirects for permanent URL changes.

```json
{
  "redirects": [{ "source": "/blog/:slug", "destination": "/posts/:slug", "permanent": true }],
  "rewrites": [{ "source": "/api/ext/:path*", "destination": "https://api.example.com/:path*" }]
}
```

## ISR and Caching

Use ISR to serve static pages that revalidate in the background. Do not set `revalidate` too low or you lose the caching benefit.

```tsx
// app/products/[id]/page.tsx
export const revalidate = 3600; // revalidate every hour

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  return <ProductDetail product={product} />;
}
```

On-demand revalidation for webhooks:

```ts
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  const { path, secret } = await request.json();
  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 });
  }
  revalidatePath(path);
  return Response.json({ revalidated: true });
}
```

## Monorepo Support

Use `ignoreCommand` to skip rebuilds when a project's files have not changed:

```json
{
  "rootDirectory": "apps/web",
  "ignoreCommand": "npx turbo-ignore"
}
```

## Performance Optimization

Use the Next.js `<Image>` component for automatic WebP/AVIF, responsive sizing, and lazy loading. Use `priority` only for above-the-fold images.

```tsx
import Image from 'next/image';
<Image src="/hero.jpg" alt="Hero" width={1200} height={630} priority />
```

## Common Pitfalls

Do not use `getServerSideProps` for infrequently changing data -- use ISR instead because SSR forces every request through serverless, increasing latency and cost.

Do not store session state in serverless functions. They are stateless. Use Redis or Vercel KV.

Do not exceed the 50MB function size limit. Tree-shake dependencies:

```ts
// Bad: imports entire library
import _ from 'lodash';
// Good: import only what you need
import groupBy from 'lodash/groupBy';
```
