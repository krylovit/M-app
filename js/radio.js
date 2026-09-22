// ===== магнитофон =====
// ===== РАДИО =====
let radioAudio = null;
let radioPlaying = false;
let radioPlaylist = [];
let radioTrackIdx = 0;
let radioTypeToken = 0;
let radioTypedLabel = '';
let radioVolume = 1;

function radioTrackLabel(t) {
    if (!t) return '—';
    return t.artist ? `${t.artist} — ${t.title}` : t.title;
}

function showRadio() {
    currentView = 'radio';
    setBackBtnVisible(true);
    radioTypedLabel = '';
    render(`
        <div class="vol-row">
            <span class="vol-ico">🔈</span>
            <input type="range" id="radioVol" class="vol-slider" min="0" max="100" value="${Math.round(radioVolume * 100)}">
            <span class="vol-ico">🔊</span>
        </div>
        <div class="cassette ${radioPlaying ? 'playing' : ''}" id="cassette">
            <div class="cassette-screw tl"></div>
            <div class="cassette-screw tr"></div>
            <div class="cassette-screw bl"></div>
            <div class="cassette-screw br"></div>
            <div class="cassette-led"></div>
            <div class="cassette-label">
                <div class="cassette-brand">KAPITAN PIHLO</div>
                <div class="cassette-sub">МК 60-5 · ГОСТ 137-1973/128 · Цена 4 руб. · 03.1990</div>
                <div class="cassette-stripes"></div>
                <div class="cassette-window">
                    <div class="porthole">
                        <div class="reel-wrap"><div class="tape"></div><div class="reel" id="reelL"></div></div>
                    </div>
                    <div class="meter"></div>
                    <div class="porthole">
                        <div class="reel-wrap"><div class="tape"></div><div class="reel" id="reelR"></div></div>
                    </div>
                </div>
                <div class="cassette-track" id="radioTrack"></div>
            </div>
            <div class="cassette-bottom"></div>
        </div>
        <div class="radio-controls">
            <button class="deck-btn" id="radioPrev">⏮</button>
            <button class="deck-btn${radioPlaying ? ' lit' : ''}" id="radioToggle">${radioPlaying ? '⏹' : '▶'}</button>
            <button class="deck-btn" id="radioNext">⏭</button>
            <button class="deck-btn" id="radioBrowse" title="Каталог кассет">📂</button>
        </div>
    `);
    document.getElementById('radioToggle').addEventListener('click', toggleRadio);
    document.getElementById('radioPrev').addEventListener('click', () => radioSkip(-1));
    document.getElementById('radioNext').addEventListener('click', () => radioSkip(1));
    const vol = document.getElementById('radioVol');
    if (vol) vol.addEventListener('input', () => {
        radioVolume = vol.value / 100;
        if (radioAudio) radioAudio.volume = radioVolume;
        vol.style.setProperty('--val', vol.value + '%');
    });
    const browse = document.getElementById('radioBrowse');
    if (browse) browse.addEventListener('click', showMusicCatalog);
    if (radioPlaylist.length) updateRadioUI();
    else loadRadioPlaylist();
}

async function loadRadioPlaylist() {
    try {
        const r = await fetch(`${API_URL}/api/music/list`, { headers: HEADERS });
        const d = await r.json();
        if (d.success && d.tracks && d.tracks.length) {
            radioPlaylist = d.tracks.slice();
            for (let i = radioPlaylist.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [radioPlaylist[i], radioPlaylist[j]] = [radioPlaylist[j], radioPlaylist[i]];
            }
            radioTrackIdx = 0;
            updateRadioUI();
        } else {
            const el = document.getElementById('radioTrack');
            if (el) el.textContent = 'Плейлист пуст';
        }
    } catch (e) {
        const el = document.getElementById('radioTrack');
        if (el) el.textContent = 'Нет связи с сервером';
    }
}

const MUSIC_URL = 'https://kapitanpiho.duckdns.org/music';

function radioPlayTrack(idx) {
    if (!radioPlaylist.length) return;
    radioTrackIdx = ((idx % radioPlaylist.length) + radioPlaylist.length) % radioPlaylist.length;
    const t = radioPlaylist[radioTrackIdx];
    if (!radioAudio) radioAudio = new Audio();
    radioAudio.volume = radioVolume;
    radioAudio.src = `${MUSIC_URL}/${t.file.split('/').map(encodeURIComponent).join('/')}`;
    radioAudio.onended = () => radioSkip(1);
    radioAudio.play().catch(e => console.warn('radio play failed', e));
    radioPlaying = true;
    updateRadioUI();
}

function toggleRadio() {
    if (!radioPlaylist.length) return;
    if (radioPlaying) {
        if (radioAudio) radioAudio.pause();
        radioPlaying = false;
    } else {
        if (!radioAudio || !radioAudio.src) { radioPlayTrack(radioTrackIdx); return; }
        radioAudio.play().catch(e => console.warn('radio play failed', e));
        radioPlaying = true;
    }
    updateRadioUI();
}

function radioSkip(dir) {
    if (!radioPlaylist.length) return;
    radioPlayTrack(radioTrackIdx + dir);
}

async function radioTypeText(el, text) {
    const token = ++radioTypeToken;
    while (el.textContent.length && token === radioTypeToken) {
        el.textContent = el.textContent.slice(0, -1);
        await dosSleep(18);
    }
    for (let i = 1; i <= text.length; i++) {
        if (token !== radioTypeToken) return;
        el.textContent = text.slice(0, i) + '▌';
        await dosSleep(45);
    }
    if (token === radioTypeToken) el.textContent = text;
}

function updateRadioUI() {
    const cassette = document.getElementById('cassette');
    const btn = document.getElementById('radioToggle');
    const track = document.getElementById('radioTrack');
    if (cassette) cassette.classList.toggle('playing', radioPlaying);
    if (btn) {
        btn.textContent = radioPlaying ? '⏹' : '▶';
        btn.classList.toggle('lit', radioPlaying);
    }
    const label = radioTrackLabel(radioPlaylist[radioTrackIdx]);
    if (track && label !== radioTypedLabel) {
        radioTypedLabel = label;
        radioTypeText(track, label);
    }
}

