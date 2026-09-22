// ===== плейлисты =====
// ===== ПЛЕЙЛИСТЫ =====
async function loadPlaylists() {
    try {
        const r = await fetch(`${API_URL}/api/playlists?user_id=${getUserId()}`, { headers: HEADERS });
        const d = await r.json();
        if (d.success) { playlistsCache = d.playlists; playlistsCanCreate = !!d.can_create; }
    } catch (e) {}
}

async function plApiCreate(title) {
    const r = await fetch(`${API_URL}/api/playlist/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
        body: JSON.stringify({ user_id: getUserId(), title })
    });
    return r.json();
}

async function playlistLike(pid) {
    try {
        const r = await fetch(`${API_URL}/api/playlist/${pid}/like`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
            body: JSON.stringify({ user_id: getUserId() })
        });
        const d = await r.json();
        if (d.success) {
            const p = playlistsCache.find(x => x.id === pid);
            if (p) { p.liked = d.liked; p.likes = d.count; }
            if (currentView === 'musicCatalog' && musicPath.length === 0) renderMusicDir();
        }
    } catch (e) {}
}

async function playlistDelete(pid) {
    try {
        const r = await fetch(`${API_URL}/api/playlist/${pid}/delete`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
            body: JSON.stringify({ user_id: getUserId() })
        });
        const d = await r.json();
        if (d.success) { playlistsCache = playlistsCache.filter(x => x.id !== pid); renderMusicDir(); }
    } catch (e) {}
}

function plCreateInline() {
    const btn = document.getElementById('plNewBtn');
    if (!btn) return;
    btn.innerHTML = `<input id="plNewName" maxlength="60" placeholder="Название ленты..." class="pl-input"> <button class="pl-ok" id="plNewOk">OK</button>`;
    const input = document.getElementById('plNewName');
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById('plNewOk').click(); }
    });
    document.getElementById('plNewOk').addEventListener('click', async (e) => {
        e.stopPropagation();
        const name = input.value.trim();
        if (!name) { renderMusicDir(); return; }
        await plApiCreate(name);
        await loadPlaylists();
        renderMusicDir();
    });
    setTimeout(() => input.focus(), 50);
}

function plToast(msg, warn) {
    let t = document.getElementById('plToast');
    if (t) t.remove();
    t = document.createElement('div');
    t.id = 'plToast';
    t.className = 'pl-toast' + (warn ? ' warn' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => { if (t.parentNode) t.remove(); }, 300); }, 1800);
}

function showPlSheet(file) {
    let ov = document.getElementById('plOverlay');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'plOverlay';
    ov.className = 'pl-overlay';
    const mine = playlistsCache.filter(p => p.owner_id === getUserId());
    let inner = `<div class="pl-sheet-head">В КАКОЙ ПЛЕЙЛИСТ?</div>`;
    if (!mine.length) inner += `<div class="vid-dim" style="padding:6px 2px">своих плейлистов пока нет — создай ниже</div>`;
    mine.forEach(p => inner += `<div class="vid-row pl-pick" data-pid="${p.id}" data-title="${escapeHtml(p.title)}"><span class="vid-ico">📻</span> <span class="vid-name">${escapeHtml(p.title)} <span class="vid-dim">(${p.tracks_count})</span></span></div>`);
    inner += `<div class="pl-sheet-new"><input id="plSheetName" maxlength="60" placeholder="Новый плейлист..." class="pl-input"><button class="pl-ok" id="plSheetCreate">＋</button></div>`;
    inner += `<div class="pl-sheet-x">отмена</div>`;
    ov.innerHTML = `<div class="pl-sheet">${inner}</div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov || e.target.classList.contains('pl-sheet-x')) ov.remove(); });
    const nameI = document.getElementById('plSheetName');
    nameI.addEventListener('click', e => e.stopPropagation());
    async function doAdd(pid, title) {
        let d = null;
        try {
            const r = await fetch(`${API_URL}/api/playlist/${pid}/add`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ user_id: getUserId(), file })
            });
            d = await r.json();
        } catch (e) {}
        ov.remove();
        if (d && d.added === false) plToast(`уже есть в «${title}»`, true);
        else if (d && d.success) plToast(`добавлено в «${title}»`);
        else plToast('не получилось добавить :(', true);
        await loadPlaylists();
        if (currentView === 'musicCatalog' && musicPath.length === 0) renderMusicDir();
    }
    ov.querySelectorAll('.pl-pick').forEach(el =>
        el.addEventListener('click', () => doAdd(+el.getAttribute('data-pid'), el.getAttribute('data-title') || 'плейлист')));
    document.getElementById('plSheetCreate').addEventListener('click', async () => {
        const name = nameI.value.trim();
        if (!name) return;
        const d = await plApiCreate(name);
        if (d && d.playlist_id) { await loadPlaylists(); await doAdd(d.playlist_id, name); }
    });
}

async function openPlaylist(pid) {
    currentView = 'musicPlaylist';
    setBackBtnVisible(true);
    render(`<div class="dos-terminal">C:\\ПЛЕЙЛИСТЫ&gt; гружу ленту<span class="dos-cursor"></span></div>`);
    try {
        const r = await fetch(`${API_URL}/api/playlist/${pid}`, { headers: HEADERS });
        const d = await r.json();
        if (!d.success) { showMusicCatalog(); return; }
        currentPlaylist = d.playlist;
    } catch (e) { showMusicCatalog(); return; }
    renderPlaylistView();
}

function renderPlaylistView() {
    const pl = currentPlaylist;
    if (!pl) { showMusicCatalog(); return; }
    const mine = pl.owner_id === getUserId();
    const cur = radioPlaylist[radioTrackIdx];
    let rows = '';
    pl.tracks.forEach((fp, i) => {
        const t = musicAllTracks.find(x => x.file === fp);
        const name = t ? radioTrackLabel(t) : fp.split('/').pop().replace(/\.[^.]+$/, '');
        const playing = cur && cur.file === fp ? ' <span class="vid-playing">♪</span>' : '';
        const del = mine ? `<span class="pl-rm" data-idx="${i}" title="Убрать трек">✖</span>` : '';
        rows += `<div class="vid-row vid-file" data-idx="${i}"><span class="vid-ico">🎵</span> <span class="vid-name">${escapeHtml(name)}</span>${playing}${del}</div>`;
    });
    if (!rows) rows = '<div class="vid-empty">ЛЕНТА ПУСТА — ДОБАВЬ ТРЕКИ ЧЕРЕЗ ➕ В КАТАЛОГЕ</div>';
    render(`
        <div class="vid-browser mus-browser">
            <div class="vid-path">C:\\ПЛЕЙЛИСТЫ\\${escapeHtml(pl.title)}&gt;</div>
            <div class="vid-dim pl-owner">собрал ${escapeHtml(pl.owner)} · ♥ ${pl.likes}</div>
            <div class="vid-list">${rows}</div>
        </div>
    `);
    document.querySelectorAll('.vid-file[data-idx]').forEach(el =>
        el.addEventListener('click', () => {
            const i = +el.getAttribute('data-idx');
            radioPlaylist = pl.tracks.map(fp => {
                const t = musicAllTracks.find(x => x.file === fp);
                return t ? t : { file: fp, artist: '', title: fp.split('/').pop().replace(/\.[^.]+$/, '') };
            });
            radioTrackIdx = Math.min(i, radioPlaylist.length - 1);
            showRadio();
            radioPlayTrack(radioTrackIdx);
        }));
    document.querySelectorAll('.pl-rm').forEach(el =>
        el.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = +el.getAttribute('data-idx');
            try {
                await fetch(`${API_URL}/api/playlist/${pl.id}/remove`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                    body: JSON.stringify({ user_id: getUserId(), idx })
                });
            } catch (err) {}
            pl.tracks.splice(idx, 1);
            loadPlaylists();
            renderPlaylistView();
        }));
}

