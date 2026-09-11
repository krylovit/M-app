document.addEventListener('DOMContentLoaded', function() {

    let tg = null;
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
    } else {
        tg = { ready: function() {}, expand: function() {} };
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
    const imageCache = {};

    let currentGame = null;
    let gameRefreshTimer = null;
    let lastBoard = '';

    let currentC4Game = null;
    let c4RefreshTimer = null;
    let lastC4Board = '';

    function getUserId() {
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) return tg.initDataUnsafe.user.id;
        return 0;
    }
    function getUsername() {
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) return tg.initDataUnsafe.user.username || '';
        return '';
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
            renderCurrentView();
        } catch (e) { console.error('Ошибка API:', e); }
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
        if (currentView === 'rates') showRates();
        else if (currentView === 'weather') showWeather();
        else if (currentView === 'mouse') showMouseDay();
        else if (currentView === 'events') showEvents();
        else if (currentView === 'public_events') showPublicEvents();
        else if (currentView === 'edit') showEditScreen();
        else if (currentView === 'chart') showChartScreen();
        else if (currentView === 'games') showGamesMenu();
        else if (currentView === 'game_ttt') showTicTacToe();
        else if (currentView === 'game_c4') showConnectFour();
        else if (currentView === 'game_leaderboard') showLeaderboard();
        else showMainMenu();
    }

    function showMainMenu() {
        currentView = 'main'; stopLottie(); destroyChart(); stopGameTimer(); stopC4Timer(); setBackBtnVisible(false);
        render(`<p>👋 Выбери раздел выше</p>`);
    }

    function showRates() {
        currentView = 'rates'; setBackBtnVisible(true); destroyChart();
        if (!rates) { render(`<h2>💵 Курсы валют</h2><p>Загрузка...</p>`); return; }
        render(`
            <h2>💵 Курсы валют</h2>
            <div class="rate-item" data-pair="USD-RUB"><span class="rate-label">🇺🇸 1 USD</span><span class="rate-value">${rates.usd_rub} RUB</span></div>
            <div class="rate-item" data-pair="USD-THB"><span class="rate-label">🇺🇸 1 USD</span><span class="rate-value">${rates.usd_thb} THB</span></div>
            <div class="rate-item" data-pair="THB-RUB"><span class="rate-label">🇹🇭 1 THB</span><span class="rate-value">${rates.thb_rub} RUB</span></div>
            <p style="font-size:12px; color:gray; margin-top:12px; text-align:center;">Нажми на курс, чтобы увидеть график</p>
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
                <span style="font-size: 28px; font-weight: 700;">${currentPriceText}</span>
                <span style="font-size: 14px; color: gray; margin-left: 4px;">${toCur}</span>
            </div>
            <div style="text-align:center; font-size: 12px; color: gray; margin-bottom: 16px;">Текущий курс</div>
            <div id="chartChange" style="text-align:center; font-size: 15px; font-weight: 600; margin-bottom: 16px;">—</div>
            <div class="period-buttons">
                <button class="period-btn active" data-days="7">7 дней</button>
                <button class="period-btn" data-days="30">30 дней</button>
                <button class="period-btn" data-days="90">90 дней</button>
            </div>
            <div class="chart-container"><canvas id="rateChart"></canvas></div>
            <div id="chartMinMax" style="display:flex; justify-content:space-between; font-size:12px; color:gray; margin-top:8px; padding: 0 4px;">
                <span>Мин: —</span><span>Макс: —</span>
            </div>
            <p style="font-size:11px; color:gray; text-align:center; margin-top:8px;" id="chartInfo">Загрузка...</p>
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
                changeEl.style.color = '#27ae60';
                changeEl.textContent = `за ${days} дн.: ▲ +${diff.toFixed(decimals)} (${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(2)}%)`;
            } else {
                changeEl.style.color = '#e74c3c';
                changeEl.textContent = `за ${days} дн.: ▼ ${diff.toFixed(decimals)} (${diffPercent.toFixed(2)}%)`;
            }
            document.getElementById('chartMinMax').innerHTML = `<span>Мин: ${minValue.toFixed(decimals)}</span><span>Макс: ${maxValue.toFixed(decimals)}</span>`;
            const lineColor = diff >= 0 ? '#27ae60' : '#e74c3c';
            const gradientColorTop = diff >= 0 ? 'rgba(39, 174, 96, 0.3)' : 'rgba(231, 76, 60, 0.3)';
            const gradientColorBottom = diff >= 0 ? 'rgba(39, 174, 96, 0.02)' : 'rgba(231, 76, 60, 0.02)';
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
                    plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, cornerRadius: 10, callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(decimals)} ${d.to}` } } },
                    scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } }, y: { grid: { color: 'rgba(0,0,0,0.05)' } } },
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
            <p style="text-align:center;font-size:17px;">🌡️ <b>${weather.temp}</b></p>
            <p style="text-align:center;font-size:17px;">💨 <b>${weather.wind}</b></p>
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
            <p style="text-align:center;font-size:18px;margin-top:16px;">До 13 февраля осталось <b>${days}</b> дней</p>
            <p style="text-align:center;font-style:italic;color:var(--tg-theme-hint-color,#666);margin-top:10px;">${phrase}</p>
        `);
        const c = document.getElementById('mouse-animation-container');
        if (c && window.lottie) { stopLottie(); lottieAnimation = lottie.loadAnimation({ container: c, renderer: 'svg', loop: true, autoplay: true, path: anim }); }
    }

    function showGamesMenu() {
        currentView = 'games'; setBackBtnVisible(true); stopGameTimer(); stopC4Timer();
        render(`
            <h2>🎮 Игры</h2>
            <button class="action-btn" id="tttBtn">❌⭕ Крестики-нолики</button>
            <button class="action-btn" id="c4Btn">🔴 4 в ряд</button>
            <button class="action-btn secondary" id="leaderboardBtn">🏆 Рейтинг</button>
        `);
        document.getElementById('tttBtn').addEventListener('click', () => { currentView = 'game_ttt'; showTicTacToe(); });
        document.getElementById('c4Btn').addEventListener('click', () => { currentView = 'game_c4'; showConnectFour(); });
        document.getElementById('leaderboardBtn').addEventListener('click', () => { currentView = 'game_leaderboard'; showLeaderboard(); });
    }

    // ===== КРЕСТИКИ-НОЛИКИ =====
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
            <h2>❌⭕ Крестики-нолики</h2>
            <p style="text-align:center; color:gray; font-size:14px; margin-bottom:20px;">Создай игру и пригласи друга, или сыграй с ботом</p>
            <button class="action-btn" id="createGameBtn">➕ Создать игру</button>
            <button class="action-btn secondary" id="botGameBtn">🤖 Играть с ботом</button>
            <p style="font-size:12px; color:gray; margin-top:20px; text-align:center;">Ты будешь играть за ❌</p>
        `);
        document.getElementById('createGameBtn').addEventListener('click', createGame);
        document.getElementById('botGameBtn').addEventListener('click', startBotGame);
    }

    async function createGame() {
        try {
            const r = await fetch(`${API_URL}/api/game/create`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ user_id: getUserId() })
            });
            const d = await r.json();
            if (d.success) await loadGameState(d.game_id);
        } catch (e) { alert('Ошибка'); }
    }

    async function startBotGame() {
        try {
            const r = await fetch(`${API_URL}/api/game/start_bot`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ user_id: getUserId() })
            });
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

        let statusText = '', statusColor = 'gray';
        if (g.status === 'waiting') { statusText = '⏳ Ждём соперника...'; statusColor = '#f39c12'; }
        else if (g.status === 'active') {
            if (g.is_my_turn) { statusText = '🎯 Твой ход'; statusColor = '#27ae60'; }
            else { statusText = g.is_vs_bot ? '🤖 Ход бота...' : '⏳ Ход соперника'; statusColor = '#e67e22'; }
        } else if (g.status === 'finished') {
            if (g.winner_id === getUserId()) { statusText = '🏆 Ты победил!'; statusColor = '#27ae60'; }
            else if (g.winner_id === null) { statusText = '🤝 Ничья'; statusColor = '#3498db'; }
            else { statusText = '😔 Ты проиграл'; statusColor = '#e74c3c'; }
        }

        let winningLine = null;
        const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        for (const line of WIN_LINES) {
            const [a, b, c] = line;
            if (board[a] !== '-' && board[a] === board[b] && board[b] === board[c]) { winningLine = line; break; }
        }

        let boardHtml = '<div class="ttt-board">';
        for (let i = 0; i < 9; i++) {
            const cell = board[i];
            let cellClass = 'ttt-cell';
            if (cell === 'X') cellClass += ' x';
            else if (cell === 'O') cellClass += ' o';
            if (winningLine && winningLine.includes(i)) cellClass += ' winning';
            const canClick = g.status === 'active' && g.is_my_turn && cell === '-';
            boardHtml += `<div class="${cellClass}" data-pos="${i}" ${canClick ? 'data-clickable="1"' : ''}>${cell === '-' ? '' : cell}</div>`;
        }
        boardHtml += '</div>';

        let opponentInfo = g.opponent_username ? `<p style="text-align:center; font-size:13px; color:gray; margin-top:12px;">Соперник: ${escapeHtml(g.opponent_username)}</p>` : '';

        let buttonsHtml = '';
        if (g.status === 'waiting') {
            buttonsHtml = `<button class="action-btn" id="inviteBtn">📨 Пригласить друга</button><button class="action-btn secondary" id="cancelGameBtn">❌ Отменить</button>`;
        } else if (g.status === 'finished') {
            buttonsHtml = `<button class="action-btn" id="newGameBtn">🔄 Новая игра</button><button class="action-btn secondary" id="backToGamesBtn">🔙 К играм</button>`;
        } else {
            buttonsHtml = `<button class="action-btn secondary" id="leaveGameBtn">🚪 Выйти</button>`;
        }

        render(`
            <h2>❌⭕ Игра #${g.id}</h2>
            <p style="text-align:center; font-size:16px; font-weight:600; color:${statusColor}; margin-bottom:16px;">${statusText}</p>
            ${boardHtml}
            ${opponentInfo}
            <div style="margin-top:20px;">${buttonsHtml}</div>
        `);

        if (g.board !== lastBoard) {
            document.querySelectorAll('.ttt-cell.x, .ttt-cell.o').forEach(cell => {
                cell.style.animation = 'none';
                setTimeout(() => { cell.style.animation = ''; }, 10);
            });
        }
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
        const backBtn = document.getElementById('backToGamesBtn');
        if (backBtn) backBtn.addEventListener('click', () => { stopGameTimer(); showGamesMenu(); });
        const leaveBtn = document.getElementById('leaveGameBtn');
        if (leaveBtn) leaveBtn.addEventListener('click', () => { stopGameTimer(); showGamesMenu(); });
    }

    async function makeMove(position) {
        const g = currentGame;
        if (!g || g.status !== 'active' || !g.is_my_turn) return;
        try {
            const r = await fetch(`${API_URL}/api/game/move`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ game_id: g.id, user_id: getUserId(), position: position })
            });
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
            const r = await fetch(`${API_URL}/api/game/invite`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ game_id: game_id, username: username, from_username: getUsername(), game_type: game_type || 'ttt' })
            });
            const d = await r.json();
            if (!d.success) { alert('❌ Не удалось найти игрока: ' + (d.error || 'unknown')); return; }
            alert(`✅ Приглашение отправлено @${d.invited_username}!`);
        } catch (e) { alert('Ошибка'); }
    }

    async function cancelCurrentGame() {
        if (!confirm('Отменить игру?')) return;
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
            <p style="text-align:center; color:gray; font-size:14px; margin-bottom:20px;">
                Бросай фишки и собери 4 в ряд — по горизонтали, вертикали или диагонали
            </p>
            <button class="action-btn" id="createC4Btn">➕ Создать игру</button>
            <button class="action-btn secondary" id="botC4Btn">🤖 Играть с ботом</button>
        `);
        document.getElementById('createC4Btn').addEventListener('click', createC4Game);
        document.getElementById('botC4Btn').addEventListener('click', startC4BotGame);
    }

    async function createC4Game() {
        try {
            const r = await fetch(`${API_URL}/api/game/c4/create`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ user_id: getUserId() })
            });
            const d = await r.json();
            if (d.success) await loadC4State(d.game_id);
        } catch (e) { alert('Ошибка'); }
    }

    async function startC4BotGame() {
        try {
            const r = await fetch(`${API_URL}/api/game/c4/start_bot`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ user_id: getUserId() })
            });
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

        let statusText = '', statusColor = 'gray';
        if (g.status === 'waiting') { statusText = '⏳ Ждём соперника...'; statusColor = '#f39c12'; }
        else if (g.status === 'active') {
            if (g.is_my_turn) { statusText = '🎯 Твой ход — выбери столбец'; statusColor = '#27ae60'; }
            else { statusText = g.is_vs_bot ? '🤖 Ход бота...' : '⏳ Ход соперника'; statusColor = '#e67e22'; }
        } else if (g.status === 'finished') {
            if (g.winner_id === getUserId()) { statusText = '🏆 Ты победил!'; statusColor = '#27ae60'; }
            else if (g.winner_id === null) { statusText = '🤝 Ничья'; statusColor = '#3498db'; }
            else { statusText = '😔 Ты проиграл'; statusColor = '#e74c3c'; }
        }

        // Кнопки выбора столбца
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

        // Определяем новые клетки для анимации падения
        const oldBoard = lastC4Board || '';
        const droppingCells = [];
        if (oldBoard.length === board.length) {
            for (let i = 0; i < board.length; i++) {
                if (oldBoard[i] !== board[i] && board[i] !== '-') {
                    droppingCells.push(i);
                }
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

        let opponentInfo = g.opponent_username ? `<p style="text-align:center; font-size:13px; color:gray; margin-top:8px;">Соперник: ${escapeHtml(g.opponent_username)}</p>` : '';

        let buttonsHtml = '';
        if (g.status === 'waiting') {
            buttonsHtml = `<button class="action-btn" id="inviteC4Btn">📨 Пригласить друга</button><button class="action-btn secondary" id="cancelC4Btn">❌ Отменить</button>`;
        } else if (g.status === 'finished') {
            buttonsHtml = `<button class="action-btn" id="newC4Btn">🔄 Новая игра</button><button class="action-btn secondary" id="backToGamesC4Btn">🔙 К играм</button>`;
        } else {
            buttonsHtml = `<button class="action-btn secondary" id="leaveC4Btn">🚪 Выйти</button>`;
        }

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
            btn.addEventListener('click', function() {
                const col = parseInt(this.getAttribute('data-col'));
                makeC4Move(col);
            });
        });

        const inviteC4Btn = document.getElementById('inviteC4Btn');
        if (inviteC4Btn) inviteC4Btn.addEventListener('click', () => openInviteDialog(g.id, 'c4'));
        const cancelC4Btn = document.getElementById('cancelC4Btn');
        if (cancelC4Btn) cancelC4Btn.addEventListener('click', () => { stopC4Timer(); currentC4Game = null; renderC4Lobby(); });
        const newC4Btn = document.getElementById('newC4Btn');
        if (newC4Btn) newC4Btn.addEventListener('click', () => { stopC4Timer(); currentC4Game = null; renderC4Lobby(); });
        const backToGamesC4Btn = document.getElementById('backToGamesC4Btn');
        if (backToGamesC4Btn) backToGamesC4Btn.addEventListener('click', () => { stopC4Timer(); showGamesMenu(); });
        const leaveC4Btn = document.getElementById('leaveC4Btn');
        if (leaveC4Btn) leaveC4Btn.addEventListener('click', () => { stopC4Timer(); showGamesMenu(); });
    }

    async function makeC4Move(col) {
        const g = currentC4Game;
        if (!g || g.status !== 'active' || !g.is_my_turn) return;
        try {
            const r = await fetch(`${API_URL}/api/game/c4/move`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ game_id: g.id, user_id: getUserId(), col: col })
            });
            const d = await r.json();
            if (d.success) {
                currentC4Game = { ...currentC4Game, board: d.board, status: d.status, winner_id: d.winner_id };
                renderC4Board();

                if (d.status === 'active') {
                    setTimeout(async () => {
                        await loadC4State(g.id);
                    }, 500);
                } else {
                    await loadC4State(g.id);
                }
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

    // ===== РЕЙТИНГ =====
    async function showLeaderboard() {
        currentView = 'game_leaderboard';
        setBackBtnVisible(true);
        stopGameTimer(); stopC4Timer();
        render(`<h2>🏆 Рейтинг</h2><p style="text-align:center; color:gray;">Загрузка...</p>`);
        try {
            const r = await fetch(`${API_URL}/api/game/leaderboard`, { headers: HEADERS });
            const d = await r.json();
            if (!d.success || !d.leaderboard.length) {
                render(`<h2>🏆 Рейтинг</h2><p style="text-align:center; color:gray; margin-top:20px;">Пока никого нет.</p>`);
                return;
            }
            let html = `<h2>🏆 Рейтинг</h2><div style="margin-top:12px;">`;
            d.leaderboard.forEach((p, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                const isMe = p.user_id === getUserId();
                const bg = isMe ? 'background: rgba(51, 144, 236, 0.1);' : '';
                html += `<div style="display:flex; align-items:center; padding:10px 12px; border-radius:10px; margin-bottom:6px; ${bg}">
                    <div style="font-size:18px; width:36px;">${medal}</div>
                    <div style="flex:1;"><div style="font-weight:600;">@${escapeHtml(p.username || 'игрок')}</div>
                    <div style="font-size:12px; color:gray;">⚔️ ${p.wins}П / ${p.losses}П / ${p.draws}Н</div></div>
                    <div style="font-weight:700; color:#3390ec;">${p.rating}</div></div>`;
            });
            html += `</div>`;
            render(html);
        } catch (e) { render(`<h2>🏆 Рейтинг</h2><p style="text-align:center; color:red;">Ошибка</p>`); }
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
        render(`<h2>🌍 ${escapeHtml(ev.name)}</h2>${img}<p><b>📅 Дата:</b> ${ev.date}</p>${ev.description ? `<p><b>📝 Описание:</b></p><p>${escapeHtml(ev.description)}</p>` : ''}<p style="font-size:12px;color:gray;">от @${escapeHtml(ev.username || 'неизвестный')}</p><button class="action-btn secondary" id="backToListBtn">🔙 К списку</button>`);
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
            : `<p style="font-size:13px;color:gray;">Фото не загружено</p>`;
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
                document.getElementById('removeImageBtn').addEventListener('click', function() { editingImageFilename = ''; document.getElementById('imagePreviewContainer').innerHTML = `<p style="font-size:13px;color:gray;">Фото не загружено</p>`; });
            }
            ub.textContent = '📷 Загрузить фото'; ub.disabled = false; fi.value = '';
        });
        const rb = document.getElementById('removeImageBtn');
        if (rb) rb.addEventListener('click', function() { editingImageFilename = ''; document.getElementById('imagePreviewContainer').innerHTML = `<p style="font-size:13px;color:gray;">Фото не загружено</p>`; });
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
        stopLottie(); destroyChart(); stopGameTimer(); stopC4Timer();
        if (currentView === 'edit') { currentView = 'events'; showEvents(); }
        else if (currentView === 'chart') { currentView = 'rates'; showRates(); }
        else if (currentView === 'game_ttt' || currentView === 'game_c4' || currentView === 'game_leaderboard') { currentView = 'games'; showGamesMenu(); }
        else { showMainMenu(); }
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
            else if (a === 'games') btn.addEventListener('click', showGamesMenu);
        });
    }

    async function init() { await loadPhrases(); await fetchAllData(); showMainMenu(); setupNavigation(); }
    init();
});