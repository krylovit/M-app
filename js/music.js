// ===== каталог музыки (кассеты) =====
// ===== КАТАЛОГ МУЗЫКИ (кассеты) =====
let musicAllTracks = [];
let musicTree = null;
let musicPath = [];
let playlistsCache = [];
let playlistsCanCreate = false;
let currentPlaylist = null;

function musicNodeAt(path) {
    let node = musicTree;
    for (const p of path) node = node && node.dirs[p];
    return node;
}

function musicFileUrl(rel) {
    return MUSIC_URL + '/' + rel.split('/').map(encodeURIComponent).join('/');
}

function musicCoverUrl(dirName) {
    return musicFileUrl([...musicPath, dirName, 'front.jpg'].join('/'));
}

async function showMusicCatalog() {
    currentView = 'musicCatalog';
    setBackBtnVisible(true);
    if (!musicTree) {
        render(`<div class="dos-terminal">C:\\МУЗЫКА&gt; читаю каталог<span class="dos-cursor"></span></div>`);
        try {
            const r = await fetch(`${API_URL}/api/music/list`, { headers: HEADERS });
            const d = await r.json();
            if (d.success && d.tracks) {
                musicAllTracks = d.tracks;
                musicTree = videoBuildTree(musicAllTracks.map(t => ({ path: t.file })));
            }
        } catch (e) { /* fallthrough */ }
        if (!musicTree) {
            render(`<div class="dos-terminal">C:\\МУЗЫКА&gt; нет связи с сервером</div>`);
            return;
        }
    }
    // один рендер: в корне ждём плейлисты, в подпапках грузим их фоном (нужны для ➕)
    if (musicPath.length === 0) await loadPlaylists();
    else loadPlaylists();
    if (currentView === 'musicCatalog') renderMusicDir();
}

function renderMusicDir() {
    const node = musicNodeAt(musicPath);
    const cur = radioPlaylist[radioTrackIdx];
    const pathStr = 'C:\\МУЗЫКА' + (musicPath.length ? '\\' + musicPath.join('\\') : '') + '&gt;';
    let rows = '';
    if (musicPath.length) {
        rows += `<div class="vid-row vid-dir" data-up="1"><span class="vid-ico">📁</span> ..</div>`;
    }
    if (node) {
        Object.keys(node.dirs).sort(vcrCollator.compare).forEach(d => {
            const cnt = videoCountFiles(node.dirs[d]);
            rows += `<div class="vid-row vid-dir" data-dir="${escapeHtml(d)}"><img class="mus-cover" loading="lazy" src="${musicCoverUrl(d)}" onload="this.nextElementSibling.style.display='none'" onerror="this.remove()" alt=""><span class="vid-ico">📁</span> ${escapeHtml(d)} <span class="vid-dim">(${cnt})</span></div>`;
        });
        node.files.forEach(f => {
            const playing = cur && cur.file === f.path;
            const add = playlistsCanCreate ? `<span class="pl-add" data-add="${escapeHtml(f.path)}" title="В плейлист">➕</span>` : '';
            rows += `<div class="vid-row vid-file" data-path="${escapeHtml(f.path)}"><span class="vid-ico${playing ? ' vid-playing' : ''}">🎵</span> <span class="vid-name">${escapeHtml(f.name)}</span>${add}</div>`;
        });
    }
    if (musicPath.length === 0) {
        rows += `<div class="pl-head">🎧 ПЛЕЙЛИСТЫ</div>`;
        playlistsCache.forEach(p => {
            const mine = p.owner_id === getUserId();
            const heart = p.liked ? '♥' : '♡';
            const del = mine ? `<span class="pl-del" data-pl="${p.id}" title="Удалить плейлист">✖</span>` : '';
            rows += `<div class="vid-row pl-row" data-pl="${p.id}"><span class="vid-ico">📻</span> <span class="vid-name">${escapeHtml(p.title)} <span class="vid-dim">(${p.tracks_count} · ${escapeHtml(p.owner)})</span></span><span class="pl-like${p.liked ? ' on' : ''}" data-pl="${p.id}" title="Нравится">${heart} ${p.likes}</span>${del}</div>`;
        });
        if (playlistsCanCreate) rows += `<div class="vid-row pl-new" id="plNewBtn"><span class="vid-ico">➕</span> Новый плейлист</div>`;
    }
    if (!rows) rows = '<div class="vid-empty">КАТАЛОГ ПУСТ — КИНИ КАССЕТЫ В ПАПКУ</div>';
    render(`
        <div class="vid-browser mus-browser">
            <div class="vid-path">${pathStr}<span class="dos-cursor"></span></div>
            <div class="vid-list">${rows}</div>
        </div>
    `);
    document.querySelectorAll('.vid-dir[data-up]').forEach(el =>
        el.addEventListener('click', () => { musicPath.pop(); renderMusicDir(); }));
    document.querySelectorAll('.vid-dir[data-dir]').forEach(el =>
        el.addEventListener('click', () => { musicPath.push(el.getAttribute('data-dir')); renderMusicDir(); }));
    document.querySelectorAll('.vid-file').forEach(el =>
        el.addEventListener('click', () => {
            const n = musicNodeAt(musicPath);
            const files = n ? n.files : [];
            radioPlaylist = files.map(f => ({ file: f.path, artist: '', title: f.name }));
            radioTrackIdx = Math.max(0, files.findIndex(f => f.path === el.getAttribute('data-path')));
            showRadio();
            radioPlayTrack(radioTrackIdx);
        }));
    document.querySelectorAll('.pl-row').forEach(el =>
        el.addEventListener('click', () => openPlaylist(+el.getAttribute('data-pl'))));
    document.querySelectorAll('.pl-like').forEach(el =>
        el.addEventListener('click', async (e) => { e.stopPropagation(); await playlistLike(+el.getAttribute('data-pl')); }));
    document.querySelectorAll('.pl-del').forEach(el =>
        el.addEventListener('click', async (e) => { e.stopPropagation(); await playlistDelete(+el.getAttribute('data-pl')); }));
    document.querySelectorAll('.pl-add').forEach(el =>
        el.addEventListener('click', (e) => { e.stopPropagation(); showPlSheet(el.getAttribute('data-add')); }));
    const plNew = document.getElementById('plNewBtn');
    if (plNew) plNew.addEventListener('click', plCreateInline);
}

