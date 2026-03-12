---
name: tailwind-css
description: >
  Tailwind CSS best practices for responsive design, component styling,
  and maintainable utility-first CSS. Use this skill when styling UI
  components, building responsive layouts, or establishing design system
  patterns with Tailwind CSS v3+.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: frontend
  tags: tailwind, css, responsive, styling, design-system
---

# Tailwind CSS Best Practices

## Core Principles

Tailwind is utility-first. Apply styles directly in markup. Avoid creating custom CSS classes unless you are building a reusable design token or animation that cannot be expressed with utilities.

- Write utilities in a consistent order: layout, sizing, spacing, typography, colors, effects.
- Use the design system values (spacing scale, color palette) instead of arbitrary values.
- When arbitrary values are necessary, use the bracket syntax: `w-[calc(100%-2rem)]`, `text-[#1a1a2e]`.

## Responsive Design

Tailwind uses mobile-first breakpoints. Write base styles for mobile, then add breakpoint prefixes for larger screens.

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- Stacks on mobile, 2 cols on tablet, 3 cols on desktop -->
</div>
```

Default breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), `2xl` (1536px).

- Always start with the mobile layout and enhance upward.
- Use `container mx-auto px-4` for consistent page width with padding.
- Use `max-w-screen-xl` to cap content width on very large screens.
- Use responsive display utilities: `hidden md:block` to show/hide elements by breakpoint.

## Component Patterns

### Extracting Repeated Styles

When the same combination of utilities repeats across multiple instances, extract it into a component (React, Vue, etc.), NOT into a CSS class. The component is the abstraction.

```tsx
function Badge({ children, color = 'blue' }: BadgeProps) {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-800',
    red: 'bg-red-100 text-red-800',
    green: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[color]}`}>
      {children}
    </span>
  );
}
```

### Conditional Classes

Use `clsx` or `tailwind-merge` for conditional and merged class names.

```tsx
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

// Utility function used throughout the project
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
<button className={cn(
  'rounded-lg px-4 py-2 font-medium transition-colors',
  variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
  variant === 'secondary' && 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  disabled && 'opacity-50 cursor-not-allowed'
)}>
```

Always use `tailwind-merge` when composing classes from multiple sources (component defaults + caller overrides) to resolve conflicts correctly.

## Layout Patterns

### Flexbox

```html
<!-- Centered content -->
<div class="flex items-center justify-center min-h-screen">

<!-- Space between with wrapping -->
<div class="flex flex-wrap items-center justify-between gap-4">

<!-- Sidebar layout -->
<div class="flex">
  <aside class="w-64 shrink-0">Sidebar</aside>
  <main class="flex-1 min-w-0">Content</main>
</div>
```

### Grid

```html
<!-- Auto-fill responsive grid -->
<div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">

<!-- Dashboard layout with named areas -->
<div class="grid grid-cols-4 grid-rows-[auto_1fr_auto] gap-4 min-h-screen">
```

- Use `min-w-0` on flex children to prevent overflow from long text.
- Use `gap-*` instead of margins between flex/grid children.

## Dark Mode

Use the `dark:` variant. Configure `darkMode: 'class'` in `tailwind.config.js` for manual toggle support.

```html
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
```

- Define semantic color variables in your config rather than scattering `dark:` overrides.
- Test both modes when building components. Do not add dark mode as an afterthought.

## Typography

- Use the `@tailwindcss/typography` plugin for prose content (`class="prose"`).
- Set font families in `tailwind.config.js` under `theme.extend.fontFamily`.
- Use `text-balance` for headings, `text-pretty` for body text (where supported).
- Limit line length with `max-w-prose` or `max-w-2xl` for readability.

## Spacing and Sizing

- Use the spacing scale consistently: `p-4` (1rem), `p-6` (1.5rem), etc.
- For padding inside cards/sections, use `p-4 sm:p-6` for responsive internal spacing.
- Use `space-y-*` for vertical stacking or `gap-*` in flex/grid contexts (prefer `gap`).
- Use `size-*` (Tailwind v3.4+) as shorthand for equal width and height: `size-10` = `w-10 h-10`.

## Animations and Transitions

```html
<!-- Smooth hover transition -->
<button class="transition-colors duration-150 hover:bg-blue-700">

<!-- Entry animation -->
<div class="animate-in fade-in slide-in-from-bottom-4 duration-300">
```

- Use `transition-*` for interactive state changes (hover, focus).
- Use `duration-150` or `duration-200` for UI interactions. Avoid durations above 300ms for hover effects.
- Prefer CSS transitions over JavaScript animations for performance.

## Accessibility

- Always ensure sufficient color contrast. Do not rely solely on color to convey meaning.
- Use `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none` for keyboard focus indicators.
- Use `sr-only` for screen-reader-only content.
- Never remove focus indicators (`outline-none`) without providing a visible alternative.

## Configuration

Keep `tailwind.config.js` organized:

```js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#f0f9ff', 500: '#3b82f6', 900: '#1e3a5f' },
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};
```

- Extend the default theme rather than overriding it.
- Define project-specific colors under a brand namespace.
- Keep the `content` paths accurate to avoid missing or bloated CSS.

## Performance

- Tailwind purges unused styles in production automatically. Ensure `content` paths cover all template files.
- Avoid dynamically constructing class names from variables: `bg-${color}-500` will not be detected. Use complete class strings in a map instead.
- Use `@apply` sparingly. It defeats the purpose of utility-first and makes styles harder to trace.
