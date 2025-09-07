# ai-hots-frontend

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

### Dynamic Import Cache Busting

## Asset Cleanup Script

Old hashed bundle generations are retained to avoid transient 404s during user reloads. Run:

```
npm run clean:assets:dry   # show what would be deleted (keeps latest 3 per logical chunk)
npm run clean:assets       # perform deletion
```

Use `build:clean` to build then prune in one step.

## Tests

Vitest is configured. Example:

```
To mitigate stale HTML MIME errors when users have an older entry HTML that references now-missing hashed chunks:
```

Current coverage focuses on `apiClient` fallback logic. Add more tests under `tests/`.

- `vite.config.js` sets `emptyOutDir: false` so previous hashed JS/CSS files remain after build.
- A global listener in `src/main.js` detects failed dynamic import errors and forces a one-time hard reload with a `?v=<timestamp>` query param to bypass caches.
  Periodically clean obsolete assets (manual or CI script) if storage usage grows.

"# ai-hots-platform"
