// ===== ядро: tg, API_URL, состояние, хелперы, fetch-обёртки =====
let tg = null;
if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
} else {
    tg = { ready: function() {}, expand: function() {}, initDataUnsafe: { user: { id: 488036257, username: 'Krylovit', photo_url: '' } } };
}

const API_URL = 'https://kapitanpiho.duckdns.org';
const HEADERS = {};

const MOUSE_ANIMATIONS = [
    'animations/mouse-scroll.json',
    'animations/mouse-move.json',
    'animations/running-mouse.json'
];
let MOUSE_PHRASES = ['🐭 Привет!'];

const WEATHER_ANIMATIONS = {
    clearDay: 'animations/clear-day.json',
    clearNight: 'animations/clear-night.json',
    wind: 'animations/wind.json',
    strongWind: 'animations/wind-beaufort-8.json',
    rain: 'animations/rain.json',
    thunderstorm: 'animations/thunderstorms.json',
    hurricane: 'animations/hurricane.json'
};

let events = [], publicEvents = [], rates = null, weather = null, mouseDay = null;
let currentView = 'main';
let showHidden = false;
let editingEventId = null, editingImageFilename = '';
let pendingDeleteId = null;
let lottieAnimation = null;
let currentChart = null;
let currentRatePair = null;
let currentPlatformTab = 'games';
const imageCache = {};

let currentGame = null;
let gameRefreshTimer = null;
let lastBoard = '';

let currentC4Game = null;
let c4RefreshTimer = null;
let lastC4Board = '';

let currentCheckersGame = null;
let checkersRefreshTimer = null;
let selectedCell = null;

let playerStats = { wins: 0, losses: 0, draws: 0, rating: 0 };

function getUserId() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) return tg.initDataUnsafe.user.id;
    return 0;
}
function getUsername() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) return tg.initDataUnsafe.user.username || '';
    return '';
}
function getPhotoUrl() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) return tg.initDataUnsafe.user.photo_url || '';
    return '';
}
function getFirstName() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) return tg.initDataUnsafe.user.first_name || 'Игрок';
    return 'Игрок';
}
function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}
function render(html) { document.getElementById('content').innerHTML = html; }
function setBackBtnVisible(v) { document.getElementById('backBtn').style.display = v ? 'block' : 'none'; }
function stopLottie() { if (lottieAnimation) { lottieAnimation.destroy(); lottieAnimation = null; } }
function destroyChart() { if (currentChart) { currentChart.destroy(); currentChart = null; } }
function stopGameTimer() { if (gameRefreshTimer) { clearInterval(gameRefreshTimer); gameRefreshTimer = null; } }
function stopC4Timer() { if (c4RefreshTimer) { clearInterval(c4RefreshTimer); c4RefreshTimer = null; } }
function stopCheckersTimer() { if (checkersRefreshTimer) { clearInterval(checkersRefreshTimer); checkersRefreshTimer = null; } }

function getCurrentRate(fromCur, toCur) {
    if (!rates) return null;
    if (fromCur === 'USD' && toCur === 'RUB') return parseFloat(rates.usd_rub);
    if (fromCur === 'USD' && toCur === 'THB') return parseFloat(rates.usd_thb);
    if (fromCur === 'THB' && toCur === 'RUB') return parseFloat(rates.thb_rub);
    return null;
}

async function loadPhrases() {
    try {
        const r = await fetch('phrases.json?v=' + Date.now());
        const d = await r.json();
        if (d.mouse_phrases && d.mouse_phrases.length) MOUSE_PHRASES = d.mouse_phrases;
    } catch (e) {}
}

async function fetchAllData() {
    try {
        const uid = getUserId();
        const r = await fetch(`${API_URL}/api/all?user_id=${uid}&include_hidden=${showHidden ? 1 : 0}`, { headers: HEADERS });
        const d = await r.json();
        rates = d.rates; weather = d.weather; events = d.events;
        publicEvents = d.public_events || []; mouseDay = d.mouseDay;
        await preloadAllImages();
        await fetchPlayerStats();
        renderCurrentView();
    } catch (e) { console.error('Ошибка API:', e); }
}

async function fetchPlayerStats() {
    try {
        const r = await fetch(`${API_URL}/api/game/my_stats?user_id=${getUserId()}`, { headers: HEADERS });
        const d = await r.json();
        if (d.success) playerStats = d.stats;
    } catch (e) {}
}

async function getImageUrl(filename) {
    if (!filename || imageCache[filename]) return imageCache[filename] || '';
    try {
        const r = await fetch(`${API_URL}/api/uploads/${filename}`, { headers: HEADERS });
        if (!r.ok) return '';
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        imageCache[filename] = url;
        return url;
    } catch (e) { return ''; }
}
async function preloadAllImages() {
    const imgs = new Set();
    events.forEach(e => { if (e.image) imgs.add(e.image); });
    publicEvents.forEach(e => { if (e.image) imgs.add(e.image); });
    await Promise.all([...imgs].map(getImageUrl));
}

async function addEventApi(p) { const r = await fetch(`${API_URL}/api/add_event`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId(), ...p }) }); return r.json(); }
async function updateEventApi(id, p) { const r = await fetch(`${API_URL}/api/event/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId(), ...p }) }); return r.json(); }
async function deleteEventApi(id) { const r = await fetch(`${API_URL}/api/event/${id}?user_id=${getUserId()}`, { method: 'DELETE', headers: HEADERS }); return r.json(); }
async function hideEventApi(id, h) { const r = await fetch(`${API_URL}/api/event/${id}/hide`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId(), is_hidden: h }) }); return r.json(); }
async function uploadImageApi(file) { const fd = new FormData(); fd.append('image', file); const r = await fetch(`${API_URL}/api/upload_image`, { method: 'POST', headers: HEADERS, body: fd }); return r.json(); }

function renderCurrentView() {
    if (currentView !== 'mouse' && currentView !== 'weather') stopLottie();
    if (currentView !== 'game_ttt') stopGameTimer();
    if (currentView !== 'game_c4') stopC4Timer();
    if (currentView !== 'game_checkers') stopCheckersTimer();
    if (currentView === 'rates') showRates();
    else if (currentView === 'weather') showWeather();
    else if (currentView === 'mouse') showMouseDay();
    else if (currentView === 'events') showEvents();
    else if (currentView === 'public_events') showPublicEvents();
    else if (currentView === 'edit') showEditScreen();
    else if (currentView === 'chart') showChartScreen();
    else if (currentView === 'platform') showPlatform();
    else if (currentView === 'game_ttt') showTicTacToe();
    else if (currentView === 'game_c4') showConnectFour();
    else if (currentView === 'game_checkers') showCheckers();
    else if (currentView === 'video') showVideo();
    else if (currentView === 'videoplayer' && vcrCurrentFile) showVideoPlayer(vcrCurrentFile.path);
    else if (currentView === 'musicCatalog') showMusicCatalog();
    else showMainMenu();
}

