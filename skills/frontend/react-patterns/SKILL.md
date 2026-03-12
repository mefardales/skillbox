---
name: react-patterns
description: >
  Advanced React patterns beyond basic component building. Use this skill
  when designing complex component APIs, managing shared state, optimizing
  renders, or working with Server Components and Suspense. Covers compound
  components, hooks composition, context patterns, and memoization.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: frontend
  tags: react, patterns, hooks, advanced, state
---

# Advanced React Patterns

## Compound Components

Use compound components when child components share implicit state with a parent. This gives consumers flexible composition without prop drilling.

```tsx
const AccordionContext = createContext<{ openIndex: number | null; toggle: (i: number) => void } | null>(null);

function useAccordion() {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('Must be used within <Accordion>');
  return ctx;
}

export function Accordion({ children }: { children: ReactNode }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const toggle = (i: number) => setOpenIndex(prev => (prev === i ? null : i));
  return (
    <AccordionContext.Provider value={{ openIndex, toggle }}>
      <div role="region">{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  const { openIndex, toggle } = useAccordion();
  return (
    <div>
      <button onClick={() => toggle(index)} aria-expanded={openIndex === index}>{title}</button>
      {openIndex === index && <div>{children}</div>}
    </div>
  );
}
```

## Context + useReducer for State Management

Use `useReducer` with Context for complex state transitions. Split state and dispatch contexts to prevent unnecessary re-renders in dispatch-only consumers.

```tsx
type CartAction = { type: 'ADD_ITEM'; id: string } | { type: 'REMOVE_ITEM'; id: string } | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i.id === action.id);
      if (existing) return { items: state.items.map(i => i.id === action.id ? { ...i, qty: i.qty + 1 } : i) };
      return { items: [...state.items, { id: action.id, qty: 1 }] };
    }
    case 'REMOVE_ITEM': return { items: state.items.filter(i => i.id !== action.id) };
    case 'CLEAR': return { items: [] };
  }
}

const CartStateCtx = createContext<CartState>({ items: [] });
const CartDispatchCtx = createContext<Dispatch<CartAction>>(() => {});

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  return (
    <CartDispatchCtx.Provider value={dispatch}>
      <CartStateCtx.Provider value={state}>{children}</CartStateCtx.Provider>
    </CartDispatchCtx.Provider>
  );
}
```

## React Server Components

Use Server Components (default in Next.js App Router) for data fetching. Move interactivity into small Client Components. Do not add `"use client"` unless the component uses hooks, event handlers, or browser APIs.

```tsx
// app/products/page.tsx — Server Component
export default async function ProductsPage() {
  const products = await db.product.findMany(); // direct DB access
  return (
    <ul>
      {products.map(p => (
        <li key={p.id}><h2>{p.name}</h2><AddToCartButton productId={p.id} /></li>
      ))}
    </ul>
  );
}

// app/products/add-to-cart-button.tsx — Client Component
'use client';
export function AddToCartButton({ productId }: { productId: string }) {
  const dispatch = useCartDispatch();
  return <button onClick={() => dispatch({ type: 'ADD_ITEM', id: productId })}>Add</button>;
}
```

## Suspense and Error Boundaries

Wrap async operations with `<Suspense>` for loading states. Place boundaries at meaningful UI seams, not around every component.

```tsx
<ErrorBoundary fallback={<p>Failed to load metrics.</p>}>
  <Suspense fallback={<MetricsSkeleton />}>
    <Metrics />
  </Suspense>
</ErrorBoundary>
```

## Custom Hook Patterns

Build reusable hooks for cross-cutting concerns. Return stable function references with `useCallback`.

```tsx
function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function useLocalStorage<T>(key: string, initial: T) {
  const [stored, setStored] = useState<T>(() => {
    try { return JSON.parse(localStorage.getItem(key) || '') ?? initial; }
    catch { return initial; }
  });
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStored(prev => {
      const next = value instanceof Function ? value(prev) : value;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  return [stored, setValue] as const;
}
```

## Memoization: When to Actually Use It

Do not wrap every component in `React.memo`. Use it only when a component re-renders frequently with the same props and the render is expensive. Profile first with React DevTools.

```tsx
// Good use: expensive row in a frequently updating parent
const ExpensiveRow = React.memo(function ExpensiveRow({ item }: { item: Item }) {
  return <div>{/* complex rendering */}</div>;
});

function ProductList({ products, filter }: Props) {
  const filtered = useMemo(
    () => products.filter(p => p.category === filter).sort((a, b) => a.price - b.price),
    [products, filter]
  );
  return <ul>{filtered.map(p => <ExpensiveRow key={p.id} item={p} />)}</ul>;
}
```

Do not use `useMemo` for cheap operations like string concatenation. The memoization overhead outweighs the savings.

## Ref Forwarding and Imperative Handles

Use `forwardRef` for wrapper components that expose inner DOM elements. Use `useImperativeHandle` to expose a custom API.

```tsx
interface InputHandle { focus: () => void; clear: () => void; }

const FancyInput = forwardRef<InputHandle, { label: string }>(function FancyInput({ label }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => { if (inputRef.current) inputRef.current.value = ''; },
  }));
  return <label>{label}<input ref={inputRef} /></label>;
});
```

## Common Pitfalls

Do not create new objects in JSX props -- this defeats memoization:

```tsx
// Bad: new object every render
<Chart options={{ animate: true }} />
// Good: stable reference
const opts = useMemo(() => ({ animate: true }), []);
<Chart options={opts} />
```

Do not use index as `key` in lists that reorder or filter. Use a stable unique ID. Do not fetch data in `useEffect` without cancellation -- use React Query, SWR, or Server Components.
