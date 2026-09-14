document.addEventListener('DOMContentLoaded', function() {

    let tg = null;
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
    } else {
        tg = { ready: function() {}, expand: function() {}, initDataUnsafe: { user: { id: 488036257, username: 'Krylovit', photo_url: '' } } };
    }

    const API_URL = 'https://puma-suction-anteater.ngrok-free.dev';
    const HEADERS = { 'ngrok-skip-browser-warning': 'true' };

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
        else showMainMenu();
    }

    function showMainMenu() {
        currentView = 'main'; stopLottie(); destroyChart(); stopGameTimer(); stopC4Timer(); stopCheckersTimer(); setBackBtnVisible(false);
        render(`<p>👋 Выбери раздел выше</p>`);
    }

    // ===== ИГРОВАЯ ПЛАТФОРМА =====
    function showPlatform() {
        currentView = 'platform';
        setBackBtnVisible(true);
        stopGameTimer(); stopC4Timer(); stopCheckersTimer();
        if (currentPlatformTab === 'games') renderPlatformGames();
        else if (currentPlatformTab === 'leaderboard') renderPlatformLeaderboard();
        else if (currentPlatformTab === 'profile') renderPlatformProfile();
    }

    function platformTabsHtml() {
        return `
            <div class="platform-tabs">
                <button class="platform-tab ${currentPlatformTab === 'games' ? 'active' : ''}" data-tab="games">
                    <i class="ti ti-device-gamepad-2"></i>
                    <span>Игры</span>
                </button>
                <button class="platform-tab ${currentPlatformTab === 'leaderboard' ? 'active' : ''}" data-tab="leaderboard">
                    <i class="ti ti-trophy"></i>
                    <span>Рейтинг</span>
                </button>
                <button class="platform-tab ${currentPlatformTab === 'profile' ? 'active' : ''}" data-tab="profile">
                    <i class="ti ti-user"></i>
                    <span>Профиль</span>
                </button>
            </div>
        `;
    }

    function setupPlatformTabs() {
        document.querySelectorAll('.platform-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                currentPlatformTab = this.getAttribute('data-tab');
                showPlatform();
            });
        });
    }

    function renderPlatformGames() {
        render(`
            <h2>🎮 Игровая платформа</h2>
            <div class="games-grid">
                <div class="game-card" data-game="ttt">
                    <div class="game-card-icon">🎯</div>
                    <div class="game-card-title">ГОМОКУ</div>
                    <div class="game-card-stats">${playerStats.wins}П / ${playerStats.losses}П</div>
                </div>
                <div class="game-card" data-game="c4">
                    <div class="game-card-icon amber">🔴</div>
                    <div class="game-card-title">4 В РЯД</div>
                    <div class="game-card-stats">Играй с другом</div>
                </div>
                <div class="game-card" data-game="battleship">
                    <div class="game-card-icon">⚓</div>
                    <div class="game-card-title">МОРСКОЙ БОЙ</div>
                    <div class="game-card-stats">Сетевой / с ботом</div>
                </div>
                <div class="game-card" data-game="checkers">
                    <div class="game-card-icon">⚫</div>
                    <div class="game-card-title">ШАШКИ</div>
                    <div class="game-card-stats">Играй с другом</div>
                </div>
                <div class="game-card" data-game="dungeon">
                    <div class="game-card-icon">🐉</div>
                    <div class="game-card-title">ПОДЗЕМЕЛЬЕ</div>
                    <div class="game-card-stats">Рогалик</div>
                </div>
                <div class="game-card" data-game="cards">
                    <div class="game-card-icon">🃏</div>
                    <div class="game-card-title">КАРТЫ</div>
                    <div class="game-card-stats">Рогалик</div>
                </div>
                <div class="game-card" data-game="retro">
                    <div class="game-card-icon">🕹️</div>
                    <div class="game-card-title">РЕТРО</div>
                    <div class="game-card-stats">Эмулятор</div>
                </div>
                <div class="game-card" data-game="unity">
                    <div class="game-card-icon">🎮</div>
                    <div class="game-card-title">3D ИГРА</div>
                    <div class="game-card-stats">Unity WebGL</div>
                </div>
                <div class="game-card" data-game="unity_touch">
                    <div class="game-card-icon">📱</div>
                    <div class="game-card-title">3D ТАЧ</div>
                    <div class="game-card-stats">Для телефона</div>
                </div>
                <div class="game-card disabled">
                    <div class="game-card-badge">Скоро</div>
                    <div class="game-card-icon" style="opacity:0.4;">➕</div>
                    <div class="game-card-title">НОВАЯ ИГРА</div>
                    <div class="game-card-stats">В разработке</div>
                </div>
            </div>
            ${platformTabsHtml()}
        `);
        document.querySelectorAll('.game-card[data-game]').forEach(card => {
            card.addEventListener('click', function() {
                const game = this.getAttribute('data-game');
                if (game === 'ttt') { currentView = 'game_ttt'; showTicTacToe(); }
                else if (game === 'c4') { currentView = 'game_c4'; showConnectFour(); }
                else if (game === 'checkers') { currentView = 'game_checkers'; showCheckers(); }
                else if (game === 'battleship') { currentView = 'game_battleship'; showBattleshipLobby(); }
                else if (game === 'dungeon') openDungeonCrawl();
                else if (game === 'cards') openHouseOfCards();
                else if (game === 'retro') openRetroMenu();
                else if (game === 'unity') openUnity();
                else if (game === 'unity_touch') openUnityTouch();
            });
        });
        setupPlatformTabs();
    }

    async function renderPlatformLeaderboard() {
        render(`
            <h2>🏆 Рейтинг</h2>
            <p style="text-align:center; color:var(--text-dim);">Загрузка...</p>
            ${platformTabsHtml()}
        `);
        setupPlatformTabs();

        try {
            const r = await fetch(`${API_URL}/api/game/leaderboard`, { headers: HEADERS });
            const d = await r.json();
            let html = `<h2>🏆 Рейтинг</h2>`;

            if (!d.success || !d.leaderboard.length) {
                html += `<p style="text-align:center; color:var(--text-dim); margin-top:20px;">Пока никого нет. Сыграй первым!</p>`;
            } else {
                d.leaderboard.forEach((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                    const isMe = p.user_id === getUserId();
                    html += `
                        <div class="leaderboard-row ${isMe ? 'me' : ''}">
                            <div class="leaderboard-medal">${medal}</div>
                            <div class="leaderboard-info">
                                <div class="leaderboard-name">@${escapeHtml(p.username || 'игрок')}</div>
                                <div class="leaderboard-detail">⚔️ ${p.wins}П / ${p.losses}П / ${p.draws}Н</div>
                            </div>
                            <div class="leaderboard-rating">${p.rating}</div>
                        </div>
                    `;
                });
            }

            html += platformTabsHtml();
            render(html);
            setupPlatformTabs();
        } catch (e) {
            render(`<h2>🏆 Рейтинг</h2><p style="text-align:center; color:var(--accent-pink);">Ошибка загрузки</p>${platformTabsHtml()}`);
            setupPlatformTabs();
        }
    }

    function renderPlatformProfile() {
        const photoUrl = getPhotoUrl();
        const avatar = photoUrl
            ? `<img src="${photoUrl}" class="profile-avatar" alt="">`
            : `<div class="profile-avatar" style="display:flex;align-items:center;justify-content:center;font-size:28px;background:var(--bg-panel);">👤</div>`;

        render(`
            <h2>👤 Профиль</h2>
            <div class="profile-header">
                ${avatar}
                <div class="profile-info">
                    <h3>${escapeHtml(getFirstName())}</h3>
                    <p>@${escapeHtml(getUsername() || 'игрок')}</p>
                </div>
            </div>
            <div class="profile-stats">
                <div class="stat-box">
                    <span class="stat-value amber">${playerStats.wins || 0}</span>
                    <span class="stat-label">Побед</span>
                </div>
                <div class="stat-box">
                    <span class="stat-value">${playerStats.rating || 0}</span>
                    <span class="stat-label">Рейтинг</span>
                </div>
                <div class="stat-box">
                    <span class="stat-value">${playerStats.losses || 0}</span>
                    <span class="stat-label">Поражений</span>
                </div>
                <div class="stat-box">
                    <span class="stat-value">${playerStats.draws || 0}</span>
                    <span class="stat-label">Ничьих</span>
                </div>
            </div>
            ${platformTabsHtml()}
        `);
        setupPlatformTabs();
    }

    // ===== ОСТАЛЬНЫЕ ВИДЫ =====
    function showRates() {
        currentView = 'rates'; setBackBtnVisible(true); destroyChart();
        if (!rates) { render(`<h2>💵 Курсы валют</h2><p>Загрузка...</p>`); return; }
        render(`
            <h2>💵 Курсы валют</h2>
            <div class="rate-item" data-pair="USD-RUB"><span class="rate-label">🇺🇸 1 USD</span><span class="rate-value">${rates.usd_rub} RUB</span></div>
            <div class="rate-item" data-pair="USD-THB"><span class="rate-label">🇺🇸 1 USD</span><span class="rate-value">${rates.usd_thb} THB</span></div>
            <div class="rate-item" data-pair="THB-RUB"><span class="rate-label">🇹🇭 1 THB</span><span class="rate-value">${rates.thb_rub} RUB</span></div>
            <p style="font-size:12px; color:var(--text-dim); margin-top:12px; text-align:center;">Нажми на курс, чтобы увидеть график</p>
        `);
        document.querySelectorAll('.rate-item').forEach(el => {
            el.addEventListener('click', () => {
                currentRatePair = el.getAttribute('data-pair');
                currentView = 'chart';
                showChartScreen();
            });
        });
    }

    async function showChartScreen() {
        setBackBtnVisible(true);
        const [fromCur, toCur] = currentRatePair.split('-');
        const pairLabel = `${fromCur} → ${toCur}`;
        const currentPrice = getCurrentRate(fromCur, toCur);
        const currentPriceText = currentPrice !== null ? currentPrice.toFixed(currentPrice < 1 ? 4 : 2) : '—';
        render(`
            <h2>📈 ${pairLabel}</h2>
            <div style="text-align:center; margin: 12px 0 4px 0;">
                <span style="font-family:'Orbitron',sans-serif; font-size: 28px; font-weight: 700; color:var(--accent-amber); text-shadow: 0 0 15px rgba(255,170,0,0.5);">${currentPriceText}</span>
                <span style="font-size: 14px; color: var(--text-dim); margin-left: 4px;">${toCur}</span>
            </div>
            <div style="text-align:center; font-size: 12px; color: var(--text-dim); margin-bottom: 16px;">Текущий курс</div>
            <div id="chartChange" style="text-align:center; font-size: 15px; font-weight: 600; margin-bottom: 16px;">—</div>
            <div class="period-buttons">
                <button class="period-btn active" data-days="7">7 дней</button>
                <button class="period-btn" data-days="30">30 дней</button>
                <button class="period-btn" data-days="90">90 дней</button>
            </div>
            <div class="chart-container"><canvas id="rateChart"></canvas></div>
            <div id="chartMinMax" style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-dim); margin-top:8px; padding: 0 4px;">
                <span>Мин: —</span><span>Макс: —</span>
            </div>
            <p style="font-size:11px; color:var(--text-dim); text-align:center; margin-top:8px;" id="chartInfo">Загрузка...</p>
        `);
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadChart(fromCur, toCur, parseInt(btn.getAttribute('data-days')));
            });
        });
        loadChart(fromCur, toCur, 7);
    }

    async function loadChart(fromCur, toCur, days) {
        destroyChart();
        document.getElementById('chartInfo').textContent = 'Загрузка...';
        document.getElementById('chartChange').textContent = '—';
        document.getElementById('chartMinMax').innerHTML = '<span>Мин: —</span><span>Макс: —</span>';
        try {
            let url;
            if (toCur === 'RUB' || fromCur === 'RUB') {
                const base = fromCur === 'RUB' ? toCur : fromCur;
                url = `${API_URL}/api/rates/history_cbr?from=${base}&days=${days}`;
            } else {
                url = `${API_URL}/api/rates/history?from=${fromCur}&to=${toCur}&days=${days}`;
            }
            const r = await fetch(url, { headers: HEADERS });
            const d = await r.json();
            if (!d.success) { document.getElementById('chartInfo').textContent = '❌ ' + (d.error || 'Ошибка'); return; }
            const values = d.values;
            const currentPrice = getCurrentRate(fromCur, toCur);
            const firstValue = values[0];
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);
            const diff = currentPrice - firstValue;
            const diffPercent = (diff / firstValue) * 100;
            const decimals = currentPrice < 1 ? 4 : 2;
            const changeEl = document.getElementById('chartChange');
            if (diff >= 0) {
                changeEl.style.color = '#00ff9d';
                changeEl.textContent = `за ${days} дн.: ▲ +${diff.toFixed(decimals)} (${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(2)}%)`;
            } else {
                changeEl.style.color = '#ff2e63';
                changeEl.textContent = `за ${days} дн.: ▼ ${diff.toFixed(decimals)} (${diffPercent.toFixed(2)}%)`;
            }
            document.getElementById('chartMinMax').innerHTML = `<span>Мин: ${minValue.toFixed(decimals)}</span><span>Макс: ${maxValue.toFixed(decimals)}</span>`;
            const lineColor = diff >= 0 ? '#00ff9d' : '#ff2e63';
            const gradientColorTop = diff >= 0 ? 'rgba(0, 255, 157, 0.3)' : 'rgba(255, 46, 99, 0.3)';
            const gradientColorBottom = diff >= 0 ? 'rgba(0, 255, 157, 0.02)' : 'rgba(255, 46, 99, 0.02)';
            const ctx = document.getElementById('rateChart').getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 220);
            gradient.addColorStop(0, gradientColorTop);
            gradient.addColorStop(1, gradientColorBottom);
            currentChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: d.dates.map(date => { const [y, m, day] = date.split('-'); return `${day}.${m}`; }),
                    datasets: [{ label: `${d.from}/${d.to}`, data: values, borderColor: lineColor, backgroundColor: gradient, borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15, 27, 61, 0.95)', borderColor: '#00d4ff', borderWidth: 1, padding: 10, cornerRadius: 10, titleColor: '#00d4ff', bodyColor: '#e0e6f0', callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(decimals)} ${d.to}` } } },
                    scales: { x: { grid: { color: 'rgba(0, 212, 255, 0.05)' }, ticks: { color: '#8892b0', maxTicksLimit: 6 } }, y: { grid: { color: 'rgba(0, 212, 255, 0.05)' }, ticks: { color: '#8892b0' } } },
                    interaction: { intersect: false, mode: 'index' }
                }
            });
            document.getElementById('chartInfo').textContent = `Обновлено: ${new Date().toLocaleTimeString()}`;
        } catch (e) { document.getElementById('chartInfo').textContent = '❌ Ошибка загрузки'; }
    }

    function showWeather() {
        currentView = 'weather'; setBackBtnVisible(true);
        if (!weather) { render(`<h2>🌴 Погода</h2><p>Загрузка...</p>`); return; }
        const anim = chooseWeatherAnimation(weather);
        render(`
            <h2>🌴 Погода на Кочанге</h2>
            <div id="weather-animation-container" style="width:100%;max-width:320px;height:220px;margin:10px auto;"></div>
            <p style="text-align:center;font-size:17px;">🌡️ <b style="color:var(--accent-amber);">${weather.temp}</b></p>
            <p style="text-align:center;font-size:17px;">💨 <b style="color:var(--accent-blue);">${weather.wind}</b></p>
        `);
        const c = document.getElementById('weather-animation-container');
        if (c && window.lottie) { stopLottie(); lottieAnimation = lottie.loadAnimation({ container: c, renderer: 'svg', loop: true, autoplay: true, path: anim }); }
    }

    function chooseWeatherAnimation(w) {
        const code = w.weather_code || 0, wind = w.wind_value || 0, isDay = w.is_day === 1;
        if (code >= 95 && code <= 99) return WEATHER_ANIMATIONS.thunderstorm;
        if (wind > 60) return WEATHER_ANIMATIONS.hurricane;
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return WEATHER_ANIMATIONS.rain;
        if (wind > 40) return WEATHER_ANIMATIONS.strongWind;
        if (wind > 20) return WEATHER_ANIMATIONS.wind;
        return isDay ? WEATHER_ANIMATIONS.clearDay : WEATHER_ANIMATIONS.clearNight;
    }

    function showMouseDay() {
        currentView = 'mouse'; setBackBtnVisible(true);
        const days = mouseDay !== null ? mouseDay : '...';
        const phrase = MOUSE_PHRASES[Math.floor(Math.random() * MOUSE_PHRASES.length)];
        const anim = MOUSE_ANIMATIONS[Math.floor(Math.random() * MOUSE_ANIMATIONS.length)];
        render(`
            <h2>🐭 День мыши</h2>
            <div id="mouse-animation-container" style="width:100%;max-width:320px;height:220px;margin:10px auto;"></div>
            <p style="text-align:center;font-size:18px;margin-top:16px;">До 13 февраля осталось <b style="color:var(--accent-blue);">${days}</b> дней</p>
            <p style="text-align:center;font-style:italic;color:var(--text-dim);margin-top:10px;">${phrase}</p>
        `);
        const c = document.getElementById('mouse-animation-container');
        if (c && window.lottie) { stopLottie(); lottieAnimation = lottie.loadAnimation({ container: c, renderer: 'svg', loop: true, autoplay: true, path: anim }); }
    }

    function openBattleship() {
        const container = document.getElementById('battleship-container');
        const frame = document.getElementById('battleship-frame');
        frame.src = 'battleship/battleship.html';
        container.style.display = 'block';
        showCloseBtn();
    }

    var emuErrors = [];

    window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'emuLog') {
            emuErrors.push({ time: new Date().toLocaleTimeString(), type: e.data.logType, msg: e.data.msg });
            if (e.data.logType === 'err') {
                showEmuErrorBadge();
            }
        }
    });

    function showEmuErrorBadge() {
        var badge = document.getElementById('emu-error-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'emu-error-badge';
            badge.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999999;background:#e74c3c;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;font-family:sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);';
            badge.textContent = '⚠ Ошибка эмулятора (' + emuErrors.filter(function(e){return e.type==='err'}).length + ')';
            badge.onclick = function() {
                var text = emuErrors.map(function(e) { return '[' + e.time + '] ' + e.msg; }).join('\n');
                alert(text);
            };
            document.body.appendChild(badge);
        } else {
            badge.textContent = '⚠ Ошибка эмулятора (' + emuErrors.filter(function(e){return e.type==='err'}).length + ')';
        }
    }

    function openRetroMenu() {
        emuErrors = [];
        var badge = document.getElementById('emu-error-badge');
        if (badge) badge.remove();
        const container = document.getElementById('battleship-container');
        const frame = document.getElementById('battleship-frame');

        const GAMES = [
            { title: 'Micro Machines', rom: 'roms/Micro Machines/Micro Machines.gen', core: 'segaMD' },
            { title: 'Super',         rom: 'roms/Super/Super.nes',                    core: 'nes'     },
            { title: 'Nova the Squirrel', rom: 'roms/Nova the Squirrel/nova.nes',     core: 'nes'     }
        ];

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    body { margin:0; background:#0f1b3d; color:#e0e6f0; font-family: sans-serif; padding:16px; }
    h2 { color:#00d4ff; text-align:center; font-size:18px; margin:8px 0 16px; }
    .list { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .item {
        background:linear-gradient(145deg,#1a2a5c,#0f1b3d);
        border:1px solid #00d4ff44; border-radius:12px;
        padding:14px 8px; text-align:center; cursor:pointer;
        transition: 0.2s; user-select:none;
    }
    .item:active { transform: scale(0.96); border-color:#00d4ff; }
    .icon { font-size:28px; margin-bottom:6px; }
    .name { font-size:12px; font-weight:600; }
</style>
</head>
<body>
<h2>\u{1F579}\uFE0F \u0412\u044B\u0431\u0435\u0440\u0438 \u0438\u0433\u0440\u0443</h2>
<div class="list">
${GAMES.map(g => `<div class="item" data-rom="${g.rom}" data-core="${g.core}">
    <div class="icon">\u{1F3AE}</div>
    <div class="name">${g.title}</div>
</div>`).join('')}
</div>
<script>
document.querySelectorAll('.item').forEach(function(el) {
    el.addEventListener('click', function() {
        var rom = el.getAttribute('data-rom');
        var core = el.getAttribute('data-core');
        window.location.href = 'emulator.html?rom=' + encodeURIComponent(rom) + '&core=' + core;
    });
});
<\/script>
</body>
</html>`;

        frame.src = 'about:blank';
        frame.srcdoc = html;
        container.style.display = 'block';
        showCloseBtn();
    }

    function openDungeonCrawl() {
        const container = document.getElementById('battleship-container');
        const frame = document.getElementById('battleship-frame');
        frame.src = 'html-dungeon-crawl-main/html_dungeon_crawl.html';
        container.style.display = 'block';
        showCloseBtn();
    }

    function openHouseOfCards() {
        const container = document.getElementById('battleship-container');
        const frame = document.getElementById('battleship-frame');
        frame.src = 'HouseOfCards-main/builds/house_of_cards.html';
        container.style.display = 'block';
        showCloseBtn();
    }

    function openUnity() {
        const container = document.getElementById('battleship-container');
        const frame = document.getElementById('battleship-frame');
        frame.src = 'unity/index.html';
        container.style.display = 'block';
        showCloseBtn();
    }

    function openUnityTouch() {
        const container = document.getElementById('battleship-container');
        const frame = document.getElementById('battleship-frame');
        frame.src = 'unity_touch/index.html';
        container.style.display = 'block';
        showCloseBtn();
    }

    // ===== ГОМОКУ 10×10 =====
    async function showTicTacToe() {
        currentView = 'game_ttt';
        setBackBtnVisible(true);
        const user_id = getUserId();
        try {
            const r = await fetch(`${API_URL}/api/game/my_active?user_id=${user_id}`, { headers: HEADERS });
            const d = await r.json();
            if (d.success && d.games && d.games.length > 0) {
                await loadGameState(d.games[0].id);
            } else {
                renderTttLobby();
            }
        } catch (e) { renderTttLobby(); }
    }

    function renderTttLobby() {
        render(`
            <h2>🎯 Гомоку 10×10</h2>
            <p style="text-align:center; color:var(--text-dim); font-size:14px; margin-bottom:20px;">Собери 5 в ряд на поле 10×10. Создай игру и пригласи друга, или сыграй с ботом</p>
            <button class="action-btn" id="createGameBtn">➕ Создать игру</button>
            <button class="action-btn secondary" id="botGameBtn">🤖 Играть с ботом</button>
        `);
        document.getElementById('createGameBtn').addEventListener('click', createGame);
        document.getElementById('botGameBtn').addEventListener('click', startBotGame);
    }

    async function createGame() {
        try {
            const r = await fetch(`${API_URL}/api/game/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId() }) });
            const d = await r.json();
            if (d.success) await loadGameState(d.game_id);
        } catch (e) { alert('Ошибка'); }
    }

    async function startBotGame() {
        try {
            const r = await fetch(`${API_URL}/api/game/start_bot`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId() }) });
            const d = await r.json();
            if (d.success) await loadGameState(d.game_id);
        } catch (e) { alert('Ошибка'); }
    }

    async function loadGameState(game_id) {
        try {
            const user_id = getUserId();
            const r = await fetch(`${API_URL}/api/game/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
            const d = await r.json();
            if (!d.success) { renderTttLobby(); return; }
            currentGame = d.game;
            lastBoard = '';
            renderGameBoard();
            startGameAutoRefresh(game_id);
        } catch (e) { renderTttLobby(); }
    }

    function renderGameBoard() {
        const g = currentGame;
        const board = g.board.split('');
        let statusText = '', statusColor = 'var(--text-dim)';
        if (g.status === 'waiting') { statusText = '⏳ Ждём соперника...'; statusColor = 'var(--accent-amber)'; }
        else if (g.status === 'active') {
            if (g.is_my_turn) { statusText = '🎯 Твой ход'; statusColor = 'var(--accent-green)'; }
            else { statusText = g.is_vs_bot ? '🤖 Ход бота...' : '⏳ Ход соперника'; statusColor = 'var(--accent-amber)'; }
        } else if (g.status === 'finished') {
            if (g.winner_id === getUserId()) { statusText = '🏆 Ты победил!'; statusColor = 'var(--accent-green)'; }
            else if (g.winner_id === null) { statusText = '🤝 Ничья'; statusColor = 'var(--accent-blue)'; }
            else { statusText = '😔 Ты проиграл'; statusColor = 'var(--accent-pink)'; }
        }
        let winningLine = g.winning_line || null;
        let boardHtml = '<div class="ttt-board gomoku-board">';
        for (let i = 0; i < 100; i++) {
            const cell = board[i] || '-';
            let cellClass = 'ttt-cell';
            if (cell === 'X') cellClass += ' x';
            else if (cell === 'O') cellClass += ' o';
            if (winningLine && winningLine.includes(i)) cellClass += ' winning';
            const canClick = g.status === 'active' && g.is_my_turn && cell === '-';
            boardHtml += `<div class="${cellClass}" data-pos="${i}" ${canClick ? 'data-clickable="1"' : ''}>${cell === '-' ? '' : cell}</div>`;
        }
        boardHtml += '</div>';
        let opponentInfo = g.opponent_username ? `<p style="text-align:center; font-size:13px; color:var(--text-dim); margin-top:12px;">Соперник: ${escapeHtml(g.opponent_username)}</p>` : '';
        let buttonsHtml = '';
        if (g.status === 'waiting') buttonsHtml = `<button class="action-btn" id="inviteBtn">📨 Пригласить друга</button><button class="action-btn secondary" id="cancelGameBtn">❌ Отменить</button>`;
        else if (g.status === 'finished') buttonsHtml = `<button class="action-btn" id="newGameBtn">🔄 Новая игра</button><button class="action-btn secondary" id="backToPlatformBtn">🔙 К платформе</button>`;
        else buttonsHtml = `<button class="action-btn secondary" id="leaveGameBtn">🚪 Выйти</button>`;
        render(`
            <h2>🎯 Гомоку #${g.id}</h2>
            <p style="text-align:center; font-size:16px; font-weight:600; color:${statusColor}; margin-bottom:16px;">${statusText}</p>
            ${boardHtml}
            ${opponentInfo}
            <div style="margin-top:20px;">${buttonsHtml}</div>
        `);
        lastBoard = g.board;
        document.querySelectorAll('.ttt-cell[data-clickable="1"]').forEach(cell => {
            cell.addEventListener('click', function() { makeMove(parseInt(this.getAttribute('data-pos'))); });
        });
        const inviteBtn = document.getElementById('inviteBtn');
        if (inviteBtn) inviteBtn.addEventListener('click', () => openInviteDialog(g.id, 'ttt'));
        const cancelBtn = document.getElementById('cancelGameBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', cancelCurrentGame);
        const newGameBtn = document.getElementById('newGameBtn');
        if (newGameBtn) newGameBtn.addEventListener('click', () => { stopGameTimer(); currentGame = null; renderTttLobby(); });
        const backBtn = document.getElementById('backToPlatformBtn');
        if (backBtn) backBtn.addEventListener('click', () => { stopGameTimer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
        const leaveBtn = document.getElementById('leaveGameBtn');
        if (leaveBtn) leaveBtn.addEventListener('click', () => { stopGameTimer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
    }

    async function makeMove(position) {
        const g = currentGame;
        if (!g || g.status !== 'active' || !g.is_my_turn) return;
        try {
            const r = await fetch(`${API_URL}/api/game/move`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ game_id: g.id, user_id: getUserId(), position: position }) });
            const d = await r.json();
            if (d.success) await loadGameState(g.id);
        } catch (e) {}
    }

    function startGameAutoRefresh(game_id) {
        stopGameTimer();
        gameRefreshTimer = setInterval(async () => {
            if (currentView !== 'game_ttt') { stopGameTimer(); return; }
            try {
                const user_id = getUserId();
                const r = await fetch(`${API_URL}/api/game/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
                const d = await r.json();
                if (d.success) { currentGame = d.game; renderGameBoard(); }
            } catch (e) {}
        }, 3000);
    }

    function openInviteDialog(game_id, game_type) {
        const username = prompt('Введи @username друга (без @):');
        if (!username) return;
        sendInvite(game_id, username.replace('@', ''), game_type);
    }

    async function sendInvite(game_id, username, game_type) {
        try {
            const r = await fetch(`${API_URL}/api/game/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ game_id: game_id, username: username, from_username: getUsername(), game_type: game_type || 'ttt' }) });
            const d = await r.json();
            if (!d.success) { alert('❌ Не удалось найти игрока: ' + (d.error || 'unknown')); return; }
            alert(`✅ Приглашение отправлено @${d.invited_username}!`);
        } catch (e) { alert('Ошибка'); }
    }

    async function cancelCurrentGame() {
        if (!confirm('Отменить игру?')) return;
        if (currentGame) {
            try {
                await fetch(`${API_URL}/api/game/cancel`, {
                    method: 'POST', headers: HEADERS,
                    body: JSON.stringify({ game_id: currentGame.id, user_id: getUserId() })
                });
            } catch (e) {}
        }
        stopGameTimer();
        currentGame = null;
        renderTttLobby();
    }

    // ===== 4 В РЯД =====
    async function showConnectFour() {
        currentView = 'game_c4';
        setBackBtnVisible(true);
        const user_id = getUserId();
        try {
            const r = await fetch(`${API_URL}/api/game/c4/my_active?user_id=${user_id}`, { headers: HEADERS });
            const d = await r.json();
            if (d.success && d.games && d.games.length > 0) {
                await loadC4State(d.games[0].id);
            } else {
                renderC4Lobby();
            }
        } catch (e) { renderC4Lobby(); }
    }

    function renderC4Lobby() {
        render(`
            <h2>🔴 4 в ряд</h2>
            <p style="text-align:center; color:var(--text-dim); font-size:14px; margin-bottom:20px;">Бросай фишки и собери 4 в ряд</p>
            <button class="action-btn" id="createC4Btn">➕ Создать игру</button>
            <button class="action-btn secondary" id="botC4Btn">🤖 Играть с ботом</button>
        `);
        document.getElementById('createC4Btn').addEventListener('click', createC4Game);
        document.getElementById('botC4Btn').addEventListener('click', startC4BotGame);
    }

    async function createC4Game() {
        try {
            const r = await fetch(`${API_URL}/api/game/c4/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId() }) });
            const d = await r.json();
            if (d.success) await loadC4State(d.game_id);
        } catch (e) { alert('Ошибка'); }
    }

    async function startC4BotGame() {
        try {
            const r = await fetch(`${API_URL}/api/game/c4/start_bot`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId() }) });
            const d = await r.json();
            if (d.success) await loadC4State(d.game_id);
        } catch (e) { alert('Ошибка'); }
    }

    async function loadC4State(game_id) {
        try {
            const user_id = getUserId();
            const r = await fetch(`${API_URL}/api/game/c4/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
            const d = await r.json();
            if (!d.success) { renderC4Lobby(); return; }
            currentC4Game = d.game;
            renderC4Board();
            startC4AutoRefresh(game_id);
        } catch (e) { renderC4Lobby(); }
    }

    function renderC4Board() {
        const g = currentC4Game;
        const board = g.board.split('');
        const winningCells = g.winning_cells || [];
        let statusText = '', statusColor = 'var(--text-dim)';
        if (g.status === 'waiting') { statusText = '⏳ Ждём соперника...'; statusColor = 'var(--accent-amber)'; }
        else if (g.status === 'active') {
            if (g.is_my_turn) { statusText = '🎯 Твой ход — выбери столбец'; statusColor = 'var(--accent-green)'; }
            else { statusText = g.is_vs_bot ? '🤖 Ход бота...' : '⏳ Ход соперника'; statusColor = 'var(--accent-amber)'; }
        } else if (g.status === 'finished') {
            if (g.winner_id === getUserId()) { statusText = '🏆 Ты победил!'; statusColor = 'var(--accent-green)'; }
            else if (g.winner_id === null) { statusText = '🤝 Ничья'; statusColor = 'var(--accent-blue)'; }
            else { statusText = '😔 Ты проиграл'; statusColor = 'var(--accent-pink)'; }
        }
        let controlsHtml = '<div class="c4-controls">';
        for (let col = 0; col < 7; col++) {
            let canDrop = false;
            for (let row = 5; row >= 0; row--) {
                if (board[row * 7 + col] === '-') { canDrop = true; break; }
            }
            const canClick = g.status === 'active' && g.is_my_turn && canDrop;
            const arrow = canClick ? '⬇️' : (canDrop ? '·' : '✕');
            controlsHtml += `<button class="c4-column-btn" data-col="${col}" ${canClick ? '' : 'disabled'}>${arrow}</button>`;
        }
        controlsHtml += '</div>';
        const oldBoard = lastC4Board || '';
        const droppingCells = [];
        if (oldBoard.length === board.length) {
            for (let i = 0; i < board.length; i++) {
                if (oldBoard[i] !== board[i] && board[i] !== '-') droppingCells.push(i);
            }
        }
        let boardHtml = '<div class="c4-board">';
        for (let i = 0; i < 42; i++) {
            const cell = board[i];
            let cellClass = 'c4-cell';
            if (cell === 'X') cellClass += ' x';
            else if (cell === 'O') cellClass += ' o';
            if (droppingCells.includes(i)) cellClass += ' dropping';
            if (winningCells.includes(i)) cellClass += ' winning';
            boardHtml += `<div class="${cellClass}"></div>`;
        }
        boardHtml += '</div>';
        let opponentInfo = g.opponent_username ? `<p style="text-align:center; font-size:13px; color:var(--text-dim); margin-top:8px;">Соперник: ${escapeHtml(g.opponent_username)}</p>` : '';
        let buttonsHtml = '';
        if (g.status === 'waiting') buttonsHtml = `<button class="action-btn" id="inviteC4Btn">📨 Пригласить друга</button><button class="action-btn secondary" id="cancelC4Btn">❌ Отменить</button>`;
        else if (g.status === 'finished') buttonsHtml = `<button class="action-btn" id="newC4Btn">🔄 Новая игра</button><button class="action-btn secondary" id="backToPlatformC4Btn">🔙 К платформе</button>`;
        else buttonsHtml = `<button class="action-btn secondary" id="leaveC4Btn">🚪 Выйти</button>`;
        render(`
            <h2>🔴 4 в ряд #${g.id}</h2>
            <p style="text-align:center; font-size:15px; font-weight:600; color:${statusColor}; margin-bottom:10px;">${statusText}</p>
            ${controlsHtml}
            ${boardHtml}
            ${opponentInfo}
            <div style="margin-top:16px;">${buttonsHtml}</div>
        `);
        lastC4Board = g.board;
        document.querySelectorAll('.c4-column-btn').forEach(btn => {
            if (btn.disabled) return;
            btn.addEventListener('click', function() { makeC4Move(parseInt(this.getAttribute('data-col'))); });
        });
        const inviteC4Btn = document.getElementById('inviteC4Btn');
        if (inviteC4Btn) inviteC4Btn.addEventListener('click', () => openInviteDialog(g.id, 'c4'));
        const cancelC4Btn = document.getElementById('cancelC4Btn');
        if (cancelC4Btn) cancelC4Btn.addEventListener('click', async () => {
            if (currentC4Game) {
                try {
                    await fetch(`${API_URL}/api/game/c4/cancel`, {
                        method: 'POST', headers: HEADERS,
                        body: JSON.stringify({ game_id: currentC4Game.id, user_id: getUserId() })
                    });
                } catch (e) {}
            }
            stopC4Timer(); currentC4Game = null; renderC4Lobby();
        });
        const newC4Btn = document.getElementById('newC4Btn');
        if (newC4Btn) newC4Btn.addEventListener('click', () => { stopC4Timer(); currentC4Game = null; renderC4Lobby(); });
        const backBtn = document.getElementById('backToPlatformC4Btn');
        if (backBtn) backBtn.addEventListener('click', () => { stopC4Timer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
        const leaveC4Btn = document.getElementById('leaveC4Btn');
        if (leaveC4Btn) leaveC4Btn.addEventListener('click', () => { stopC4Timer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
    }

    async function makeC4Move(col) {
        const g = currentC4Game;
        if (!g || g.status !== 'active' || !g.is_my_turn) return;
        try {
            const r = await fetch(`${API_URL}/api/game/c4/move`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ game_id: g.id, user_id: getUserId(), col: col }) });
            const d = await r.json();
            if (d.success) {
                currentC4Game = { ...currentC4Game, board: d.board, status: d.status, winner_id: d.winner_id };
                renderC4Board();
                if (d.status === 'active') setTimeout(async () => { await loadC4State(g.id); }, 500);
                else await loadC4State(g.id);
            }
        } catch (e) {}
    }

    function startC4AutoRefresh(game_id) {
        stopC4Timer();
        c4RefreshTimer = setInterval(async () => {
            if (currentView !== 'game_c4') { stopC4Timer(); return; }
            try {
                const user_id = getUserId();
                const r = await fetch(`${API_URL}/api/game/c4/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
                const d = await r.json();
                if (d.success) { currentC4Game = d.game; renderC4Board(); }
            } catch (e) {}
        }, 3000);
    }

    // ===== ШАШКИ =====
    async function showCheckers() {
        currentView = 'game_checkers';
        setBackBtnVisible(true);
        const user_id = getUserId();
        try {
            const r = await fetch(`${API_URL}/api/game/checkers/my_active?user_id=${user_id}`, { headers: HEADERS });
            const d = await r.json();
            if (d.success && d.games && d.games.length > 0) {
                await loadCheckersState(d.games[0].id);
            } else {
                renderCheckersLobby();
            }
        } catch (e) { renderCheckersLobby(); }
    }

    function renderCheckersLobby() {
        render(`
            <h2>⚫ Шашки</h2>
            <p style="text-align:center; color:var(--text-dim); font-size:14px; margin-bottom:20px;">
                Русские шашки — собери соперника «в дамки» или забери все его фигуры
            </p>
            <button class="action-btn" id="createCheckersBtn">➕ Создать игру</button>
        `);
        document.getElementById('createCheckersBtn').addEventListener('click', createCheckersGame);
    }

    async function createCheckersGame() {
        try {
            const r = await fetch(`${API_URL}/api/game/checkers/create`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ user_id: getUserId() })
            });
            const d = await r.json();
            if (d.success) await loadCheckersState(d.game_id);
        } catch (e) { alert('Ошибка'); }
    }

    async function loadCheckersState(game_id) {
        try {
            const user_id = getUserId();
            const r = await fetch(`${API_URL}/api/game/checkers/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
            const d = await r.json();
            if (!d.success) { renderCheckersLobby(); return; }
            currentCheckersGame = d.game;
            selectedCell = null;
            renderCheckersBoard();
            startCheckersAutoRefresh(game_id);
        } catch (e) { renderCheckersLobby(); }
    }

    function renderCheckersBoard() {
        const g = currentCheckersGame;

        let statusText = '', statusColor = 'var(--text-dim)';
        if (g.status === 'waiting') { statusText = '⏳ Ждём соперника...'; statusColor = 'var(--accent-amber)'; }
        else if (g.status === 'active') {
            if (g.is_my_turn) { statusText = '🎯 Твой ход'; statusColor = 'var(--accent-green)'; }
            else { statusText = '⏳ Ход соперника'; statusColor = 'var(--accent-amber)'; }
        } else if (g.status === 'finished') {
            if (g.winner_id === getUserId()) { statusText = '🏆 Ты победил!'; statusColor = 'var(--accent-green)'; }
            else { statusText = '😔 Ты проиграл'; statusColor = 'var(--accent-pink)'; }
        }

        const pieces = parseCheckersFen(g.fen);

        let lastMoveCells = [];
        if (g.last_move) {
            const parts = g.last_move.split(/[-x]/);
            lastMoveCells = parts.map(p => parseInt(p)).filter(n => !isNaN(n));
        }

        let boardHtml = '<div class="checkers-board-wrapper"><div class="checkers-board">';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const isDark = (row + col) % 2 === 1;
                const cellClass = isDark ? 'checkers-cell dark' : 'checkers-cell light';

                let cellNum = null;
                if (isDark) {
                    const squaresInRowBefore = row * 4;
                    const offsetInRow = Math.floor(col / 2);
                    cellNum = squaresInRowBefore + offsetInRow + 1;
                }

                const piece = cellNum ? pieces[cellNum] : null;

                let cellExtra = '';
                let pieceHtml = '';

                if (piece) {
                    let pieceClass = `checkers-piece ${piece.color}`;
                    if (piece.isKing) pieceClass += ' king';
                    pieceHtml = `<div class="${pieceClass}"></div>`;
                }

                if (cellNum && selectedCell === cellNum) cellExtra += ' selected';
                if (cellNum && selectedCell && isLegalTarget(selectedCell, cellNum)) cellExtra += ' legal-target';
                if (cellNum && lastMoveCells.includes(cellNum)) cellExtra += ' last-move';

                const canClick = g.status === 'active' && g.is_my_turn && cellNum;

                boardHtml += `<div class="${cellClass}${cellExtra}${canClick ? ' playable' : ''}" data-cell="${cellNum || ''}">${pieceHtml}</div>`;
            }
        }
        boardHtml += '</div></div>';

        let opponentInfo = g.opponent_username ? `<p style="text-align:center; font-size:13px; color:var(--text-dim); margin-top:12px;">Соперник: ${escapeHtml(g.opponent_username)}</p>` : '';

        let buttonsHtml = '';
        if (g.status === 'waiting') {
            buttonsHtml = `<button class="action-btn" id="inviteCheckersBtn">📨 Пригласить друга</button><button class="action-btn secondary" id="cancelCheckersBtn">❌ Отменить</button>`;
        } else if (g.status === 'finished') {
            buttonsHtml = `<button class="action-btn" id="newCheckersBtn">🔄 Новая игра</button><button class="action-btn secondary" id="backToPlatformCheckersBtn">🔙 К платформе</button>`;
        } else {
            buttonsHtml = `<button class="action-btn secondary" id="leaveCheckersBtn">🚪 Выйти</button>`;
        }

        render(`
            <h2>⚫ Шашки #${g.id}</h2>
            <p style="text-align:center; font-size:15px; font-weight:600; color:${statusColor}; margin-bottom:10px;">${statusText}</p>
            ${boardHtml}
            ${opponentInfo}
            <div style="margin-top:16px;">${buttonsHtml}</div>
        `);

        document.querySelectorAll('.checkers-cell.playable').forEach(cell => {
            cell.addEventListener('click', function() {
                const cellNum = parseInt(this.getAttribute('data-cell'));
                onCheckersCellClick(cellNum);
            });
        });

        const inviteBtn = document.getElementById('inviteCheckersBtn');
        if (inviteBtn) inviteBtn.addEventListener('click', () => openInviteDialog(g.id, 'checkers'));
        const cancelBtn = document.getElementById('cancelCheckersBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', async () => {
            if (currentCheckersGame) {
                try {
                    await fetch(`${API_URL}/api/game/checkers/cancel`, {
                        method: 'POST', headers: HEADERS,
                        body: JSON.stringify({ game_id: currentCheckersGame.id, user_id: getUserId() })
                    });
                } catch (e) {}
            }
            stopCheckersTimer(); currentCheckersGame = null; renderCheckersLobby();
        });
        const newBtn = document.getElementById('newCheckersBtn');
        if (newBtn) newBtn.addEventListener('click', () => { stopCheckersTimer(); currentCheckersGame = null; renderCheckersLobby(); });
        const backBtn = document.getElementById('backToPlatformCheckersBtn');
        if (backBtn) backBtn.addEventListener('click', () => { stopCheckersTimer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
        const leaveBtn = document.getElementById('leaveCheckersBtn');
        if (leaveBtn) leaveBtn.addEventListener('click', () => { stopCheckersTimer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
    }

    function parseCheckersFen(fen) {
        const pieces = {};
        try {
            let fenClean = fen;
            const match = fen.match(/\[FEN "(.+?)"\]/);
            if (match) fenClean = match[1];

            const parts = fenClean.split(':');

            for (let i = 1; i < parts.length; i++) {
                let side = parts[i];
                const color = side.startsWith('W') ? 'white' : 'black';
                side = side.substring(1);

                if (!side) continue;

                side.split(',').forEach(cellStr => {
                    let isKing = false;
                    if (cellStr.startsWith('K')) {
                        isKing = true;
                        cellStr = cellStr.substring(1);
                    }
                    const cell = parseInt(cellStr);
                    if (!isNaN(cell)) {
                        pieces[cell] = { color, isKing };
                    }
                });
            }
        } catch (e) {
            console.error('Ошибка parseCheckersFen:', e);
        }
        return pieces;
    }

    function onCheckersCellClick(cellNum) {
        const g = currentCheckersGame;
        if (!g || g.status !== 'active' || !g.is_my_turn) return;

        const pieces = parseCheckersFen(g.fen);
        const piece = pieces[cellNum];

        if (selectedCell && isLegalTarget(selectedCell, cellNum)) {
            const moveStr = `${selectedCell}-${cellNum}`;
            makeCheckersMove(moveStr, selectedCell, cellNum);
            return;
        }

        if (piece && piece.color === g.my_color) {
            selectedCell = cellNum;
            renderCheckersBoard();
            return;
        }

        selectedCell = null;
        renderCheckersBoard();
    }

    function isLegalTarget(from, to) {
        const g = currentCheckersGame;
        if (!g || !g.legal_moves) return false;

        return g.legal_moves.some(moveStr => {
            const parts = moveStr.split(/[-x]/);
            return parts[0] === String(from) && parts[parts.length - 1] === String(to);
        });
    }

    async function makeCheckersMove(moveStr, from, to) {
        const g = currentCheckersGame;
        if (!g) return;

        let actualMove = null;
        if (g.legal_moves) {
            actualMove = g.legal_moves.find(m => {
                const parts = m.split(/[-x]/);
                return parts[0] === String(from) && parts[parts.length - 1] === String(to);
            });
        }

        if (!actualMove) {
            alert(`❌ Ход не найден: ${from}-${to}\nДоступные: ${JSON.stringify(g.legal_moves)}`);
            return;
        }

        try {
            const r = await fetch(`${API_URL}/api/game/checkers/move`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ game_id: g.id, user_id: getUserId(), move: actualMove })
            });
            const d = await r.json();
            if (d.success) {
                selectedCell = null;
                await loadCheckersState(g.id);
            } else {
                alert(`❌ Ошибка хода: ${d.error || 'unknown'}\nХод: ${actualMove}`);
                await loadCheckersState(g.id);
            }
        } catch (e) {
            alert(`❌ Сеть: ${e}`);
        }
    }

    function startCheckersAutoRefresh(game_id) {
        stopCheckersTimer();
        checkersRefreshTimer = setInterval(async () => {
            if (currentView !== 'game_checkers') { stopCheckersTimer(); return; }
            try {
                const user_id = getUserId();
                const r = await fetch(`${API_URL}/api/game/checkers/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
                const d = await r.json();
                if (d.success) {
                    currentCheckersGame = d.game;
                    renderCheckersBoard();
                }
            } catch (e) {}
        }, 3000);
    }

    // ===== МОРСКОЙ БОЙ (СЕТЕВОЙ) =====
    let currentBsGame = null;
    let bsRefreshTimer = null;
    let bsPlacement = Array(100).fill('-');
    let bsShipOrientation = 'horizontal';
    let bsCurrentShip = null;
    let bsPlacedShips = [];

    const BS_SHIPS = [
        { name: 'Carrier', size: 5, id: 'carrier' },
        { name: 'Battleship', size: 4, id: 'battleship' },
        { name: 'Cruiser', size: 3, id: 'cruiser' },
        { name: 'Submarine', size: 3, id: 'submarine' },
        { name: 'Destroyer', size: 2, id: 'destroyer' }
    ];

    async function showBattleshipLobby() {
        currentView = 'game_battleship';
        setBackBtnVisible(true);
        const user_id = getUserId();
        try {
            const r = await fetch(`${API_URL}/api/game/bs/my_active?user_id=${user_id}`, { headers: HEADERS });
            const d = await r.json();
            if (d.success && d.games && d.games.length > 0) {
                await loadBsState(d.games[0].id);
            } else {
                renderBsLobby();
            }
        } catch (e) { renderBsLobby(); }
    }

    function renderBsLobby() {
        render(`
            <h2>⚓ Морской бой</h2>
            <p style="text-align:center; color:var(--text-dim); font-size:14px; margin-bottom:20px;">Сразись с другом на поле 10×10. Расставь корабли и потопи врага!</p>
            <button class="action-btn" id="bsCreateBtn">➕ Создать игру</button>
            <button class="action-btn secondary" id="bsSingleBtn">🤖 Играть с ботом (офлайн)</button>
        `);
        document.getElementById('bsCreateBtn').addEventListener('click', createBsGame);
        document.getElementById('bsSingleBtn').addEventListener('click', () => {
            openBattleship();
        });
    }

    async function createBsGame() {
        try {
            const r = await fetch(`${API_URL}/api/game/bs/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId() }) });
            const d = await r.json();
            if (d.success) await loadBsState(d.game_id);
        } catch (e) { alert('Ошибка создания игры'); }
    }

    async function loadBsState(game_id) {
        try {
            const user_id = getUserId();
            const r = await fetch(`${API_URL}/api/game/bs/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
            const d = await r.json();
            if (!d.success) { renderBsLobby(); return; }
            currentBsGame = d.game;
            if (d.game.status === 'waiting') renderBsWaiting();
            else if (d.game.status === 'placing') renderBsPlacement();
            else if (d.game.status === 'active' || d.game.status === 'finished') renderBsBattle();
            startBsAutoRefresh(game_id);
        } catch (e) { renderBsLobby(); }
    }

    function renderBsWaiting() {
        const g = currentBsGame;
        render(`
            <h2>⚓ Морской бой #${g.id}</h2>
            <p style="text-align:center; font-size:16px; font-weight:600; color:var(--accent-amber); margin-bottom:16px;">⏳ Ждём соперника...</p>
            <p style="text-align:center; color:var(--text-dim); font-size:13px; margin-bottom:16px;">Игра создана. Пригласи друга!</p>
            <div style="margin-top:20px;">
                <button class="action-btn" id="bsInviteBtn">📨 Пригласить друга</button>
                <button class="action-btn secondary" id="bsCancelBtn">❌ Отменить</button>
            </div>
        `);
        document.getElementById('bsInviteBtn').addEventListener('click', () => openInviteDialog(g.id, 'battleship'));
        document.getElementById('bsCancelBtn').addEventListener('click', cancelBsGame);
    }

    function renderBsPlacement() {
        const g = currentBsGame;
        if (g.my_ready) {
            render(`
                <h2>⚓ Морской бой #${g.id}</h2>
                <p style="text-align:center; font-size:16px; font-weight:600; color:var(--accent-amber); margin-bottom:16px;">⏳ Ждём, пока соперник расставит корабли...</p>
                <div style="margin-top:20px;"><button class="action-btn secondary" id="bsCancelBtn">❌ Отменить</button></div>
            `);
            document.getElementById('bsCancelBtn').addEventListener('click', cancelBsGame);
            return;
        }
        bsPlacement = Array(100).fill('-');
        bsPlacedShips = [];
        bsCurrentShip = BS_SHIPS[0];
        bsShipOrientation = 'horizontal';
        renderBsPlacementBoard();
    }

    function renderBsPlacementBoard() {
        const g = currentBsGame;
        let shipsHtml = BS_SHIPS.map((s, i) => {
            const placed = bsPlacedShips.find(p => p.id === s.id);
            const active = bsCurrentShip && bsCurrentShip.id === s.id && !placed;
            let cls = 'bs-ship-item';
            if (placed) cls += ' placed';
            if (active) cls += ' active';
            return `<div class="${cls}" data-ship-idx="${i}">${s.name} (${s.size})${placed ? ' ✓' : ''}</div>`;
        }).join('');
        let boardHtml = '<div class="bs-grid bs-placement-grid">';
        for (let i = 0; i < 100; i++) {
            const r = Math.floor(i / 10), c = i % 10;
            const hasShip = bsPlacement[i] === 'S';
            let cls = 'bs-cell';
            if (hasShip) cls += ' ship';
            boardHtml += `<div class="${cls}" data-pos="${i}"></div>`;
        }
        boardHtml += '</div>';
        const allPlaced = bsPlacedShips.length === BS_SHIPS.length;
        render(`
            <h2>⚓ Расстановка кораблей</h2>
            <p style="text-align:center; color:var(--text-dim); font-size:13px; margin-bottom:12px;">Тапни по полю, чтобы поставить корабль. 🔄 — поворот.</p>
            <div class="bs-ship-list">${shipsHtml}</div>
            <div style="text-align:center; margin:10px 0;">
                <button class="action-btn secondary" id="bsRotateBtn" style="display:inline-block; width:auto; padding:8px 16px;">🔄 Поворот</button>
                <button class="action-btn secondary" id="bsRandomBtn" style="display:inline-block; width:auto; padding:8px 16px;">🎲 Случайно</button>
                <button class="action-btn secondary" id="bsClearBtn" style="display:inline-block; width:auto; padding:8px 16px;">🗑 Очистить</button>
            </div>
            ${boardHtml}
            <div style="margin-top:16px;">
                <button class="action-btn" id="bsReadyBtn" ${allPlaced ? '' : 'disabled'}>⚔️ Готов к бою!</button>
                <button class="action-btn secondary" id="bsCancelBtn">❌ Отменить</button>
            </div>
        `);
        document.querySelectorAll('.bs-placement-grid .bs-cell').forEach(cell => {
            cell.addEventListener('click', function() {
                const pos = parseInt(this.getAttribute('data-pos'));
                placeBsShip(pos);
            });
        });
        document.querySelectorAll('.bs-ship-item').forEach(item => {
            item.addEventListener('click', function() {
                const idx = parseInt(this.getAttribute('data-ship-idx'));
                const ship = BS_SHIPS[idx];
                if (!bsPlacedShips.find(p => p.id === ship.id)) {
                    bsCurrentShip = ship;
                    renderBsPlacementBoard();
                }
            });
        });
        document.getElementById('bsRotateBtn').addEventListener('click', () => {
            bsShipOrientation = bsShipOrientation === 'horizontal' ? 'vertical' : 'horizontal';
        });
        document.getElementById('bsRandomBtn').addEventListener('click', randomBsPlacement);
        document.getElementById('bsClearBtn').addEventListener('click', () => {
            bsPlacement = Array(100).fill('-');
            bsPlacedShips = [];
            bsCurrentShip = BS_SHIPS[0];
            renderBsPlacementBoard();
        });
        document.getElementById('bsReadyBtn').addEventListener('click', submitBsPlacement);
        document.getElementById('bsCancelBtn').addEventListener('click', cancelBsGame);
    }

    function placeBsShip(pos) {
        if (!bsCurrentShip) return;
        if (bsPlacedShips.find(p => p.id === bsCurrentShip.id)) return;
        const size = bsCurrentShip.size;
        const r = Math.floor(pos / 10), c = pos % 10;
        let cells = [];
        if (bsShipOrientation === 'horizontal') {
            if (c + size > 10) { alert('Не помещается!'); return; }
            for (let i = 0; i < size; i++) cells.push(r * 10 + c + i);
        } else {
            if (r + size > 10) { alert('Не помещается!'); return; }
            for (let i = 0; i < size; i++) cells.push((r + i) * 10 + c);
        }
        for (let cell of cells) {
            if (bsPlacement[cell] === 'S') { alert('Пересечение с другим кораблём!'); return; }
            const cr = Math.floor(cell / 10), cc = cell % 10;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = cr + dr, nc = cc + dc;
                    if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
                        if (bsPlacement[nr * 10 + nc] === 'S') {
                            alert('Корабли не должны касаться друг друга!'); return;
                        }
                    }
                }
            }
        }
        for (let cell of cells) bsPlacement[cell] = 'S';
        bsPlacedShips.push({ id: bsCurrentShip.id, cells });
        const nextShip = BS_SHIPS.find(s => !bsPlacedShips.find(p => p.id === s.id));
        bsCurrentShip = nextShip || null;
        renderBsPlacementBoard();
    }

    function randomBsPlacement() {
        bsPlacement = Array(100).fill('-');
        bsPlacedShips = [];
        for (let ship of BS_SHIPS) {
            let placed = false;
            for (let attempts = 0; attempts < 100 && !placed; attempts++) {
                const horizontal = Math.random() < 0.5;
                const maxR = horizontal ? 10 : 10 - ship.size;
                const maxC = horizontal ? 10 - ship.size : 10;
                const r = Math.floor(Math.random() * maxR);
                const c = Math.floor(Math.random() * maxC);
                let cells = [];
                let valid = true;
                for (let i = 0; i < ship.size; i++) {
                    const cell = horizontal ? r * 10 + c + i : (r + i) * 10 + c;
                    cells.push(cell);
                    if (bsPlacement[cell] === 'S') { valid = false; break; }
                    const cr = Math.floor(cell / 10), cc = cell % 10;
                    for (let dr = -1; dr <= 1 && valid; dr++) {
                        for (let dc = -1; dc <= 1 && valid; dc++) {
                            const nr = cr + dr, nc = cc + dc;
                            if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
                                if (bsPlacement[nr * 10 + nc] === 'S') valid = false;
                            }
                        }
                    }
                }
                if (valid) {
                    for (let cell of cells) bsPlacement[cell] = 'S';
                    bsPlacedShips.push({ id: ship.id, cells });
                    placed = true;
                }
            }
        }
        bsCurrentShip = BS_SHIPS.find(s => !bsPlacedShips.find(p => p.id === s.id)) || null;
        renderBsPlacementBoard();
    }

    async function submitBsPlacement() {
        if (bsPlacedShips.length !== BS_SHIPS.length) { alert('Расставь все корабли!'); return; }
        const board = bsPlacement.join('');
        try {
            const r = await fetch(`${API_URL}/api/game/bs/place`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ game_id: currentBsGame.id, user_id: getUserId(), board })
            });
            const d = await r.json();
            if (d.success) await loadBsState(currentBsGame.id);
            else alert('Ошибка: ' + (d.error || 'unknown'));
        } catch (e) { alert('Сеть: ' + e); }
    }

    function renderBsBattle() {
        const g = currentBsGame;
        let statusText = '', statusColor = 'var(--text-dim)';
        if (g.status === 'active') {
            if (g.is_my_turn) { statusText = '🎯 Твой ход — стреляй!'; statusColor = 'var(--accent-green)'; }
            else { statusText = '⏳ Ход соперника...'; statusColor = 'var(--accent-amber)'; }
        } else if (g.status === 'finished') {
            if (g.winner_id === getUserId()) { statusText = '🏆 Победа! Все корабли врага потоплены!'; statusColor = 'var(--accent-green)'; }
            else { statusText = '😔 Поражение. Твой флот уничтожен.'; statusColor = 'var(--accent-pink)'; }
        }
        const myBoard = g.my_board.split('');
        const myShots = g.my_shots.split('');
        const oppShots = (g.opp_shots || '-'.repeat(100)).split('');
        let myBoardHtml = '<div class="bs-grid">';
        for (let i = 0; i < 100; i++) {
            let cls = 'bs-cell';
            if (myBoard[i] === 'S') cls += ' ship';
            if (myBoard[i] === 'S' && oppShots[i] === 'H') cls += ' hit';
            else if (oppShots[i] === 'M') cls += ' miss';
            myBoardHtml += `<div class="${cls}"></div>`;
        }
        myBoardHtml += '</div>';
        let oppBoardHtml = '<div class="bs-grid">';
        for (let i = 0; i < 100; i++) {
            let cls = 'bs-cell';
            if (myShots[i] === 'H') cls += ' hit';
            else if (myShots[i] === 'M') cls += ' miss';
            const canClick = g.status === 'active' && g.is_my_turn && myShots[i] === '-';
            if (canClick) cls += ' clickable';
            oppBoardHtml += `<div class="${cls}" ${canClick ? `data-pos="${i}"` : ''}></div>`;
        }
        oppBoardHtml += '</div>';
        let buttonsHtml = '';
        if (g.status === 'finished') buttonsHtml = `<button class="action-btn" id="bsNewBtn">🔄 Новая игра</button><button class="action-btn secondary" id="bsBackBtn">🔙 К платформе</button>`;
        else buttonsHtml = `<button class="action-btn secondary" id="bsCancelBtn">❌ Отменить</button>`;
        render(`
            <h2>⚓ Морской бой #${g.id}</h2>
            <p style="text-align:center; font-size:16px; font-weight:600; color:${statusColor}; margin-bottom:12px;">${statusText}</p>
            <div class="bs-battle-boards">
                <div class="bs-board-section">
                    <h3>🛡 Твой флот (${g.my_ships_remaining})</h3>
                    ${myBoardHtml}
                </div>
                <div class="bs-board-section">
                    <h3>🎯 Враг (${g.opp_ships_remaining})</h3>
                    ${oppBoardHtml}
                </div>
            </div>
            ${g.opponent_username ? `<p style="text-align:center; font-size:13px; color:var(--text-dim); margin-top:12px;">Соперник: ${escapeHtml(g.opponent_username)}</p>` : ''}
            <div style="margin-top:16px;">${buttonsHtml}</div>
        `);
        document.querySelectorAll('.bs-grid .bs-cell[data-pos]').forEach(cell => {
            cell.addEventListener('click', function() {
                const pos = parseInt(this.getAttribute('data-pos'));
                bsShoot(pos);
            });
        });
        if (g.status === 'finished') {
            document.getElementById('bsNewBtn').addEventListener('click', () => { stopBsTimer(); currentBsGame = null; renderBsLobby(); });
            document.getElementById('bsBackBtn').addEventListener('click', () => { stopBsTimer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
        }
        const cancelBtn = document.getElementById('bsCancelBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', cancelBsGame);
    }

    function isBsCellHit(pos, game, isMyBoard) {
        if (!game) return false;
        const shots = isMyBoard ? game.opp_shots : game.my_shots;
        if (!shots) return false;
        return shots[pos] === 'H' || shots[pos] === 'M';
    }

    async function bsShoot(position) {
        const g = currentBsGame;
        if (!g || g.status !== 'active' || !g.is_my_turn) return;
        try {
            const r = await fetch(`${API_URL}/api/game/bs/shoot`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ game_id: g.id, user_id: getUserId(), position })
            });
            const d = await r.json();
            if (d.success) await loadBsState(g.id);
            else alert('Ошибка: ' + (d.error || 'unknown'));
        } catch (e) { alert('Сеть: ' + e); }
    }

    async function cancelBsGame() {
        if (!currentBsGame) return;
        try {
            await fetch(`${API_URL}/api/game/bs/cancel`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ game_id: currentBsGame.id, user_id: getUserId() })
            });
        } catch (e) {}
        stopBsTimer();
        currentBsGame = null;
        renderBsLobby();
    }

    function startBsAutoRefresh(game_id) {
        stopBsTimer();
        bsRefreshTimer = setInterval(async () => {
            if (currentView !== 'game_battleship') { stopBsTimer(); return; }
            try {
                const user_id = getUserId();
                const r = await fetch(`${API_URL}/api/game/bs/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
                const d = await r.json();
                if (d.success) {
                    currentBsGame = d.game;
                    if (d.game.status === 'waiting') renderBsWaiting();
                    else if (d.game.status === 'placing') renderBsPlacement();
                    else renderBsBattle();
                }
            } catch (e) {}
        }, 3000);
    }

    function stopBsTimer() {
        if (bsRefreshTimer) { clearInterval(bsRefreshTimer); bsRefreshTimer = null; }
    }

    // ===== СОБЫТИЯ =====
    function showEvents() {
        currentView = 'events'; setBackBtnVisible(true);
        let html = `<h2>📅 Мои события</h2>${renderTabs('mine')}<div class="events-list">`;
        if (!events || events.length === 0) html += `<p>У тебя пока нет событий</p>`;
        else events.forEach(e => { html += renderEventCard(e, true); });
        html += `</div><button class="action-btn" id="addEventBtn">➕ Добавить событие</button>`;
        html += `<button class="action-btn secondary" id="toggleHiddenBtn">${showHidden ? '🙈 Скрыть неактуальные' : '👁 Показать скрытые'}</button>`;
        render(html);
        document.getElementById('addEventBtn').addEventListener('click', openCreateScreen);
        document.getElementById('toggleHiddenBtn').addEventListener('click', toggleHidden);
        setupEventCardHandlers(true);
    }

    function showPublicEvents() {
        currentView = 'public_events'; setBackBtnVisible(true);
        let html = `<h2>🌍 Общие события</h2>${renderTabs('public')}<div class="events-list">`;
        if (!publicEvents || publicEvents.length === 0) html += `<p>Общих событий пока нет</p>`;
        else publicEvents.forEach(e => { html += renderEventCard(e, false); });
        html += `</div>`;
        render(html);
        setupEventCardHandlers(false);
    }

    function renderTabs(active) {
        return `<div class="tabs"><button class="${active === 'mine' ? 'tab active' : 'tab'}" id="tabMine">📅 Мои</button><button class="${active === 'public' ? 'tab active' : 'tab'}" id="tabPublic">🌍 Общие</button></div>`;
    }

    function renderEventCard(e, isMine) {
        const icon = e.is_public ? '🌍' : '🔒';
        const hiddenClass = e.is_hidden ? ' hidden-event' : '';
        const hideLabel = e.is_hidden ? '👁 Показать' : '🚫 Скрыть';
        const desc = e.description ? `<div class="event-card-desc">${escapeHtml(e.description)}</div>` : '';
        let thumb = e.image && imageCache[e.image] ? `<img src="${imageCache[e.image]}" class="event-thumb" alt="">` : `<span class="event-icon">${icon}</span>`;
        let menuBtn = '', menuBlock = '';
        if (isMine) {
            menuBtn = `<button class="event-menu-btn" data-role="toggle-menu" data-id="${e.id}">⋮</button>`;
            menuBlock = `<div class="event-menu" id="menu-${e.id}"><button data-role="edit" data-id="${e.id}">✏️ Редактировать</button><button data-role="hide" data-id="${e.id}" data-hidden="${e.is_hidden ? 1 : 0}">${hideLabel}</button><button class="danger" data-role="delete" data-id="${e.id}">🗑️ Удалить</button></div>`;
        }
        let author = !isMine && e.username ? `<div class="event-card-author">от @${escapeHtml(e.username)}</div>` : '';
        return `<div class="event-card${hiddenClass}" data-id="${e.id}"><div class="event-card-header" data-role="open-edit" data-id="${e.id}" data-mine="${isMine ? 1 : 0}">${thumb}<div class="event-card-info"><div class="event-card-name">${escapeHtml(e.name)}</div><div class="event-card-date">${e.date}</div>${desc}${author}</div>${menuBtn}</div>${menuBlock}</div>`;
    }

    function setupEventCardHandlers(isMine) {
        const tm = document.getElementById('tabMine'), tp = document.getElementById('tabPublic');
        if (tm) tm.addEventListener('click', showEvents);
        if (tp) tp.addEventListener('click', showPublicEvents);
        if (isMine) {
            document.querySelectorAll('[data-role="toggle-menu"]').forEach(btn => {
                btn.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    const id = this.getAttribute('data-id');
                    const menu = document.getElementById('menu-' + id);
                    const isOpen = menu.style.display === 'flex';
                    document.querySelectorAll('.event-menu').forEach(m => m.style.display = 'none');
                    if (!isOpen) menu.style.display = 'flex';
                });
            });
            document.querySelectorAll('[data-role="edit"]').forEach(btn => btn.addEventListener('click', function() { openEditScreen(this.getAttribute('data-id')); }));
            document.querySelectorAll('[data-role="hide"]').forEach(btn => btn.addEventListener('click', async function() { await hideEventApi(this.getAttribute('data-id'), this.getAttribute('data-hidden') !== '1'); await fetchAllData(); }));
            document.querySelectorAll('[data-role="delete"]').forEach(btn => btn.addEventListener('click', function() { const ev = events.find(e => e.id == this.getAttribute('data-id')); if (ev) openConfirmDelete(ev); }));
        }
        document.querySelectorAll('[data-role="open-edit"]').forEach(el => {
            el.addEventListener('click', function(ev) {
                if (ev.target.closest('[data-role="toggle-menu"]')) return;
                const id = this.getAttribute('data-id');
                if (this.getAttribute('data-mine') === '1') openEditScreen(id);
                else openViewScreen(id);
            });
        });
    }

    function toggleHidden() { showHidden = !showHidden; fetchAllData(); }

    function openViewScreen(id) {
        const ev = publicEvents.find(e => e.id == id); if (!ev) return;
        currentView = 'edit'; setBackBtnVisible(true);
        let img = ev.image && imageCache[ev.image] ? `<img src="${imageCache[ev.image]}" class="event-full-image" alt="">` : '';
        render(`<h2>🌍 ${escapeHtml(ev.name)}</h2>${img}<p><b>📅 Дата:</b> ${ev.date}</p>${ev.description ? `<p><b>📝 Описание:</b></p><p>${escapeHtml(ev.description)}</p>` : ''}<p style="font-size:12px;color:var(--text-dim);">от @${escapeHtml(ev.username || 'неизвестный')}</p><button class="action-btn secondary" id="backToListBtn">🔙 К списку</button>`);
        document.getElementById('backToListBtn').addEventListener('click', showPublicEvents);
    }

    function openCreateScreen() { editingEventId = null; editingImageFilename = ''; currentView = 'edit'; renderEditScreen(null); }
    function openEditScreen(id) { editingEventId = parseInt(id); const ev = events.find(e => e.id == editingEventId); editingImageFilename = ev ? (ev.image || '') : ''; currentView = 'edit'; renderEditScreen(ev); }
    function showEditScreen() { if (currentView !== 'edit') return; renderEditScreen(editingEventId ? events.find(e => e.id == editingEventId) : null); }

    function renderEditScreen(ev) {
        currentView = 'edit'; setBackBtnVisible(true);
        const title = ev ? '✏️ Редактирование' : '➕ Новое событие';
        const name = ev ? escapeHtml(ev.name) : '', date = ev ? ev.date : '';
        const desc = ev ? escapeHtml(ev.description || '') : '';
        const isPublic = ev ? ev.is_public : false, descLen = desc.length;
        let imageBlock = editingImageFilename && imageCache[editingImageFilename]
            ? `<img src="${imageCache[editingImageFilename]}" class="event-preview-image" alt=""><button type="button" class="action-btn secondary" id="removeImageBtn" style="margin-top:8px;">🗑️ Удалить фото</button>`
            : `<p style="font-size:13px;color:var(--text-dim);">Фото не загружено</p>`;
        render(`
            <h2>${title}</h2>
            <div class="form-group"><label>📷 Фото</label><div id="imagePreviewContainer">${imageBlock}</div><input type="file" id="edit-image-input" accept="image/*" style="display:none;"><button type="button" class="action-btn" id="uploadImageBtn" style="margin-top:8px;">📷 Загрузить фото</button></div>
            <div class="form-group"><label>Название</label><input type="text" id="edit-name" value="${name}" placeholder="Например: День рождения"></div>
            <div class="form-group"><label>Дата (ГГГГ-ММ-ДД)</label><input type="text" id="edit-date" value="${date}" placeholder="2027-12-31"></div>
            <div class="form-group"><label>Описание (до 200 символов)</label><textarea id="edit-desc" maxlength="200" placeholder="Кратко о событии...">${desc}</textarea><div class="char-counter" id="charCounter">${descLen} / 200</div></div>
            <div class="form-group"><label>Тип</label><div class="radio-group"><label><input type="radio" name="eventType" value="private" ${isPublic ? '' : 'checked'}> 🔒 Личное</label><label><input type="radio" name="eventType" value="public" ${isPublic ? 'checked' : ''}> 🌍 Общее</label></div></div>
            <button class="action-btn" id="saveBtn">💾 Сохранить</button>
            <button class="action-btn secondary" id="cancelEditBtn">❌ Отмена</button>
        `);
        document.getElementById('edit-desc').addEventListener('input', function() { document.getElementById('charCounter').textContent = this.value.length + ' / 200'; });
        const fi = document.getElementById('edit-image-input'), ub = document.getElementById('uploadImageBtn');
        ub.addEventListener('click', () => fi.click());
        fi.addEventListener('change', async function() {
            const f = this.files[0]; if (!f) return;
            if (f.size > 5 * 1024 * 1024) { alert('Максимум 5 МБ'); return; }
            ub.textContent = '⏳ Загрузка...'; ub.disabled = true;
            const res = await uploadImageApi(f);
            if (res.success) {
                editingImageFilename = res.filename;
                const localUrl = URL.createObjectURL(f);
                imageCache[editingImageFilename] = localUrl;
                document.getElementById('imagePreviewContainer').innerHTML = `<img src="${localUrl}" class="event-preview-image" alt=""><button type="button" class="action-btn secondary" id="removeImageBtn" style="margin-top:8px;">🗑️ Удалить фото</button>`;
                document.getElementById('removeImageBtn').addEventListener('click', function() { editingImageFilename = ''; document.getElementById('imagePreviewContainer').innerHTML = `<p style="font-size:13px;color:var(--text-dim);">Фото не загружено</p>`; });
            }
            ub.textContent = '📷 Загрузить фото'; ub.disabled = false; fi.value = '';
        });
        const rb = document.getElementById('removeImageBtn');
        if (rb) rb.addEventListener('click', function() { editingImageFilename = ''; document.getElementById('imagePreviewContainer').innerHTML = `<p style="font-size:13px;color:var(--text-dim);">Фото не загружено</p>`; });
        document.getElementById('saveBtn').addEventListener('click', saveEvent);
        document.getElementById('cancelEditBtn').addEventListener('click', function() { currentView = 'events'; showEvents(); });
    }

    async function saveEvent() {
        const name = document.getElementById('edit-name').value.trim();
        const date = document.getElementById('edit-date').value.trim();
        const description = document.getElementById('edit-desc').value.trim();
        const isPublic = document.querySelector('input[name="eventType"]:checked').value === 'public' ? 1 : 0;
        if (!name) { alert('Введи название'); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert('Неверный формат даты'); return; }
        const payload = { name, date, is_public: isPublic, description, image: editingImageFilename || '' };
        if (editingEventId) await updateEventApi(editingEventId, payload);
        else await addEventApi(payload);
        editingEventId = null; editingImageFilename = ''; currentView = 'events'; await fetchAllData();
    }

    function openConfirmDelete(ev) { pendingDeleteId = ev.id; document.getElementById('confirmText').textContent = `«${ev.name}» — ${ev.date}`; document.getElementById('confirmModal').style.display = 'flex'; }
    document.getElementById('confirmCancel').addEventListener('click', function() { pendingDeleteId = null; document.getElementById('confirmModal').style.display = 'none'; });
    document.getElementById('confirmDelete').addEventListener('click', async function() { if (pendingDeleteId) { await deleteEventApi(pendingDeleteId); pendingDeleteId = null; } document.getElementById('confirmModal').style.display = 'none'; await fetchAllData(); });

    document.addEventListener('click', function(e) { if (!e.target.closest('.event-menu') && !e.target.closest('[data-role="toggle-menu"]')) document.querySelectorAll('.event-menu').forEach(m => m.style.display = 'none'); });

    document.getElementById('backBtn').addEventListener('click', function() {
        stopLottie(); destroyChart(); stopGameTimer(); stopC4Timer(); stopCheckersTimer();
        if (currentView === 'edit') { currentView = 'events'; showEvents(); }
        else if (currentView === 'chart') { currentView = 'rates'; showRates(); }
        else if (currentView === 'game_ttt' || currentView === 'game_c4' || currentView === 'game_checkers') { currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); }
        else if (currentView === 'platform') { showMainMenu(); }
        else { showMainMenu(); }
    });

    var closeBtn = document.getElementById('closeBattleshipBtn');
    var closeBtnTimer = null;
    function showCloseBtn() {
        closeBtn.style.opacity = '1';
        closeBtn.style.pointerEvents = 'auto';
        clearTimeout(closeBtnTimer);
        closeBtnTimer = setTimeout(function() {
            closeBtn.style.opacity = '0';
            closeBtn.style.pointerEvents = 'none';
        }, 3000);
    }
    closeBtn.addEventListener('click', function() {
        document.getElementById('battleship-container').style.display = 'none';
        closeBtn.style.opacity = '1';
        closeBtn.style.pointerEvents = 'auto';
        clearTimeout(closeBtnTimer);
    });
    document.getElementById('battleship-container').addEventListener('click', function(e) {
        if (e.target === closeBtn) return;
        showCloseBtn();
    });

    function setupNavigation() {
        const nav = document.getElementById('mainMenu');
        if (!nav) return;
        nav.querySelectorAll('button').forEach(btn => {
            const a = btn.getAttribute('data-action');
            if (a === 'rates') btn.addEventListener('click', showRates);
            else if (a === 'weather') btn.addEventListener('click', showWeather);
            else if (a === 'mouse') btn.addEventListener('click', showMouseDay);
            else if (a === 'events') btn.addEventListener('click', showEvents);
            else if (a === 'games') {
                btn.addEventListener('click', () => {
                    currentView = 'platform';
                    currentPlatformTab = 'games';
                    showPlatform();
                });
            }
        });
    }

    async function init() { await loadPhrases(); await fetchAllData(); showMainMenu(); setupNavigation(); }
    init();
});