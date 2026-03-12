---
name: htmx
description: >
  HTMX best practices for building hypermedia-driven web applications.
  Use this skill when replacing JSON APIs with HTML-over-the-wire patterns,
  adding dynamic behavior to server-rendered pages, or integrating HTMX
  with Django, Flask, or Rails backends. Covers core attributes, swap
  strategies, SSE, WebSockets, and Alpine.js integration.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: frontend
  tags: htmx, hypermedia, html, ajax, server-driven
---

# HTMX Best Practices

## Core Attributes

Use `hx-get`, `hx-post`, `hx-put`, `hx-delete` for HTTP requests from any element. Use `hx-target` for where the response goes and `hx-swap` for how it replaces content.

```html
<button hx-get="/api/notifications" hx-target="#panel" hx-swap="innerHTML">
  Load Notifications
</button>
<div id="panel"></div>

<form hx-post="/contacts" hx-target="#list" hx-swap="beforeend" hx-on::after-request="this.reset()">
  <input name="name" required>
  <input name="email" required>
  <button type="submit">Add</button>
</form>
```

Use `hx-trigger` to control when requests fire:

```html
<!-- Debounced search -->
<input hx-get="/search" hx-trigger="input changed delay:300ms" hx-target="#results">

<!-- Infinite scroll -->
<div hx-get="/items?page=2" hx-trigger="revealed" hx-swap="afterend">Loading...</div>

<!-- Polling -->
<div hx-get="/status" hx-trigger="every 5s">Checking...</div>
```

## Swap Strategies

Use `innerHTML` (default) for replacing children. Use `outerHTML` for replacing the element itself. Use `beforeend`/`afterbegin` for appending/prepending.

```html
<!-- Delete: replace element with empty response -->
<div id="card-1">
  <button hx-delete="/cards/1" hx-target="#card-1" hx-swap="outerHTML">Delete</button>
</div>

<!-- Smooth transitions -->
<button hx-get="/content" hx-target="#main" hx-swap="innerHTML transition:true settle:300ms">
  Navigate
</button>
```

## Boost and Progressive Enhancement

Use `hx-boost="true"` to convert normal links/forms to AJAX automatically. The page works without JavaScript because links function normally.

```html
<nav hx-boost="true">
  <a href="/dashboard">Dashboard</a>
  <a href="/settings">Settings</a>
</nav>
```

## Loading Indicators

Use `hx-indicator` for spinners and `hx-disabled-elt` to prevent double submissions.

```html
<style>
  .htmx-indicator { display: none; }
  .htmx-request .htmx-indicator { display: inline-block; }
</style>

<button hx-post="/orders" hx-indicator="#spinner" hx-disabled-elt="this">
  Place Order <span id="spinner" class="htmx-indicator">...</span>
</button>
```

## Request and Response Headers

Use `HX-Trigger` response headers to fire client-side events from the server:

```python
# Django
def delete_contact(request, pk):
    Contact.objects.filter(pk=pk).delete()
    response = HttpResponse(status=200)
    response['HX-Trigger'] = 'contactDeleted'
    return response
```

```html
<div hx-get="/contacts/count" hx-trigger="contactDeleted from:body">Count: {{ count }}</div>
```

Use `HX-Redirect` for server-initiated navigation. Check `HX-Request` to return partial HTML instead of full pages:

```python
def product_list(request):
    products = Product.objects.all()
    template = 'partials/list.html' if request.headers.get('HX-Request') else 'products/index.html'
    return render(request, template, {'products': products})
```

## Server-Sent Events

Use the SSE extension for real-time server-pushed updates:

```html
<div hx-ext="sse" sse-connect="/events/notifications" sse-swap="message">
  Waiting for notifications...
</div>
```

## Out-of-Band Swaps

Use `hx-swap-oob="true"` to update multiple page sections from a single response:

```html
<!-- Server response: primary content + OOB updates -->
<li>New todo item</li>
<span id="todo-count" hx-swap-oob="true">12 items</span>
```

## Backend Integration

### Django
```python
@require_http_methods(["DELETE"])
def delete_item(request, pk):
    Item.objects.filter(pk=pk, user=request.user).delete()
    return HttpResponse("")  # empty 200 removes element with outerHTML swap
```

### Flask
```python
@app.route('/items/<int:pk>', methods=['DELETE'])
def delete_item(pk):
    db.session.delete(Item.query.get_or_404(pk))
    db.session.commit()
    return "", 200
```

## HTMX + Alpine.js

Use Alpine for client-side state (toggles, modals) and HTMX for server communication:

```html
<div x-data="{ confirmOpen: false, targetId: null }">
  <button @click="confirmOpen = true; targetId = 1">Delete</button>

  <div x-show="confirmOpen" x-transition class="modal">
    <p>Are you sure?</p>
    <button hx-delete="/items" :hx-vals="JSON.stringify({id: targetId})"
            hx-target="#item-list" @click="confirmOpen = false">Confirm</button>
    <button @click="confirmOpen = false">Cancel</button>
  </div>
</div>
```

## Common Pitfalls

Do not return JSON from HTMX endpoints -- HTMX expects HTML fragments.

Do not forget CSRF tokens for POST/PUT/DELETE. Configure globally:

```html
<meta name="csrf-token" content="{{ csrf_token }}">
<script>
document.body.addEventListener('htmx:configRequest', (e) => {
  e.detail.headers['X-CSRFToken'] = document.querySelector('meta[name="csrf-token"]').content;
});
</script>
```

Do not make requests to external APIs directly from HTMX. Proxy through your own server to avoid CORS issues and maintain hypermedia architecture.
