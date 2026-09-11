document.addEventListener('DOMContentLoaded', function() {

    // ===== ИНИЦИАЛИЗАЦИЯ TELEGRAM =====
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

    // ===== АНИМАЦИИ =====
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

    // ===== СОСТОЯНИЕ =====
    let events = [], publicEvents = [], rates = null, weather = null, mouseDay = null;
    let currentView = 'main';
    let showHidden = false;
    let editingEventId = null, editingImageFilename = '';
    let pendingDeleteId = null;
    let lottieAnimation = null;
    let currentChart = null;
    let currentRatePair = null;
    const imageCache = {};

    // ===== УТИЛИТЫ =====
    function getUserId() {
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) return tg.initDataUnsafe.user.id;
        return 0;
    }
    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }
    function render(html) { document.getElementById('content').innerHTML = html; }
    function setBackBtnVisible(v) { document.getElementById('backBtn').style.display = v ? 'block' : 'none'; }
    function stopLottie() { if (lottieAnimation) { lottieAnimation.destroy(); lottieAnimation = null; } }
    function destroyChart() { if (currentChart) { currentChart.destroy(); currentChart = null; } }

    // Получить текущий курс из rates (всегда актуальный)
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

    // ===== API =====
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

    // ===== ВИДЫ =====
    function renderCurrentView() {
        if (currentView !== 'mouse' && currentView !== 'weather') stopLottie();
        if (currentView === 'rates') showRates();
        else if (currentView === 'weather') showWeather();
        else if (currentView === 'mouse') showMouseDay();
        else if (currentView === 'events') showEvents();
        else if (currentView === 'public_events') showPublicEvents();
        else if (currentView === 'edit') showEditScreen();
        else if (currentView === 'chart') showChartScreen();
        else showMainMenu();
    }

    function showMainMenu() {
        currentView = 'main'; stopLottie(); destroyChart(); setBackBtnVisible(false);
        render(`<p>👋 Выбери раздел выше</p>`);
    }

    // ===== КУРСЫ =====
    function showRates() {
        currentView = 'rates'; setBackBtnVisible(true); destroyChart();
        if (!rates) { render(`<h2>💵 Курсы валют</h2><p>Загрузка...</p>`); return; }

        render(`
            <h2>💵 Курсы валют</h2>
            <div class="rate-item" data-pair="USD-RUB">
                <span class="rate-label">🇺🇸 1 USD</span>
                <span class="rate-value">${rates.usd_rub} RUB</span>
            </div>
            <div class="rate-item" data-pair="USD-THB">
                <span class="rate-label">🇺🇸 1 USD</span>
                <span class="rate-value">${rates.usd_thb} THB</span>
            </div>
            <div class="rate-item" data-pair="THB-RUB">
                <span class="rate-label">🇹🇭 1 THB</span>
                <span class="rate-value">${rates.thb_rub} RUB</span>
            </div>
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

    // ===== ГРАФИК =====
    async function showChartScreen() {
        setBackBtnVisible(true);
        const [fromCur, toCur] = currentRatePair.split('-');
        const pairLabel = `${fromCur} → ${toCur}`;

        // Текущая цена из rates (всегда актуальная)
        const currentPrice = getCurrentRate(fromCur, toCur);
        const currentPriceText = currentPrice !== null ? currentPrice.toFixed(currentPrice < 1 ? 4 : 2) : '—';

        render(`
            <h2>📈 ${pairLabel}</h2>
            <div style="text-align:center; margin: 12px 0 4px 0;">
                <span style="font-size: 28px; font-weight: 700;">${currentPriceText}</span>
                <span style="font-size: 14px; color: gray; margin-left: 4px;">${toCur}</span>
            </div>
            <div style="text-align:center; font-size: 12px; color: gray; margin-bottom: 16px;">
                Текущий курс
            </div>
            <div id="chartChange" style="text-align:center; font-size: 15px; font-weight: 600; margin-bottom: 16px;">—</div>
            <div class="period-buttons">
                <button class="period-btn active" data-days="7">7 дней</button>
                <button class="period-btn" data-days="30">30 дней</button>
                <button class="period-btn" data-days="90">90 дней</button>
            </div>
            <div class="chart-container"><canvas id="rateChart"></canvas></div>
            <div id="chartMinMax" style="display:flex; justify-content:space-between; font-size:12px; color:gray; margin-top:8px; padding: 0 4px;">
                <span>Мин: —</span>
                <span>Макс: —</span>
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

            if (!d.success) {
                document.getElementById('chartInfo').textContent = '❌ ' + (d.error || 'Не удалось загрузить');
                return;
            }

            const values = d.values;
            // Текущая цена — из rates, а не из истории
            const currentPrice = getCurrentRate(fromCur, toCur);
            const firstValue = values[0];
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);

            // Изменение считаем от первого значения периода до текущей цены
            const diff = currentPrice - firstValue;
            const diffPercent = (diff / firstValue) * 100;

            const decimals = currentPrice < 1 ? 4 : 2;

            // Показываем изменение
            const changeEl = document.getElementById('chartChange');
            if (diff >= 0) {
                changeEl.style.color = '#27ae60';
                changeEl.textContent = `за ${days} дн.: ▲ +${diff.toFixed(decimals)} (${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(2)}%)`;
            } else {
                changeEl.style.color = '#e74c3c';
                changeEl.textContent = `за ${days} дн.: ▼ ${diff.toFixed(decimals)} (${diffPercent.toFixed(2)}%)`;
            }

            document.getElementById('chartMinMax').innerHTML =
                `<span>Мин: ${minValue.toFixed(decimals)}</span><span>Макс: ${maxValue.toFixed(decimals)}</span>`;

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
                    labels: d.dates.map(date => {
                        const [y, m, day] = date.split('-');
                        return `${day}.${m}`;
                    }),
                    datasets: [{
                        label: `${d.from}/${d.to}`,
                        data: values,
                        borderColor: lineColor,
                        backgroundColor: gradient,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        pointHoverBackgroundColor: lineColor
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            padding: 10,
                            cornerRadius: 10,
                            callbacks: {
                                label: (ctx) => `${ctx.parsed.y.toFixed(decimals)} ${d.to}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { maxTicksLimit: 6, font: { size: 11 } }
                        },
                        y: {
                            grid: { color: 'rgba(0,0,0,0.05)' },
                            ticks: { font: { size: 11 } }
                        }
                    },
                    interaction: { intersect: false, mode: 'index' }
                }
            });

            document.getElementById('chartInfo').textContent = `Обновлено: ${new Date().toLocaleTimeString()}`;
        } catch (e) {
            document.getElementById('chartInfo').textContent = '❌ Ошибка загрузки';
        }
    }

    // ===== ПОГОДА =====
    function showWeather() {
        currentView = 'weather'; setBackBtnVisible(true);
        if (!weather) { render(`<h2>🌴 Погода</h2><p>Загрузка...</p>`); return; }
        const anim = chooseWeatherAnimation(weather);
        render(`
            <h2>🌴 Погода на Кочанге</h2>
            <div id="weather-animation-container" style="width:100%;max-width:320px;height:220px;margin:10px auto;"></div>
            <p style="text-align:center;font-size:17px;">🌡️ <b>${weather.temp}</b></p>
            <p style="text-align:center;font-size:17px;">💨 <b>${weather.wind}</b></p>
            <p style="text-align:center;font-size:12px;color:gray;margin-top:12px;">Обновлено: ${new Date().toLocaleTimeString()}</p>
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

    // ===== ДЕНЬ МЫШИ =====
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
        html += `</div><p style="font-size:12px;color:gray;text-align:center;margin-top:12px;">Все пользователи видят эти события</p>`;
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
        stopLottie(); destroyChart();
        if (currentView === 'edit') { currentView = 'events'; showEvents(); }
        else if (currentView === 'chart') { currentView = 'rates'; showRates(); }
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
        });
    }

    async function init() { await loadPhrases(); await fetchAllData(); showMainMenu(); setupNavigation(); }
    init();
});