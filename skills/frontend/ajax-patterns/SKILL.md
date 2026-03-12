---
name: ajax-patterns
description: >
  Modern AJAX and Fetch API patterns for client-server communication.
  Use this skill when building data fetching layers, handling file uploads,
  implementing real-time updates, or maintaining legacy jQuery AJAX code.
  Covers fetch best practices, cancellation, retries, SSE, WebSockets,
  and CORS handling.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: frontend
  tags: ajax, fetch, http, async, javascript
---

# Modern AJAX Patterns

## Fetch API Best Practices

Always check `response.ok` because `fetch` does not reject on HTTP errors. Wrap requests in a typed helper.

```typescript
class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text() || res.statusText);
  if (res.status === 204) return undefined as T;
  return res.json();
}
```

## AbortController for Cancellation

Cancel requests on component unmount or when a new request supersedes the previous one.

```typescript
function useUserSearch(query: string) {
  const [results, setResults] = useState<User[]>([]);

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const controller = new AbortController();

    apiFetch<User[]>(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then(setResults)
      .catch(err => { if (err.name !== 'AbortError') console.error(err); });

    return () => controller.abort();
  }, [query]);
  return results;
}
```

## Retry with Exponential Backoff

Retry on transient errors (network failures, 5xx). Do not retry 4xx because they indicate client mistakes.

```typescript
async function fetchWithRetry<T>(url: string, opts: RequestInit = {}, maxRetries = 3): Promise<T> {
  let lastErr: Error | null = null;
  for (let i = 0; i <= maxRetries; i++) {
    try { return await apiFetch<T>(url, opts); }
    catch (err) {
      lastErr = err as Error;
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) throw err;
      if (i < maxRetries) await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000 + Math.random() * 500));
    }
  }
  throw lastErr;
}
```

## Request Deduplication

Share pending promises for the same resource to prevent duplicate in-flight requests.

```typescript
const pending = new Map<string, Promise<any>>();

async function deduped<T>(url: string, opts?: RequestInit): Promise<T> {
  const key = `${opts?.method || 'GET'}:${url}`;
  if (pending.has(key)) return pending.get(key)!;
  const promise = apiFetch<T>(url, opts).finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
```

## Optimistic UI Updates

Update the UI immediately, then reconcile or rollback on server response.

```typescript
async function toggleFavorite(itemId: string) {
  const prev = getItem(itemId).isFavorite;
  updateItem(itemId, { isFavorite: !prev }); // optimistic
  try {
    await apiFetch(`/api/items/${itemId}/favorite`, { method: prev ? 'DELETE' : 'POST' });
  } catch {
    updateItem(itemId, { isFavorite: prev }); // rollback
    showError('Failed to update. Please retry.');
  }
}
```

## Polling vs SSE vs WebSockets

Use **polling** for low-frequency updates. Use **SSE** for server-to-client streaming. Use **WebSockets** for bidirectional real-time communication.

```typescript
// SSE
function subscribe(url: string, onMessage: (data: any) => void) {
  const source = new EventSource(url);
  source.onmessage = (e) => onMessage(JSON.parse(e.data));
  source.onerror = () => console.error('SSE lost, auto-reconnecting...');
  return () => source.close();
}

// WebSocket with reconnect
function createSocket(url: string, onMessage: (msg: any) => void) {
  let ws: WebSocket, retries = 0;
  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => { retries = 0; };
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onclose = () => setTimeout(connect, Math.min(1000 * Math.pow(2, retries++), 30000));
  }
  connect();
  return { send: (d: any) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(d)), close: () => { retries = Infinity; ws.close(); } };
}
```

## File Upload with Progress

Use `FormData` for uploads. Do not set `Content-Type` manually -- the browser sets the multipart boundary.

```typescript
function uploadFile(file: File, onProgress?: (pct: number) => void): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('file', file);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round(e.loaded / e.total * 100));
    xhr.onload = () => xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(`Upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.open('POST', '/api/upload');
    xhr.send(fd);
  });
}
```

## CORS Handling

Configure CORS on the server, not the client. Do not use `Access-Control-Allow-Origin: *` with `credentials: 'include'`.

```typescript
// Server (Express)
app.use(cors({
  origin: ['https://myapp.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Client
fetch('https://api.example.com/data', { credentials: 'include' });
```

## jQuery AJAX (Legacy)

Use these patterns when maintaining existing jQuery code. Do not introduce jQuery for new projects.

```javascript
$.ajaxSetup({ headers: { 'X-CSRFToken': getCsrfToken() } });

$.ajax({
  url: '/api/orders',
  method: 'POST',
  contentType: 'application/json',
  data: JSON.stringify({ items: cart.getItems() }),
  success: function(order) { window.location.href = '/orders/' + order.id; },
  error: function(jqXHR) { showErrors(jqXHR.responseJSON?.errors); },
});
```

## Common Pitfalls

Do not forget that `fetch` only rejects on network failure, not on 4xx/5xx. Do not cache POST/PUT/DELETE responses. Do not send credentials to untrusted origins.
