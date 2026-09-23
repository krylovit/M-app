// ===== КАТАЛОГ МУЗЫКИ (кассеты) =====
let musicAllTracks = [];
let musicTree = null;
let musicPath = [];
let musicQuery = '';
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

// файлы, видимые в текущем режиме: результаты поиска или содержимое папки
function musicVisibleFiles() {
    if (musicQuery.trim()) {
        const q = musicQuery.trim().toLowerCase();
        return musicAllTracks
            .filter(t => (t.file + ' ' + (t.title || '')).toLowerCase().includes(q))
            .map(t => ({ path: t.file, name: t.title || t.file.split('/').pop() }));
    }
    const n = musicNodeAt(musicPath);
    return n ? n.files : [];
}

function musicRowsHtml() {
    const cur = radioPlaylist[radioTrackIdx];
    let rows = '';
    // режим поиска: плоский список совпадений по всему каталогу
    if (musicQuery.trim()) {
        musicVisibleFiles().forEach(t => {
            const playing = cur && cur.file === t.path;
            const add = playlistsCanCreate ? `<span class="pl-add" data-add="${escapeHtml(t.path)}" title="В плейлист">➕</span>` : '';
            const dir = t.path.split('/').slice(0, -1).join('/');
            rows += `<div class="vid-row vid-file" data-path="${escapeHtml(t.path)}"><span class="vid-ico${playing ? ' vid-playing' : ''}">🎵</span> <span class="vid-name">${escapeHtml(t.name)} <span class="vid-dim">${escapeHtml(dir)}</span></span>${add}</div>`;
        });
        return rows || '<div class="vid-empty">НИЧЕГО НЕ НАЙДЕНО</div>';
    }
    const node = musicNodeAt(musicPath);
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
    return rows || '<div class="vid-empty">КАТАЛОГ ПУСТ — КИНИ КАССЕТЫ В ПАПКУ</div>';
}

function attachMusicHandlers() {
    document.querySelectorAll('.vid-dir[data-up]').forEach(el =>
        el.addEventListener('click', () => { musicPath.pop(); renderMusicDir(); }));
    document.querySelectorAll('.vid-dir[data-dir]').forEach(el =>
        el.addEventListener('click', () => { musicPath.push(el.getAttribute('data-dir')); renderMusicDir(); }));
    document.querySelectorAll('.vid-file').forEach(el =>
        el.addEventListener('click', () => {
            const files = musicVisibleFiles();
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

function renderMusicDir() {
    const pathStr = 'C:\\МУЗЫКА' + (musicPath.length ? '\\' + musicPath.join('\\') : '') + '&gt;';
    render(`
        <div class="vid-browser mus-browser">
            <div class="vid-path">${pathStr}<span class="dos-cursor"></span></div>
            <div class="mus-search-row"><input id="musSearch" class="pl-input mus-search" maxlength="80" placeholder="🔍 ПОИСК ПО КАССЕТАМ..." value="${escapeHtml(musicQuery)}"></div>
            <div class="vid-list">${musicRowsHtml()}</div>
        </div>
    `);
    attachMusicHandlers();
    // ввод фильтрует только список — инпут не пересоздаётся, фокус не теряется
    document.getElementById('musSearch').addEventListener('input', (e) => {
        musicQuery = e.target.value;
        document.querySelector('.vid-list').innerHTML = musicRowsHtml();
        attachMusicHandlers();
    });
}
