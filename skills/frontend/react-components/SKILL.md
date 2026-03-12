---
name: react-components
description: >
  React component best practices with hooks, TypeScript, and modern patterns.
  Use this skill when building, refactoring, or reviewing React components.
  Covers component structure, state management, performance optimization,
  custom hooks, and TypeScript integration for production-quality React code.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: frontend
  tags: react, typescript, hooks, components, frontend
---

# React Component Best Practices

## Component Structure

Always use functional components with TypeScript. Define explicit prop interfaces above the component.

```tsx
interface UserCardProps {
  user: User;
  onSelect?: (userId: string) => void;
  variant?: 'compact' | 'detailed';
}

export function UserCard({ user, onSelect, variant = 'compact' }: UserCardProps) {
  // component body
}
```

- Export components as named exports, not default exports. This improves refactoring and auto-imports.
- One component per file. Co-locate sub-components only if they are tightly coupled and not reused elsewhere.
- Place the file in a directory matching its domain: `features/auth/LoginForm.tsx`, not `components/LoginForm.tsx` for feature-specific components. Use `components/` only for truly shared UI primitives.

## Props Design

- Use discriminated unions for components with mode-dependent props:
  ```tsx
  type ButtonProps =
    | { variant: 'link'; href: string; onClick?: never }
    | { variant: 'button'; onClick: () => void; href?: never };
  ```
- Prefer specific props over passing entire objects when only a few fields are needed.
- Use `children: React.ReactNode` for composition. Prefer composition over configuration props.
- Avoid boolean props that control branching logic. Use a `variant` or `mode` string union instead.
- Spread remaining props onto the root element using `ComponentPropsWithoutRef<'div'>` for wrapper components.

## Hooks Guidelines

- Extract logic into custom hooks when it involves state + effects or is reused across components.
- Name custom hooks descriptively: `useUserPermissions`, not `usePermissions`.
- Custom hooks should return objects (not arrays) when returning more than 2 values.
- Always include a cleanup function in `useEffect` when subscribing to events, timers, or external stores.
- Never call hooks conditionally. Move conditional logic inside the hook body.

```tsx
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
```

## State Management

- Start with local state (`useState`). Lift state up only when siblings need to share it.
- Use `useReducer` when state transitions are complex or when next state depends on previous state.
- Use React Context for dependency injection (themes, auth, i18n), NOT for frequently changing state.
- For server state, use TanStack Query (React Query) or SWR. Never store server data in global state.
- Derive values from state instead of storing computed data. Use `useMemo` only when the derivation is expensive.

## Performance

- Avoid premature optimization. Measure first with React DevTools Profiler.
- Use `React.memo()` only on components that re-render often with the same props.
- Use `useCallback` for functions passed to memoized children or used in dependency arrays.
- Use `useMemo` for expensive computations, not for simple object/array creation.
- Virtualize long lists with `@tanstack/react-virtual` instead of rendering all items.
- Split large components to isolate state changes. A parent re-render re-renders all children.

## Error Handling

- Wrap feature boundaries with Error Boundaries. Create a reusable `ErrorBoundary` component.
- Use `react-error-boundary` for declarative error boundaries with reset capabilities.
- Handle loading, error, and empty states explicitly in every data-fetching component.

## TypeScript Patterns

- Use `as const` for constant arrays and objects used in type derivation.
- Prefer `interface` for component props (extendable). Use `type` for unions and intersections.
- Type event handlers explicitly: `React.ChangeEvent<HTMLInputElement>`, not `any`.
- Use generic components when the component works with various data types:
  ```tsx
  interface ListProps<T> {
    items: T[];
    renderItem: (item: T) => React.ReactNode;
    keyExtractor: (item: T) => string;
  }
  ```

## File Organization

```
src/
  components/        # Shared UI primitives (Button, Modal, Input)
  features/          # Feature modules, each with its own components/hooks
    auth/
      LoginForm.tsx
      useAuth.ts
  hooks/             # Shared custom hooks
  types/             # Shared TypeScript types
  utils/             # Pure utility functions
```

## Testing Considerations

- Components should be testable without mocking internal implementation.
- Accept dependencies via props or context to make testing straightforward.
- Keep side effects in hooks, keep rendering logic in components. This separation aids testing.
