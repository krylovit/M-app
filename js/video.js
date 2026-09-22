// ===== видак =====
// ===== ВИДАК =====
const VIDEO_URL = API_URL + '/api/video/file';
let videoFiles = [];
let videoTree = null;
let videoPath = [];
let vcrVideo = null;
let vcrCurrentFile = null;
let vcrDirFiles = [];
let vcrSaveTimer = 0;
let vcrOsdTimer = null;

const vcrCollator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

function videoSortNode(node) {
    node.files.sort((a, b) => vcrCollator.compare(a.name, b.name));
    Object.values(node.dirs).forEach(videoSortNode);
}

function videoBuildTree(files) {
    const root = { dirs: {}, files: [] };
    files.forEach(f => {
        const parts = f.path.split('/');
        let node = root;
        for (let i = 0; i < parts.length - 1; i++) {
            node = node.dirs[parts[i]] = node.dirs[parts[i]] || { dirs: {}, files: [] };
        }
        const nm = parts[parts.length - 1].replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
        node.files.push({ name: nm || parts[parts.length - 1], path: f.path });
    });
    videoSortNode(root);
    return root;
}

function videoNodeAt(path) {
    let node = videoTree;
    for (const p of path) node = node && node.dirs[p];
    return node;
}

function videoCountFiles(node) {
    let n = node.files.length;
    for (const d in node.dirs) n += videoCountFiles(node.dirs[d]);
    return n;
}

function vcrWatchedSet() {
    try { return new Set(JSON.parse(localStorage.getItem('vcr_watched') || '[]')); }
    catch (e) { return new Set(); }
}
function vcrMarkWatched(path) {
    const s = vcrWatchedSet();
    s.add(path);
    try { localStorage.setItem('vcr_watched', JSON.stringify([...s])); } catch (e) {}
}
function vcrGetPos(path) { return parseFloat(localStorage.getItem('vcr_pos_' + path) || '0') || 0; }
function vcrSetPos(path, t) { try { localStorage.setItem('vcr_pos_' + path, String(Math.floor(t))); } catch (e) {} }
function vcrClearPos(path) { try { localStorage.removeItem('vcr_pos_' + path); } catch (e) {} }

function vcrFmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

async function showVideo() {
    currentView = 'video';
    setBackBtnVisible(true);
    if (!videoTree) {
        render(`<div class="dos-terminal">C:\\ВИДАК&gt; читаю каталог<span class="dos-cursor"></span></div>`);
        try {
            const r = await fetch(`${API_URL}/api/video/list`, { headers: HEADERS });
            const d = await r.json();
            if (d.success) {
                videoFiles = d.files || [];
                videoTree = videoBuildTree(videoFiles);
            }
        } catch (e) { /* fallthrough */ }
        if (!videoTree) {
            render(`<div class="dos-terminal">C:\\ВИДАК&gt; нет связи с сервером</div>`);
            return;
        }
    }
    renderVideoDir();
}

function renderVideoDir() {
    const node = videoNodeAt(videoPath);
    const watched = vcrWatchedSet();
    const pathStr = 'C:\\ВИДАК' + (videoPath.length ? '\\' + videoPath.join('\\') : '') + '&gt;';
    let rows = '';
    if (videoPath.length) {
        rows += `<div class="vid-row vid-dir" data-up="1"><span class="vid-ico">📁</span> ..</div>`;
    }
    if (node) {
        Object.keys(node.dirs).sort(vcrCollator.compare).forEach(d => {
            const cnt = videoCountFiles(node.dirs[d]);
            rows += `<div class="vid-row vid-dir" data-dir="${escapeHtml(d)}"><span class="vid-ico">📁</span> ${escapeHtml(d)} <span class="vid-dim">(${cnt})</span></div>`;
        });
        node.files.forEach(f => {
            const w = watched.has(f.path) ? ' <span class="vid-watched">✓</span>' : '';
            const pos = vcrGetPos(f.path);
            const resume = pos > 10 ? ` <span class="vid-dim">[${vcrFmtTime(pos)}]</span>` : '';
            rows += `<div class="vid-row vid-file" data-path="${escapeHtml(f.path)}"><span class="vid-ico">📼</span> ${escapeHtml(f.name)}${w}${resume}</div>`;
        });
    }
    if (!rows) rows = '<div class="vid-empty">КАТАЛОГ ПУСТ — КИНИ КАССЕТЫ В ПАПКУ</div>';
    render(`
        <div class="vid-browser">
            <div class="vid-path">${pathStr}<span class="dos-cursor"></span></div>
            <div class="vid-list">${rows}</div>
        </div>
    `);
    document.querySelectorAll('.vid-dir[data-up]').forEach(el =>
        el.addEventListener('click', () => { videoPath.pop(); renderVideoDir(); }));
    document.querySelectorAll('.vid-dir[data-dir]').forEach(el =>
        el.addEventListener('click', () => { videoPath.push(el.getAttribute('data-dir')); renderVideoDir(); }));
    document.querySelectorAll('.vid-file').forEach(el =>
        el.addEventListener('click', () => {
            const n = videoNodeAt(videoPath);
            vcrDirFiles = n ? n.files : [];
            showVideoPlayer(el.getAttribute('data-path'));
        }));
}

function vcrFileUrl(path) {
    return `${VIDEO_URL}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function vcrOsd(text) {
    const osd = document.getElementById('vcrOsd');
    if (!osd) return;
    osd.textContent = text;
    osd.classList.add('show');
    clearTimeout(vcrOsdTimer);
    vcrOsdTimer = setTimeout(() => osd.classList.remove('show'), 900);
}

function vcrTracking() {
    const t = document.getElementById('vcrTracking');
    if (!t) return;
    t.classList.remove('on');
    void t.offsetWidth;
    t.classList.add('on');
}

function vcrUpdateDisplay() {
    if (!vcrVideo) return;
    const mode = document.getElementById('vcrMode');
    const time = document.getElementById('vcrTime');
    const fill = document.getElementById('vcrFill');
    const btn = document.getElementById('vcrPlay');
    const playing = !vcrVideo.paused && !vcrVideo.ended;
    if (mode) mode.textContent = vcrVideo.ended ? 'STOP ■' : (playing ? 'PLAY ▶' : 'PAUSE ❚❚');
    if (time) time.textContent = `${vcrFmtTime(vcrVideo.currentTime)} / ${vcrFmtTime(vcrVideo.duration)}`;
    if (fill && vcrVideo.duration) fill.style.width = (vcrVideo.currentTime / vcrVideo.duration * 100) + '%';
    if (btn) { btn.textContent = playing ? '⏸' : '▶'; btn.classList.toggle('lit', playing); }
}

function showVideoPlayer(path) {
    currentView = 'videoplayer';
    setBackBtnVisible(true);
    const file = videoFiles.find(f => f.path === path) || { path, name: path.split('/').pop().replace(/\.[^.]+$/, '') };
    vcrCurrentFile = file;
    const saved = vcrGetPos(path);
    if (radioAudio && radioPlaying) { radioAudio.pause(); radioPlaying = false; }
    render(`
        <div class="vcr">
            <div class="vcr-screen" id="vcrScreen">
                <video id="vcrVideo" playsinline webkit-playsinline preload="auto" src="${vcrFileUrl(path)}"></video>
                <div class="vcr-tracking" id="vcrTracking"></div>
                <div class="vcr-osd" id="vcrOsd"></div>
            </div>
            <div class="vcr-deck">
                <div class="vcr-display">
                    <span class="vcr-mode" id="vcrMode">PLAY ▶</span>
                    <span class="vcr-time" id="vcrTime">00:00 / 00:00</span>
                </div>
                <div class="vcr-title" id="vcrTitle">${escapeHtml(file.name)}</div>
                <div class="vcr-progress" id="vcrProgress"><div class="vcr-progress-fill" id="vcrFill"></div></div>
                <div class="vcr-controls">
                    <button class="deck-btn" id="vcrPrev" title="Пред.">⏮</button>
                    <button class="deck-btn" id="vcrRew" title="-10 сек">⏪</button>
                    <button class="deck-btn lit" id="vcrPlay">⏸</button>
                    <button class="deck-btn" id="vcrFfwd" title="+10 сек">⏩</button>
                    <button class="deck-btn" id="vcrNext" title="След.">⏭</button>
                    <button class="deck-btn" id="vcrFs" title="Fullscreen">⛶</button>
                </div>
            </div>
        </div>
    `);

    vcrVideo = document.getElementById('vcrVideo');
    const screen = document.getElementById('vcrScreen');

    vcrVideo.addEventListener('loadedmetadata', () => {
        if (saved > 10 && saved < vcrVideo.duration - 10) {
            vcrVideo.currentTime = saved;
            vcrOsd(`RESUME ${vcrFmtTime(saved)}`);
        }
        vcrUpdateDisplay();
    });
    vcrVideo.addEventListener('play', vcrUpdateDisplay);
    vcrVideo.addEventListener('pause', vcrUpdateDisplay);
    vcrVideo.addEventListener('seeking', vcrTracking);
    vcrVideo.addEventListener('timeupdate', () => {
        vcrUpdateDisplay();
        const now = Date.now();
        if (now - vcrSaveTimer > 4000 && vcrVideo.duration) {
            vcrSaveTimer = now;
            vcrSetPos(path, vcrVideo.currentTime);
        }
    });
    vcrVideo.addEventListener('ended', () => {
        vcrMarkWatched(path);
        vcrClearPos(path);
        const idx = vcrDirFiles.findIndex(f => f.path === path);
        if (idx >= 0 && idx + 1 < vcrDirFiles.length) {
            vcrOsd('NEXT TAPE');
            showVideoPlayer(vcrDirFiles[idx + 1].path);
        } else {
            vcrUpdateDisplay();
        }
    });
    vcrVideo.addEventListener('error', () => {
        const t = document.getElementById('vcrTitle');
        if (t) t.textContent = '⚠ НЕ ЧИТАЕТСЯ — НУЖНА КОНВЕРТАЦИЯ В MP4';
    });
    vcrVideo.play().catch(e => console.warn('vcr play failed', e));

    screen.addEventListener('click', (e) => {
        if (e.target.closest('.vcr-osd')) return;
        if (vcrVideo.paused) { vcrVideo.play().catch(() => {}); vcrOsd('PLAY ▶'); }
        else { vcrVideo.pause(); vcrOsd('PAUSE ❚❚'); }
    });

    document.getElementById('vcrPlay').addEventListener('click', () => {
        if (vcrVideo.paused) vcrVideo.play().catch(() => {}); else vcrVideo.pause();
    });
    document.getElementById('vcrRew').addEventListener('click', () => {
        vcrVideo.currentTime = Math.max(0, vcrVideo.currentTime - 10);
        vcrOsd('◀◀ -10'); vcrTracking();
    });
    document.getElementById('vcrFfwd').addEventListener('click', () => {
        vcrVideo.currentTime = Math.min(vcrVideo.duration || 0, vcrVideo.currentTime + 10);
        vcrOsd('+10 ▶▶'); vcrTracking();
    });
    document.getElementById('vcrPrev').addEventListener('click', () => {
        const idx = vcrDirFiles.findIndex(f => f.path === path);
        if (idx > 0) showVideoPlayer(vcrDirFiles[idx - 1].path);
    });
    document.getElementById('vcrNext').addEventListener('click', () => {
        const idx = vcrDirFiles.findIndex(f => f.path === path);
        if (idx >= 0 && idx + 1 < vcrDirFiles.length) showVideoPlayer(vcrDirFiles[idx + 1].path);
    });
    document.getElementById('vcrFs').addEventListener('click', async () => {
        const vcrRoot = document.querySelector('.vcr');
        if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
        if (vcrRoot.classList.contains('vcr-pseudo-fs')) { vcrRoot.classList.remove('vcr-pseudo-fs'); return; }
        try {
            if (vcrRoot.requestFullscreen) { await vcrRoot.requestFullscreen(); return; }
            if (vcrRoot.webkitRequestFullscreen) { vcrRoot.webkitRequestFullscreen(); return; }
            if (vcrVideo.webkitEnterFullscreen) { vcrVideo.webkitEnterFullscreen(); return; }
        } catch (e) { /* WebView отклонил — уходим в псевдо-фулскрин */ }
        vcrRoot.classList.add('vcr-pseudo-fs');
    });
    document.getElementById('vcrProgress').addEventListener('click', (e) => {
        if (!vcrVideo.duration) return;
        const r = e.currentTarget.getBoundingClientRect();
        vcrVideo.currentTime = vcrVideo.duration * Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        vcrTracking();
    });
}

function stopVideo() {
    if (vcrVideo) {
        if (vcrCurrentFile && vcrVideo.duration && !vcrVideo.ended) {
            if (vcrVideo.currentTime > vcrVideo.duration * 0.95) {
                vcrMarkWatched(vcrCurrentFile.path);
                vcrClearPos(vcrCurrentFile.path);
            } else {
                vcrSetPos(vcrCurrentFile.path, vcrVideo.currentTime);
            }
        }
        vcrVideo.pause();
        vcrVideo.removeAttribute('src');
        vcrVideo.load();
        vcrVideo = null;
    }
}

