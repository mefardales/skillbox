---
name: nextjs-app-router
description: >
  Next.js App Router patterns including server components, data fetching,
  routing, layouts, and caching strategies. Use this skill when building
  or maintaining Next.js 13+ applications with the App Router. Covers
  server vs client components, streaming, metadata, and deployment patterns.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: frontend
  tags: nextjs, react, server-components, app-router, ssr
---

# Next.js App Router Patterns

## Server vs Client Components

Components in the App Router are Server Components by default. Only add `'use client'` when the component needs interactivity, browser APIs, or React hooks that depend on client state.

**Keep as Server Components:**
- Data fetching and display
- Access to backend resources (database, filesystem)
- Components that render static or server-fetched content

**Mark as Client Components (`'use client'`):**
- Event handlers (onClick, onChange, onSubmit)
- useState, useEffect, useReducer, useRef with DOM interaction
- Browser-only APIs (localStorage, window, IntersectionObserver)

Push `'use client'` as far down the tree as possible. Wrap only the interactive leaf, not the entire page.

```tsx
// app/dashboard/page.tsx (Server Component)
import { InteractiveFilter } from './InteractiveFilter';

export default async function DashboardPage() {
  const data = await fetchDashboardData();
  return (
    <div>
      <h1>Dashboard</h1>
      <InteractiveFilter /> {/* Only this is a Client Component */}
      <StaticDataTable data={data} />
    </div>
  );
}
```

## Data Fetching

Fetch data directly in Server Components using `async/await`. Do not use `useEffect` for data fetching in server-rendered pages.

```tsx
// app/users/page.tsx
async function getUsers() {
  const res = await fetch('https://api.example.com/users', {
    next: { revalidate: 60 }, // ISR: revalidate every 60 seconds
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json() as Promise<User[]>;
}

export default async function UsersPage() {
  const users = await getUsers();
  return <UserList users={users} />;
}
```

- Use `cache: 'force-cache'` (default) for static data.
- Use `cache: 'no-store'` for real-time data that must be fresh on every request.
- Use `next: { revalidate: N }` for time-based ISR.
- Use `revalidatePath()` or `revalidateTag()` in Server Actions for on-demand revalidation.
- For database queries, use `unstable_cache` or React's `cache()` to deduplicate within a request.

## Routing and Layouts

- `layout.tsx` wraps child routes and preserves state across navigation. Use for shared UI (nav, sidebar).
- `page.tsx` is the unique content for a route segment.
- `loading.tsx` provides instant loading UI using React Suspense.
- `error.tsx` (must be `'use client'`) catches errors in a route segment.
- `not-found.tsx` handles 404s. Trigger with `notFound()` from `next/navigation`.

```
app/
  layout.tsx          # Root layout (html, body, global providers)
  page.tsx            # Home page
  dashboard/
    layout.tsx        # Dashboard layout (sidebar)
    page.tsx          # /dashboard
    settings/
      page.tsx        # /dashboard/settings
  (auth)/
    login/page.tsx    # /login (grouped without affecting URL)
    register/page.tsx # /register
```

- Use route groups `(groupName)` to organize without affecting the URL.
- Use `[slug]` for dynamic segments and `[...slug]` for catch-all segments.
- Use `@modal` parallel routes for modal patterns that preserve URL state.

## Server Actions

Use Server Actions for form submissions and data mutations. Define them with `'use server'` at the top of the function or file.

```tsx
// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  await db.post.create({ data: { title, content } });
  revalidatePath('/posts');
}
```

- Validate all inputs in Server Actions. Never trust client data.
- Use `useFormStatus` for pending states and `useFormState` for returned errors.
- Server Actions can be called from Client Components via form `action` or direct invocation.
- Return serializable data only (no class instances, functions, or Dates).

## Metadata and SEO

Use the `metadata` export or `generateMetadata` for dynamic metadata.

```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug);
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { images: [post.coverImage] },
  };
}
```

- Define a root `metadata` in `app/layout.tsx` with defaults (title template, description).
- Use `title: { template: '%s | MySite', default: 'MySite' }` for consistent page titles.

## Streaming and Suspense

Use `loading.tsx` or manual `<Suspense>` boundaries to stream content progressively.

```tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <>
      <h1>Dashboard</h1>
      <Suspense fallback={<ChartSkeleton />}>
        <SlowChart />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <SlowDataTable />
      </Suspense>
    </>
  );
}
```

## Middleware

Use `middleware.ts` at the project root for authentication checks, redirects, and header manipulation. Keep middleware fast -- do not run heavy logic or database queries.

```tsx
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session');
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = { matcher: ['/dashboard/:path*'] };
```

## Common Pitfalls

- Do not import server-only code in Client Components. Use the `server-only` package to enforce boundaries.
- Do not pass non-serializable props (functions, class instances) from Server to Client Components.
- Do not use `useRouter` from `next/router` -- use `next/navigation` in the App Router.
- Avoid excessive `'use client'` boundaries. Each one creates a new client bundle entry point.
