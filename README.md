# FocusTube

A distraction-free YouTube study app. Add only the playlists you want to study from — no Home, no Shorts, no Recommendations, no Search, no noise.

Deployable as a static site on GitHub Pages with zero configuration.

---

## Features

- Add YouTube playlists by URL or playlist ID
- Rename and delete playlists
- Drag-and-drop playlist reordering
- Import / export playlists as JSON
- Remembers your last opened playlist
- Dark mode and light mode
- Keyboard shortcuts
- Installable PWA (Android, Windows, macOS, Linux)
- Offline shell (UI loads without internet; videos require a connection)

## What it does NOT include

- Home feed
- Shorts
- Search
- Trending / Explore
- Recommendations
- Comments
- Login
- Notifications

## Quick Start

1. Clone or download this repository
2. Open `index.html` in a browser — it works immediately

## Deploy to GitHub Pages

1. Push to a GitHub repository
2. Go to **Settings → Pages → Source → Deploy from branch**
3. Select `main` branch, root folder
4. Your site will be live at `https://<username>.github.io/<repo-name>/`

## Adding a Playlist

1. Click **Add Playlist**
2. Paste a YouTube playlist URL, for example:
   `https://www.youtube.com/playlist?list=PLxxxxxxxx`
3. Optionally give it a display name
4. Click **Add Playlist**

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Toggle fullscreen |
| `Esc` | Exit fullscreen / close modal |
| `N` | Add new playlist |
| `[` | Previous playlist |
| `]` | Next playlist |

## Data & Privacy

All data is stored in your browser's LocalStorage. Nothing is sent to any server. YouTube's embedded player sets its own cookies (as with any YouTube embed).

## License

MIT
