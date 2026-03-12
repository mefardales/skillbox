---
name: alpine-js
description: >
  Alpine.js best practices for lightweight interactivity in server-rendered
  HTML. Use this skill when adding reactive behavior to pages without a full
  SPA framework. Covers core directives, component patterns, stores, plugins,
  HTMX integration, and transition animations.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: frontend
  tags: alpine, javascript, lightweight, reactive, html
---

# Alpine.js Best Practices

## Core Directives

Use `x-data` to declare a reactive scope. Keep data objects small and focused on a single UI concern.

```html
<div x-data="{ open: false }">
  <button @click="open = !open" :aria-expanded="open">Menu</button>
  <ul x-show="open" @click.outside="open = false" x-transition>
    <li><a href="/profile">Profile</a></li>
    <li><a href="/settings">Settings</a></li>
  </ul>
</div>
```

Use `x-show` for toggling visibility (element stays in DOM, faster for frequent toggles). Use `x-if` only when you need to add/remove elements entirely for heavy content.

```html
<template x-if="isLoggedIn">
  <div>Welcome, <span x-text="username"></span></div>
</template>
```

Use `x-for` with a `:key` for lists. Always wrap in `<template>`.

```html
<template x-for="item in items" :key="item.id">
  <li x-text="item.name"></li>
</template>
```

## Component Patterns

Extract complex components into named functions with `Alpine.data()` to keep HTML clean and logic testable.

```js
Alpine.data('searchBox', () => ({
  query: '', results: [], loading: false,

  async search() {
    if (this.query.length < 2) { this.results = []; return; }
    this.loading = true;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(this.query)}`);
      this.results = await res.json();
    } catch { this.results = []; }
    finally { this.loading = false; }
  },

  select(result) {
    this.query = result.title;
    this.results = [];
    this.$dispatch('item-selected', { id: result.id });
  },
}));
```

```html
<div x-data="searchBox">
  <input x-model="query" @input.debounce.300ms="search">
  <template x-for="r in results" :key="r.id">
    <li x-text="r.title" @click="select(r)"></li>
  </template>
  <p x-show="loading">Searching...</p>
</div>
```

## Reactivity: $watch and x-effect

Use `$watch` for side effects on specific properties. Use `x-effect` for reactive expressions that auto-track dependencies.

```html
<div x-data="{ volume: 50 }" x-init="$watch('volume', v => localStorage.setItem('volume', v))">
  <input type="range" x-model.number="volume" min="0" max="100">
  <span x-text="volume + '%'"></span>
</div>
```

## Stores for Shared State

Use `Alpine.store()` for state shared across components. Access with `$store`.

```js
Alpine.store('notifications', {
  items: [],
  add(message, type = 'info') {
    const id = Date.now();
    this.items.push({ id, message, type });
    setTimeout(() => this.remove(id), 5000);
  },
  remove(id) { this.items = this.items.filter(n => n.id !== id); },
});
```

```html
<!-- Any component can trigger notifications -->
<button x-data @click="$store.notifications.add('Saved!', 'success')">Save</button>
```

## Plugins

Register plugins before `Alpine.start()`.

```js
import Alpine from 'alpinejs';
import mask from '@alpinejs/mask';
import intersect from '@alpinejs/intersect';
import persist from '@alpinejs/persist';
Alpine.plugin(mask); Alpine.plugin(intersect); Alpine.plugin(persist);
Alpine.start();
```

```html
<input x-mask="(999) 999-9999" placeholder="(555) 123-4567">

<div x-data="{ shown: false }" x-intersect.once="shown = true">
  <div x-show="shown" x-transition>Lazy content</div>
</div>

<div x-data="{ theme: $persist('light') }">
  <button @click="theme = theme === 'light' ? 'dark' : 'light'" x-text="'Theme: ' + theme"></button>
</div>
```

## Integration with HTMX

Use Alpine for client-side state and HTMX for server communication.

```html
<div x-data="{ editing: false }">
  <span x-show="!editing" id="name">{{ user.name }}</span>
  <button x-show="!editing" @click="editing = true">Edit</button>

  <form x-show="editing" hx-put="/users/{{ user.id }}/name" hx-target="#name"
        @htmx:after-swap.window="editing = false">
    <input name="name" value="{{ user.name }}">
    <button type="submit">Save</button>
    <button type="button" @click="editing = false">Cancel</button>
  </form>
</div>
```

## Transitions

Use `x-transition` for enter/leave animations. Customize with Tailwind-style classes.

```html
<div x-show="open"
     x-transition:enter="transition ease-out duration-200"
     x-transition:enter-start="opacity-0 -translate-y-2"
     x-transition:enter-end="opacity-100 translate-y-0"
     x-transition:leave="transition ease-in duration-150"
     x-transition:leave-start="opacity-100"
     x-transition:leave-end="opacity-0">
  Dropdown content
</div>
```

## Common Pitfalls

Do not nest `x-data` scopes unnecessarily. Use `$dispatch` to communicate between siblings. Do not use Alpine for heavy data-driven SPAs -- it is designed for enhancing server-rendered HTML. Always call `Alpine.start()` after registering all components and plugins.
