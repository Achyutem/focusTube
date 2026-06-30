# FocusTube – CLAUDE.md

This file gives any future Claude session complete context to continue working on this project without additional explanation.

---

## Project Purpose

FocusTube is a **distraction-free YouTube study PWA**. It lets the user watch only the YouTube playlists they explicitly add, with zero access to YouTube's normal surfaces: no Home, no Shorts, no Search, no Trending, no Recommendations, no Comments.

It is a **100% static site** deployed on GitHub Pages. There is no backend, no server, no build step, no npm dependencies.

---

## Architecture

```
index.html         — single-page app shell, all HTML structure
style.css          — all styles, CSS custom properties for theming
app.js             — all application logic (vanilla ES6+)
manifest.json      — PWA manifest
service-worker.js  — offline shell caching
icons/             — PWA icons (192px, 512px)
assets/            — reserved for future static assets
CLAUDE.md          — this file
README.md          — user-facing documentation
```

No framework. No build step. No dependencies. Open `index.html` in a browser and it works.

---

## Coding Style

- Vanilla JS (ES6+): `const`/`let`, arrow functions, template literals, destructuring
- No TypeScript, no JSX, no bundler
- `'use strict'` at the top of `app.js`
- Functions are small and named descriptively
- DOM refs are captured once at module load, not re-queried on each render
- No comments unless the WHY is non-obvious
- CSS custom properties (`--bg`, `--text`, etc.) for all design tokens — never hardcode colors inline
- CSS classes follow BEM-lite naming: `.playlist-item`, `.playlist-item-btn`, `.playlist-item-actions`

---

## Design Principles

Inspired by Vercel's dashboard:

- Dark mode default (`--bg: #0a0a0a`)
- Monochrome palette — no colorful accents except danger red (`--danger: #e5484d`)
- Thin 1px borders (`--border: #262626`)
- Soft rounded corners (`--radius: 6px`, `--radius-lg: 10px`)
- Generous whitespace
- No shadows except modals
- Very subtle transitions (140ms)
- No icons from external CDNs — all SVG is inlined

---

## LocalStorage Structure

Single key: `focustube_data`

```json
{
  "playlists": [
    {
      "id": "pl_1719000000000_abc12",
      "name": "Physics Lectures",
      "playlistId": "PLxxxxxxxxxxxxxxxx"
    }
  ],
  "lastPlaylist": "pl_1719000000000_abc12",
  "theme": "dark"
}
```

- `id` — internal unique ID, format: `pl_<timestamp>_<random5>`
- `playlistId` — the raw YouTube playlist ID (the `list=` param value)
- `lastPlaylist` — ID of the last viewed playlist, restored on reload
- `theme` — `"dark"` or `"light"`

The `loadState()` / `saveState()` functions in `app.js` handle all reads and writes.

---

## Playlist URL Parsing

`extractPlaylistId(input)` in `app.js`:

1. Tries to match `[?&]list=([A-Za-z0-9_-]+)` against the input string
2. If no match, treats the bare string as a playlist ID if it matches `/^[A-Za-z0-9_-]{10,}$/`
3. Returns `null` if neither matches

Supported input formats:
- `https://www.youtube.com/playlist?list=PLxxxxxx`
- `https://youtube.com/playlist?list=PLxxxxxx`
- `PLxxxxxx` (bare ID)

---

## YouTube Embed

Uses the official YouTube Embedded Player only. No unofficial APIs, no scraping.

Embed URL format:
```
https://www.youtube.com/embed/videoseries?list=PLAYLIST_ID&rel=0
```

`videoseries` is required — `?listType=playlist&list=ID` only loads the first video without the playlist panel.

The `<iframe>` has `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"` and `allowfullscreen`.

The iframe `src` is only updated when the selected playlist actually changes (guarded by `if (youtubePlayer.src !== newSrc)`).

Ads: not blocked, not bypassed. YouTube handles ads natively.

---

## PWA

- `manifest.json` — installability metadata, `display: standalone`
- `service-worker.js` — caches the app shell (HTML, CSS, JS, manifest, icons)
- SW strategy: cache-first for shell assets; network passthrough for YouTube domains
- Install prompt: captured via `beforeinstallprompt`, stored as `deferredInstallPrompt` (currently not surfaced as a button — add one if needed)
- Offline behavior: UI opens, saved playlists are visible, an offline message is shown instead of the player

---

## GitHub Pages Deployment

1. Push to a GitHub repository
2. Go to Settings → Pages → Source → Deploy from branch → `main` / root
3. The site is live at `https://<username>.github.io/<repo-name>/`

No build step. No `_config.yml` needed. GitHub Pages serves static files directly.

If deploying to a subdirectory (not the root), update `start_url` and `scope` in `manifest.json` to match.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Toggle fullscreen |
| `Esc` | Exit fullscreen / close modal |
| `N` | Open "Add Playlist" modal |
| `[` | Previous playlist |
| `]` | Next playlist |

---

## Constraints

- No backend, no server, no database
- No React, Vue, Angular, Svelte, or any frontend framework
- No npm/Node.js build toolchain
- No external CDN dependencies (fonts, icon libraries, etc.)
- No authentication or user accounts
- No analytics, tracking, or telemetry
- No unofficial YouTube APIs or alternative YouTube frontends
- No ad blocking or bypassing of YouTube's native experience
- YouTube's own cookies are set by the embed (this is unavoidable and expected)

---

## Future Feature Ideas

- PWA install button surfaced in the UI (using `deferredInstallPrompt`)
- Playlist reordering via keyboard (not just drag-and-drop)
- Per-playlist notes / bookmarks stored in LocalStorage
- Video progress tracking via YouTube IFrame API (`YT.Player` postMessage)
- Auto-resume last video position using `start=` embed param
- Search within your playlists by name
- Multiple import formats (CSV, plain list of URLs)
- Playlist folders / groups
- Pomodoro timer overlay
- Study session timer (time spent watching)

---

## Notes for Future Claude Sessions

- All state lives in `app.js`'s module-level `state` variable and is persisted via `saveState()`
- `render()` is the single re-render function — call it after any state mutation
- Modals are shown/hidden by toggling the `hidden` class (CSS `display: none !important`)
- The sidebar collapse on mobile is handled by toggling `.open` class and the overlay's `.visible` class
- `escapeHtml()` is used for all user-supplied strings injected into innerHTML
- The service worker cache name is `focustube-v1` — increment the version when shell assets change significantly
