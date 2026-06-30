'use strict';

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'focustube_data';
const DEFAULT = { playlists: [], lastPlaylist: null, theme: 'dark' };

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch { return { ...DEFAULT }; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getApiKey() {
  return localStorage.getItem('focustube_apikey') || '';
}

function setApiKey(key) {
  localStorage.setItem('focustube_apikey', key.trim());
}

// ── YouTube helpers ───────────────────────────────────────────────────────────

function extractPlaylistId(input) {
  const s = (input || '').trim();
  const m = s.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{10,}$/.test(s)) return s;
  return null;
}

// Embed a specific video within the playlist context
function buildVideoUrl(videoId, playlistId) {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?list=${encodeURIComponent(playlistId)}&rel=0&autoplay=1`;
}

// Fallback embed when no video is selected
function buildPlaylistUrl(playlistId) {
  return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(playlistId)}&rel=0`;
}

// ── Video cache (in-memory) ───────────────────────────────────────────────────

const videoCache = {};   // playlistId → Video[]
// Video shape: { videoId, title, thumbnail, position }

async function fetchVideos(playlistId) {
  if (videoCache[playlistId]) return videoCache[playlistId];

  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_KEY');

  const videos = [];
  let pageToken = '';

  do {
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems` +
      `?part=snippet&playlistId=${encodeURIComponent(playlistId)}` +
      `&maxResults=50&key=${encodeURIComponent(apiKey)}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      const msg = data.error.errors?.[0]?.reason || data.error.message;
      throw new Error(msg);
    }

    for (const item of (data.items || [])) {
      const sn = item.snippet;
      // Skip deleted / private videos
      if (sn.title === 'Deleted video' || sn.title === 'Private video') continue;
      videos.push({
        videoId:   sn.resourceId.videoId,
        title:     sn.title,
        thumbnail: sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url || '',
        position:  sn.position,
      });
    }

    pageToken = data.nextPageToken || '';
  } while (pageToken);

  videoCache[playlistId] = videos;
  return videos;
}

// ── State ─────────────────────────────────────────────────────────────────────

let state         = loadState();
let activeId      = state.lastPlaylist || null;   // active playlist ID
let activeVideoId = null;                          // active video ID within playlist
let actionTargetId = null;

// ── DOM ───────────────────────────────────────────────────────────────────────

const sidebar       = document.getElementById('sidebar');
const sidebarClose  = document.getElementById('sidebar-close');
const overlay       = document.getElementById('overlay');
const menuBtn       = document.getElementById('menu-btn');
const plList        = document.getElementById('playlist-list');

// Sidebar video list (desktop)
const videosLabel   = document.getElementById('videos-label');
const vlEmpty       = document.getElementById('vl-empty');
const vlNoKey       = document.getElementById('vl-no-key');
const vlLoading     = document.getElementById('vl-loading');
const vlError       = document.getElementById('vl-error');
const videoList     = document.getElementById('video-list');
const vlSetKeyBtn   = document.getElementById('vl-set-key-btn');

// Mobile video list (below player)
const mvlEmpty      = document.getElementById('mvl-empty');
const mvlNoKey      = document.getElementById('mvl-no-key');
const mvlLoading    = document.getElementById('mvl-loading');
const mvlError      = document.getElementById('mvl-error');
const mobileVideoList = document.getElementById('mobile-video-list');
const mvlSetKeyBtn  = document.getElementById('mvl-set-key-btn');

const nowPlaying    = document.getElementById('now-playing');
const themeBtn      = document.getElementById('theme-btn');
const iconMoon      = document.getElementById('icon-moon');
const iconSun       = document.getElementById('icon-sun');
const addBtn        = document.getElementById('add-btn');

const emptyState    = document.getElementById('empty-state');
const offlineState  = document.getElementById('offline-state');
const playerWrapper = document.getElementById('player-wrapper');
const youtubePlayer = document.getElementById('youtube-player');

const importBtn     = document.getElementById('import-btn');
const exportBtn     = document.getElementById('export-btn');
const importFile    = document.getElementById('import-file');

const apiKeyBtn     = document.getElementById('api-key-btn');
const apiKeyLabel   = document.getElementById('api-key-label');

const addSheet      = document.getElementById('add-sheet');
const urlInput      = document.getElementById('url-input');
const nameInput     = document.getElementById('name-input');
const urlError      = document.getElementById('url-error');
const dupeWarning   = document.getElementById('dupe-warning');
const addSaveBtn    = document.getElementById('add-save-btn');

const apikeySheet   = document.getElementById('apikey-sheet');
const apikeyInput   = document.getElementById('apikey-input');
const apikeySaveBtn = document.getElementById('apikey-save-btn');

const actionSheet   = document.getElementById('action-sheet');
const actionName    = document.getElementById('action-sheet-name');
const actionRename  = document.getElementById('action-rename');
const actionDelete  = document.getElementById('action-delete');

const renameSheet   = document.getElementById('rename-sheet');
const renameInput   = document.getElementById('rename-input');
const renameSave    = document.getElementById('rename-save');

const deleteSheet   = document.getElementById('delete-sheet');
const deleteName    = document.getElementById('delete-name');
const deleteConfirm = document.getElementById('delete-confirm');

const toast         = document.getElementById('toast');

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  renderSidebar();
  renderPlayer();
  renderTheme();
  renderApiKeyLabel();
}

function renderSidebar() {
  renderPlaylistList();
  renderVideoList();
}

function renderPlaylistList() {
  plList.innerHTML = '';

  if (!state.playlists.length) {
    const li = document.createElement('li');
    li.style.cssText = 'padding:10px 12px;font-size:12px;color:var(--faint)';
    li.textContent = 'No playlists yet';
    plList.appendChild(li);
    return;
  }

  state.playlists.forEach(pl => {
    const li = document.createElement('li');
    li.className = 'pl-item' + (pl.id === activeId ? ' active' : '');

    li.innerHTML = `
      <button class="pl-btn" type="button">
        <span class="pl-dot"></span>
        <span class="pl-name">${escHtml(pl.name)}</span>
      </button>
      <button class="pl-more" type="button" aria-label="Options">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="2" r="1" fill="currentColor"/>
          <circle cx="6.5" cy="6.5" r="1" fill="currentColor"/>
          <circle cx="6.5" cy="11" r="1" fill="currentColor"/>
        </svg>
      </button>`;

    li.querySelector('.pl-btn').addEventListener('click', () => {
      selectPlaylist(pl.id);
      closeSidebar();
    });
    li.querySelector('.pl-more').addEventListener('click', e => {
      e.stopPropagation();
      openActionSheet(pl.id);
    });

    plList.appendChild(li);
  });
}

// Render the video list for the active playlist (both sidebar + mobile)
async function renderVideoList() {
  const pl = state.playlists.find(p => p.id === activeId);

  // Reset sidebar states
  videosLabel.style.display = 'none';
  vlEmpty.classList.add('hidden');
  vlNoKey.classList.add('hidden');
  vlLoading.classList.add('hidden');
  vlError.classList.add('hidden');
  videoList.innerHTML = '';

  // Reset mobile states
  mvlEmpty.classList.add('hidden');
  mvlNoKey.classList.add('hidden');
  mvlLoading.classList.add('hidden');
  mvlError.classList.add('hidden');
  mobileVideoList.innerHTML = '';

  if (!pl) {
    vlEmpty.classList.remove('hidden');
    mvlEmpty.classList.remove('hidden');
    return;
  }

  videosLabel.style.display = '';

  if (!getApiKey()) {
    vlNoKey.classList.remove('hidden');
    mvlNoKey.classList.remove('hidden');
    return;
  }

  vlLoading.classList.remove('hidden');
  mvlLoading.classList.remove('hidden');

  try {
    const videos = await fetchVideos(pl.playlistId);
    vlLoading.classList.add('hidden');
    mvlLoading.classList.add('hidden');

    if (!videos.length) {
      vlError.textContent = 'No videos found.';
      vlError.classList.remove('hidden');
      mvlError.textContent = 'No videos found.';
      mvlError.classList.remove('hidden');
      return;
    }

    // Build items for both lists
    videos.forEach(v => {
      [videoList, mobileVideoList].forEach(list => {
        const li = document.createElement('li');
        const isActive = v.videoId === activeVideoId;
        li.className = 'video-item' + (isActive ? ' active' : '');
        li.dataset.videoid = v.videoId;

        li.innerHTML = `
          ${v.thumbnail
            ? `<img class="video-thumb" src="${escHtml(v.thumbnail)}" alt="" loading="lazy" />`
            : `<div class="video-thumb-placeholder">
                 <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3.5l6 3-6 3V3.5z" fill="currentColor"/></svg>
               </div>`
          }
          <div class="video-info">
            <div class="video-title">${escHtml(v.title)}</div>
            <div class="video-index">${v.position + 1}</div>
          </div>`;

        li.addEventListener('click', () => {
          selectVideo(v.videoId, pl.playlistId);
          closeSidebar();
        });

        list.appendChild(li);
      });
    });

  } catch (err) {
    vlLoading.classList.add('hidden');
    mvlLoading.classList.add('hidden');
    if (err.message === 'NO_KEY') {
      vlNoKey.classList.remove('hidden');
      mvlNoKey.classList.remove('hidden');
    } else {
      const msg = `API error: ${err.message}`;
      vlError.textContent = msg;
      vlError.classList.remove('hidden');
      mvlError.textContent = msg;
      mvlError.classList.remove('hidden');
    }
  }
}

function renderPlayer() {
  if (!navigator.onLine) {
    emptyState.classList.add('hidden');
    offlineState.classList.remove('hidden');
    playerWrapper.classList.add('hidden');
    nowPlaying.textContent = '';
    return;
  }

  const pl = state.playlists.find(p => p.id === activeId);

  if (!pl) {
    emptyState.classList.remove('hidden');
    offlineState.classList.add('hidden');
    playerWrapper.classList.add('hidden');
    nowPlaying.textContent = '';
    return;
  }

  emptyState.classList.add('hidden');
  offlineState.classList.add('hidden');
  playerWrapper.classList.remove('hidden');

  const src = activeVideoId
    ? buildVideoUrl(activeVideoId, pl.playlistId)
    : buildPlaylistUrl(pl.playlistId);

  if (youtubePlayer.src !== src) youtubePlayer.src = src;

  // Update header title
  if (activeVideoId) {
    const videos = videoCache[pl.playlistId];
    const v = videos?.find(x => x.videoId === activeVideoId);
    nowPlaying.textContent = v ? v.title : pl.name;
  } else {
    nowPlaying.textContent = pl.name;
  }
}

function renderTheme() {
  const dark = state.theme === 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  iconMoon.classList.toggle('hidden', !dark);
  iconSun.classList.toggle('hidden', dark);
  document.getElementById('theme-meta').content = dark ? '#0a0a0a' : '#fafafa';
}

function renderApiKeyLabel() {
  apiKeyLabel.textContent = getApiKey() ? 'Change API key' : 'Set API key';
}

// ── Selection ─────────────────────────────────────────────────────────────────

function selectPlaylist(id) {
  activeId = id;
  activeVideoId = null;
  state.lastPlaylist = id;
  save();
  render();
  // Kick off video fetch in background (will re-render video list when done)
  renderVideoList();
}

function selectVideo(videoId, playlistId) {
  activeVideoId = videoId;
  renderPlayer();
  // Highlight active item in both lists
  document.querySelectorAll('.video-item').forEach(el => {
    el.classList.toggle('active', el.dataset.videoid === videoId);
  });
}

// ── Playlist CRUD ─────────────────────────────────────────────────────────────

function addPlaylist(playlistId, name) {
  const id = 'pl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const displayName = name.trim() || ('Playlist ' + (state.playlists.length + 1));
  state.playlists.push({ id, playlistId, name: displayName });
  activeId = id;
  activeVideoId = null;
  state.lastPlaylist = id;
  save();
  render();
  renderVideoList();
  showToast(`"${displayName}" added`);
}

function renamePlaylist(id, name) {
  const pl = state.playlists.find(p => p.id === id);
  if (!pl || !name.trim()) return;
  pl.name = name.trim();
  save();
  render();
  showToast('Renamed');
}

function deletePlaylist(id) {
  const idx = state.playlists.findIndex(p => p.id === id);
  if (idx === -1) return;
  const pl = state.playlists[idx];
  delete videoCache[pl.playlistId];
  state.playlists.splice(idx, 1);
  if (activeId === id) {
    activeId = state.playlists[0]?.id || null;
    activeVideoId = null;
    state.lastPlaylist = activeId;
  }
  save();
  render();
  showToast('Deleted');
}

// ── Sidebar (mobile) ──────────────────────────────────────────────────────────

function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('visible');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
}

menuBtn.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

// ── Sheets ────────────────────────────────────────────────────────────────────

function openSheet(sheet) {
  sheet.classList.remove('hidden');
  const inp = sheet.querySelector('input');
  if (inp) setTimeout(() => inp.focus(), 200);
}

function closeSheet(sheet) {
  sheet.classList.add('hidden');
}

document.querySelectorAll('.sheet').forEach(sheet => {
  sheet.querySelector('.sheet-backdrop').addEventListener('click', () => closeSheet(sheet));
  sheet.querySelectorAll('.sheet-cancel').forEach(b => b.addEventListener('click', () => closeSheet(sheet)));
});

// Add playlist
addBtn.addEventListener('click', () => {
  urlInput.value = '';
  nameInput.value = '';
  urlError.classList.add('hidden');
  dupeWarning.classList.add('hidden');
  urlInput.classList.remove('error');
  openSheet(addSheet);
});

addSaveBtn.addEventListener('click', () => {
  const id = extractPlaylistId(urlInput.value);
  urlError.classList.add('hidden');
  dupeWarning.classList.add('hidden');
  urlInput.classList.remove('error');

  if (!id) {
    urlError.classList.remove('hidden');
    urlInput.classList.add('error');
    urlInput.focus();
    return;
  }
  if (state.playlists.some(p => p.playlistId === id)) {
    dupeWarning.classList.remove('hidden');
    return;
  }

  addPlaylist(id, nameInput.value);
  closeSheet(addSheet);
});

nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addSaveBtn.click(); });

// API key
function openApiKeySheet() {
  apikeyInput.value = getApiKey();
  openSheet(apikeySheet);
}

apiKeyBtn.addEventListener('click', openApiKeySheet);
vlSetKeyBtn.addEventListener('click', openApiKeySheet);
mvlSetKeyBtn.addEventListener('click', openApiKeySheet);

apikeySaveBtn.addEventListener('click', () => {
  const key = apikeyInput.value.trim();
  setApiKey(key);
  renderApiKeyLabel();
  closeSheet(apikeySheet);
  // Clear cache so we re-fetch with new key
  Object.keys(videoCache).forEach(k => delete videoCache[k]);
  if (activeId) renderVideoList();
  showToast(key ? 'API key saved' : 'API key cleared');
});

apikeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') apikeySaveBtn.click(); });

// Actions sheet
function openActionSheet(id) {
  actionTargetId = id;
  const pl = state.playlists.find(p => p.id === id);
  actionName.textContent = pl ? pl.name : '';
  openSheet(actionSheet);
}

actionRename.addEventListener('click', () => {
  closeSheet(actionSheet);
  const pl = state.playlists.find(p => p.id === actionTargetId);
  if (!pl) return;
  renameInput.value = pl.name;
  openSheet(renameSheet);
  setTimeout(() => { renameInput.focus(); renameInput.select(); }, 200);
});

actionDelete.addEventListener('click', () => {
  closeSheet(actionSheet);
  const pl = state.playlists.find(p => p.id === actionTargetId);
  if (!pl) return;
  deleteName.textContent = pl.name;
  openSheet(deleteSheet);
});

renameSave.addEventListener('click', () => {
  renamePlaylist(actionTargetId, renameInput.value);
  closeSheet(renameSheet);
});

renameInput.addEventListener('keydown', e => { if (e.key === 'Enter') renameSave.click(); });

deleteConfirm.addEventListener('click', () => {
  deletePlaylist(actionTargetId);
  closeSheet(deleteSheet);
});

// ── Theme ─────────────────────────────────────────────────────────────────────

themeBtn.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  save();
  renderTheme();
});

// ── Import / Export ───────────────────────────────────────────────────────────

exportBtn.addEventListener('click', () => {
  const json = JSON.stringify({ playlists: state.playlists }, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'focustube-playlists.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Exported');
});

importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data.playlists)) throw new Error();
      let added = 0;
      data.playlists.forEach(pl => {
        if (!pl.playlistId || !pl.name) return;
        if (state.playlists.some(p => p.playlistId === pl.playlistId)) return;
        const id = 'pl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        state.playlists.push({ id, playlistId: pl.playlistId, name: pl.name });
        added++;
      });
      if (added) { save(); render(); showToast(`${added} playlist${added > 1 ? 's' : ''} imported`); }
      else showToast('No new playlists');
    } catch { showToast('Could not read file'); }
    importFile.value = '';
  };
  reader.readAsText(file);
});

// ── Online / offline ──────────────────────────────────────────────────────────

window.addEventListener('online',  renderPlayer);
window.addEventListener('offline', renderPlayer);

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Service Worker ────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

// ── Init ──────────────────────────────────────────────────────────────────────

render();
// Fetch videos for the initially selected playlist
if (activeId) renderVideoList();
