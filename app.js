document.addEventListener('DOMContentLoaded', function() {

    // ===== ИНИЦИАЛИЗАЦИЯ TELEGRAM =====
    let tg = null;
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        console.log('✅ Telegram WebApp инициализирован');
    } else {
        console.warn('⚠️ Telegram WebApp не найден, работаем в браузере');
        tg = { ready: function() {}, expand: function() {} };
    }

    // ===== КОНФИГУРАЦИЯ API =====
    const API_URL = 'https://puma-suction-anteater.ngrok-free.dev';
    const HEADERS = { 'ngrok-skip-browser-warning': 'true' };

    // ===== АНИМАЦИИ "ДЕНЬ МЫШИ" =====
    const MOUSE_ANIMATIONS = [
        'animations/mouse-scroll.json',
        'animations/mouse-move.json',
        'animations/running-mouse.json'
    ];

    // Фразы загружаются из phrases.json (см. loadPhrases ниже)
    let MOUSE_PHRASES = ['🐭 Привет!'];

    // ===== СОСТОЯНИЕ =====
    let events = [];
    let publicEvents = [];
    let rates = null;
    let weather = null;
    let mouseDay = null;
    let currentView = 'main';
    let showHidden = false;
    let editingEventId = null;
    let editingImageFilename = '';
    let pendingDeleteId = null;
    let lottieAnimation = null;

    const imageCache = {};

    // ===== УТИЛИТЫ =====
    function getUserId() {
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
            return tg.initDataUnsafe.user.id;
        }
        return 0;
    }

    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"']/g, function(m) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
        });
    }

    function render(html) {
        document.getElementById('content').innerHTML = html;
    }

    function setBackBtnVisible(visible) {
        document.getElementById('backBtn').style.display = visible ? 'block' : 'none';
    }

    function stopLottie() {
        if (lottieAnimation) {
            lottieAnimation.destroy();
            lottieAnimation = null;
        }
    }

    // ===== ЗАГРУЗКА ФРАЗ ИЗ JSON =====
    async function loadPhrases() {
        try {
            const response = await fetch('phrases.json?v=' + Date.now());
            const data = await response.json();
            if (data.mouse_phrases && Array.isArray(data.mouse_phrases) && data.mouse_phrases.length > 0) {
                MOUSE_PHRASES = data.mouse_phrases;
                console.log('✅ Фразы загружены:', MOUSE_PHRASES.length);
            }
        } catch (e) {
            console.warn('⚠️ Не удалось загрузить phrases.json, использую дефолт:', e);
        }
    }

    // ===== ЗАГРУЗКА КАРТИНОК =====
    async function getImageUrl(filename) {
        if (!filename) return '';
        if (imageCache[filename]) return imageCache[filename];

        try {
            const response = await fetch(`${API_URL}/api/uploads/${filename}`, {
                headers: HEADERS
            });
            if (!response.ok) return '';
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            imageCache[filename] = url;
            return url;
        } catch (e) {
            console.error('❌ Ошибка загрузки фото:', filename, e);
            return '';
        }
    }

    async function preloadAllImages() {
        const allImages = new Set();
        events.forEach(e => { if (e.image) allImages.add(e.image); });
        publicEvents.forEach(e => { if (e.image) allImages.add(e.image); });
        await Promise.all([...allImages].map(getImageUrl));
    }

    // ===== API =====
    async function fetchAllData() {
        try {
            const user_id = getUserId();
            const url = `${API_URL}/api/all?user_id=${user_id}&include_hidden=${showHidden ? 1 : 0}`;
            const response = await fetch(url, { headers: HEADERS });
            const data = await response.json();
            console.log('📥 Данные от API:', data);
            rates = data.rates;
            weather = data.weather;
            events = data.events;
            publicEvents = data.public_events || [];
            mouseDay = data.mouseDay;

            await preloadAllImages();
            renderCurrentView();
        } catch (e) {
            console.error('❌ Ошибка запроса к API:', e);
        }
    }

    async function addEventApi(payload) {
        const response = await fetch(`${API_URL}/api/add_event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...HEADERS },
            body: JSON.stringify({ user_id: getUserId(), ...payload })
        });
        return await response.json();
    }

    async function updateEventApi(id, payload) {
        const response = await fetch(`${API_URL}/api/event/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...HEADERS },
            body: JSON.stringify({ user_id: getUserId(), ...payload })
        });
        return await response.json();
    }

    async function deleteEventApi(id) {
        const response = await fetch(`${API_URL}/api/event/${id}?user_id=${getUserId()}`, {
            method: 'DELETE',
            headers: HEADERS
        });
        return await response.json();
    }

    async function hideEventApi(id, isHidden) {
        const response = await fetch(`${API_URL}/api/event/${id}/hide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...HEADERS },
            body: JSON.stringify({ user_id: getUserId(), is_hidden: isHidden })
        });
        return await response.json();
    }

    async function uploadImageApi(file) {
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch(`${API_URL}/api/upload_image`, {
            method: 'POST',
            headers: HEADERS,
            body: formData
        });
        return await response.json();
    }

    // ===== ВИДЫ =====
    function renderCurrentView() {
        if (currentView !== 'mouse') stopLottie();

        if (currentView === 'rates') showRates();
        else if (currentView === 'weather') showWeather();
        else if (currentView === 'mouse') showMouseDay();
        else if (currentView === 'events') showEvents();
        else if (currentView === 'public_events') showPublicEvents();
        else if (currentView === 'edit') showEditScreen();
        else showMainMenu();
    }

    function showMainMenu() {
        currentView = 'main';
        stopLottie();
        setBackBtnVisible(false);
        render(`<p>👋 Выбери раздел выше</p>`);
    }

    function showRates() {
        currentView = 'rates';
        setBackBtnVisible(true);
        if (!rates) {
            render(`<h2>💵 Курсы валют</h2><p>Загрузка...</p>`);
            return;
        }
        render(`
            <h2>💵 Курсы валют</h2>
            <p>🇺🇸 1 USD = <b>${rates.usd_rub}</b> RUB</p>
            <p>🇺🇸 1 USD = <b>${rates.usd_thb}</b> THB</p>
            <p>🇹🇭 1 THB = <b>${rates.thb_rub}</b> RUB</p>
            <p style="font-size:12px; color:gray; margin-top:10px;">Обновлено: ${new Date().toLocaleTimeString()}</p>
        `);
    }

    function showWeather() {
        currentView = 'weather';
        setBackBtnVisible(true);
        if (!weather) {
            render(`<h2>🌴 Погода на Кочанге</h2><p>Загрузка...</p>`);
            return;
        }
        render(`
            <h2>🌴 Погода на Кочанге</h2>
            <p>🌡️ <b>${weather.temp}</b></p>
            <p>💨 <b>${weather.wind}</b></p>
            <p style="font-size:12px; color:gray; margin-top:10px;">Обновлено: ${new Date().toLocaleTimeString()}</p>
        `);
    }

    // ===== ДЕНЬ МЫШИ С LOTTIE =====
    function showMouseDay() {
        currentView = 'mouse';
        setBackBtnVisible(true);

        const days = mouseDay !== null ? mouseDay : '...';
        const randomPhrase = MOUSE_PHRASES[Math.floor(Math.random() * MOUSE_PHRASES.length)];
        const randomAnimation = MOUSE_ANIMATIONS[Math.floor(Math.random() * MOUSE_ANIMATIONS.length)];

        render(`
            <h2>🐭 День мыши</h2>
            <div id="mouse-animation-container" style="width: 100%; max-width: 320px; height: 220px; margin: 10px auto;"></div>
            <p style="text-align: center; font-size: 18px; margin-top: 16px;">
                До 13 февраля осталось <b>${days}</b> дней
            </p>
            <p style="text-align: center; font-style: italic; color: var(--tg-theme-hint-color, #666); margin-top: 10px;">
                ${randomPhrase}
            </p>
        `);

        const container = document.getElementById('mouse-animation-container');
        if (container && window.lottie) {
            stopLottie();
            lottieAnimation = lottie.loadAnimation({
                container: container,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: randomAnimation
            });
            console.log('🎬 Lottie:', randomAnimation);
        } else {
            console.warn('⚠️ Lottie не загружен или контейнер не найден');
        }
    }

    // ===== МОИ СОБЫТИЯ =====
    function showEvents() {
        currentView = 'events';
        setBackBtnVisible(true);

        let html = `<h2>📅 Мои события</h2>`;
        html += renderTabs('mine');
        html += `<div class="events-list">`;

        if (!events || events.length === 0) {
            html += `<p>У тебя пока нет событий</p>`;
        } else {
            events.forEach(e => {
                html += renderEventCard(e, true);
            });
        }

        html += `</div>`;
        html += `<button class="action-btn" id="addEventBtn">➕ Добавить событие</button>`;

        const toggleLabel = showHidden ? '🙈 Скрыть неактуальные' : '👁 Показать скрытые';
        html += `<button class="action-btn secondary" id="toggleHiddenBtn">${toggleLabel}</button>`;

        render(html);

        document.getElementById('addEventBtn').addEventListener('click', openCreateScreen);
        document.getElementById('toggleHiddenBtn').addEventListener('click', toggleHidden);
        setupEventCardHandlers(true);
    }

    function showPublicEvents() {
        currentView = 'public_events';
        setBackBtnVisible(true);

        let html = `<h2>🌍 Общие события</h2>`;
        html += renderTabs('public');
        html += `<div class="events-list">`;

        if (!publicEvents || publicEvents.length === 0) {
            html += `<p>Общих событий пока нет</p>`;
        } else {
            publicEvents.forEach(e => {
                html += renderEventCard(e, false);
            });
        }

        html += `</div>`;
        html += `<p style="font-size:12px; color:gray; text-align:center; margin-top:12px;">Все пользователи видят эти события</p>`;

        render(html);
        setupEventCardHandlers(false);
    }

    function renderTabs(active) {
        const mineClass = active === 'mine' ? 'tab active' : 'tab';
        const publicClass = active === 'public' ? 'tab active' : 'tab';
        return `
            <div class="tabs">
                <button class="${mineClass}" id="tabMine">📅 Мои</button>
                <button class="${publicClass}" id="tabPublic">🌍 Общие</button>
            </div>
        `;
    }

    function renderEventCard(e, isMine) {
        const icon = e.is_public ? '🌍' : '🔒';
        const hiddenClass = e.is_hidden ? ' hidden-event' : '';
        const hideLabel = e.is_hidden ? '👁 Показать' : '🚫 Скрыть';
        const desc = e.description ? `<div class="event-card-desc">${escapeHtml(e.description)}</div>` : '';

        let thumb = '';
        if (e.image && imageCache[e.image]) {
            thumb = `<img src="${imageCache[e.image]}" class="event-thumb" alt="">`;
        } else {
            thumb = `<span class="event-icon">${icon}</span>`;
        }

        let menuBtn = '';
        let menuBlock = '';
        if (isMine) {
            menuBtn = `<button class="event-menu-btn" data-role="toggle-menu" data-id="${e.id}">⋮</button>`;
            menuBlock = `
                <div class="event-menu" id="menu-${e.id}">
                    <button data-role="edit" data-id="${e.id}">✏️ Редактировать</button>
                    <button data-role="hide" data-id="${e.id}" data-hidden="${e.is_hidden ? 1 : 0}">${hideLabel}</button>
                    <button class="danger" data-role="delete" data-id="${e.id}">🗑️ Удалить</button>
                </div>
            `;
        }

        let author = '';
        if (!isMine && e.username) {
            author = `<div class="event-card-author">от @${escapeHtml(e.username)}</div>`;
        }

        return `
            <div class="event-card${hiddenClass}" data-id="${e.id}">
                <div class="event-card-header" data-role="open-edit" data-id="${e.id}" data-mine="${isMine ? 1 : 0}">
                    ${thumb}
                    <div class="event-card-info">
                        <div class="event-card-name">${escapeHtml(e.name)}</div>
                        <div class="event-card-date">${e.date}</div>
                        ${desc}
                        ${author}
                    </div>
                    ${menuBtn}
                </div>
                ${menuBlock}
            </div>
        `;
    }

    function setupEventCardHandlers(isMine) {
        const tabMine = document.getElementById('tabMine');
        const tabPublic = document.getElementById('tabPublic');
        if (tabMine) tabMine.addEventListener('click', showEvents);
        if (tabPublic) tabPublic.addEventListener('click', showPublicEvents);

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

            document.querySelectorAll('[data-role="edit"]').forEach(btn => {
                btn.addEventListener('click', function() {
                    openEditScreen(this.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('[data-role="hide"]').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const id = this.getAttribute('data-id');
                    const isHidden = this.getAttribute('data-hidden') === '1';
                    await hideEventApi(id, !isHidden);
                    await fetchAllData();
                });
            });

            document.querySelectorAll('[data-role="delete"]').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    const ev = events.find(e => e.id == id);
                    if (ev) openConfirmDelete(ev);
                });
            });
        }

        document.querySelectorAll('[data-role="open-edit"]').forEach(el => {
            el.addEventListener('click', function(ev) {
                if (ev.target.closest('[data-role="toggle-menu"]')) return;
                const id = this.getAttribute('data-id');
                const mine = this.getAttribute('data-mine') === '1';
                if (mine) {
                    openEditScreen(id);
                } else {
                    openViewScreen(id);
                }
            });
        });
    }

    function toggleHidden() {
        showHidden = !showHidden;
        fetchAllData();
    }

    function openViewScreen(id) {
        const ev = publicEvents.find(e => e.id == id);
        if (!ev) return;
        currentView = 'edit';
        setBackBtnVisible(true);

        let img = '';
        if (ev.image && imageCache[ev.image]) {
            img = `<img src="${imageCache[ev.image]}" class="event-full-image" alt="">`;
        }

        const desc = ev.description ? `<p>${escapeHtml(ev.description)}</p>` : '';

        render(`
            <h2>🌍 ${escapeHtml(ev.name)}</h2>
            ${img}
            <p><b>📅 Дата:</b> ${ev.date}</p>
            ${desc ? `<p><b>📝 Описание:</b></p>${desc}` : ''}
            <p style="font-size:12px; color:gray;">от @${escapeHtml(ev.username || 'неизвестный')}</p>
            <button class="action-btn secondary" id="backToListBtn">🔙 К списку</button>
        `);

        document.getElementById('backToListBtn').addEventListener('click', showPublicEvents);
    }

    function openCreateScreen() {
        editingEventId = null;
        editingImageFilename = '';
        currentView = 'edit';
        renderEditScreen(null);
    }

    function openEditScreen(id) {
        editingEventId = parseInt(id);
        const ev = events.find(e => e.id == editingEventId);
        editingImageFilename = ev ? (ev.image || '') : '';
        currentView = 'edit';
        renderEditScreen(ev);
    }

    function showEditScreen() {
        if (currentView !== 'edit') return;
        const ev = editingEventId ? events.find(e => e.id == editingEventId) : null;
        renderEditScreen(ev);
    }

    function renderEditScreen(ev) {
        currentView = 'edit';
        setBackBtnVisible(true);

        const title = ev ? '✏️ Редактирование' : '➕ Новое событие';
        const name = ev ? escapeHtml(ev.name) : '';
        const date = ev ? ev.date : '';
        const desc = ev ? escapeHtml(ev.description || '') : '';
        const isPublic = ev ? ev.is_public : false;
        const descLen = desc.length;

        let imageBlock = '';
        if (editingImageFilename && imageCache[editingImageFilename]) {
            imageBlock = `
                <img src="${imageCache[editingImageFilename]}" class="event-preview-image" alt="">
                <button type="button" class="action-btn secondary" id="removeImageBtn" style="margin-top:8px;">🗑️ Удалить фото</button>
            `;
        } else {
            imageBlock = `<p style="font-size:13px; color:gray;">Фото не загружено</p>`;
        }

        render(`
            <h2>${title}</h2>

            <div class="form-group">
                <label>📷 Фото события</label>
                <div id="imagePreviewContainer">${imageBlock}</div>
                <input type="file" id="edit-image-input" accept="image/*" style="display:none;">
                <button type="button" class="action-btn" id="uploadImageBtn" style="margin-top:8px;">📷 Загрузить фото</button>
            </div>

            <div class="form-group">
                <label>Название</label>
                <input type="text" id="edit-name" value="${name}" placeholder="Например: День рождения">
            </div>

            <div class="form-group">
                <label>Дата (ГГГГ-ММ-ДД)</label>
                <input type="text" id="edit-date" value="${date}" placeholder="2027-12-31">
            </div>

            <div class="form-group">
                <label>Описание (до 200 символов)</label>
                <textarea id="edit-desc" maxlength="200" placeholder="Кратко о событии...">${desc}</textarea>
                <div class="char-counter" id="charCounter">${descLen} / 200</div>
            </div>

            <div class="form-group">
                <label>Тип события</label>
                <div class="radio-group">
                    <label><input type="radio" name="eventType" value="private" ${isPublic ? '' : 'checked'}> 🔒 Личное</label>
                    <label><input type="radio" name="eventType" value="public" ${isPublic ? 'checked' : ''}> 🌍 Общее</label>
                </div>
            </div>

            <button class="action-btn" id="saveBtn">💾 Сохранить</button>
            <button class="action-btn secondary" id="cancelEditBtn">❌ Отмена</button>
        `);

        const descEl = document.getElementById('edit-desc');
        const counter = document.getElementById('charCounter');
        descEl.addEventListener('input', function() {
            counter.textContent = this.value.length + ' / 200';
        });

        const fileInput = document.getElementById('edit-image-input');
        const uploadBtn = document.getElementById('uploadImageBtn');

        uploadBtn.addEventListener('click', function() {
            fileInput.click();
        });

        fileInput.addEventListener('change', async function() {
            const file = this.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                alert('Фото слишком большое. Максимум 5 МБ.');
                return;
            }

            uploadBtn.textContent = '⏳ Загрузка...';
            uploadBtn.disabled = true;

            const result = await uploadImageApi(file);
            if (result.success) {
                editingImageFilename = result.filename;
                const localUrl = URL.createObjectURL(file);
                imageCache[editingImageFilename] = localUrl;

                const container = document.getElementById('imagePreviewContainer');
                container.innerHTML = `
                    <img src="${localUrl}" class="event-preview-image" alt="">
                    <button type="button" class="action-btn secondary" id="removeImageBtn" style="margin-top:8px;">🗑️ Удалить фото</button>
                `;
                document.getElementById('removeImageBtn').addEventListener('click', function() {
                    editingImageFilename = '';
                    const c = document.getElementById('imagePreviewContainer');
                    c.innerHTML = `<p style="font-size:13px; color:gray;">Фото не загружено</p>`;
                });
            } else {
                alert('Ошибка загрузки: ' + (result.error || 'неизвестная'));
            }

            uploadBtn.textContent = '📷 Загрузить фото';
            uploadBtn.disabled = false;
            fileInput.value = '';
        });

        const removeBtn = document.getElementById('removeImageBtn');
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                editingImageFilename = '';
                const c = document.getElementById('imagePreviewContainer');
                c.innerHTML = `<p style="font-size:13px; color:gray;">Фото не загружено</p>`;
            });
        }

        document.getElementById('saveBtn').addEventListener('click', saveEvent);
        document.getElementById('cancelEditBtn').addEventListener('click', function() {
            currentView = 'events';
            showEvents();
        });
    }

    async function saveEvent() {
        const name = document.getElementById('edit-name').value.trim();
        const date = document.getElementById('edit-date').value.trim();
        const description = document.getElementById('edit-desc').value.trim();
        const isPublic = document.querySelector('input[name="eventType"]:checked').value === 'public' ? 1 : 0;

        if (!name) {
            alert('Введи название события');
            return;
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            alert('Неверный формат даты. Используй ГГГГ-ММ-ДД');
            return;
        }

        const payload = {
            name,
            date,
            is_public: isPublic,
            description,
            image: editingImageFilename || ''
        };

        if (editingEventId) {
            await updateEventApi(editingEventId, payload);
        } else {
            await addEventApi(payload);
        }

        editingEventId = null;
        editingImageFilename = '';
        currentView = 'events';
        await fetchAllData();
    }

    function openConfirmDelete(ev) {
        pendingDeleteId = ev.id;
        document.getElementById('confirmText').textContent = `«${ev.name}» — ${ev.date}`;
        document.getElementById('confirmModal').style.display = 'flex';
    }

    document.getElementById('confirmCancel').addEventListener('click', function() {
        pendingDeleteId = null;
        document.getElementById('confirmModal').style.display = 'none';
    });

    document.getElementById('confirmDelete').addEventListener('click', async function() {
        if (pendingDeleteId) {
            await deleteEventApi(pendingDeleteId);
            pendingDeleteId = null;
        }
        document.getElementById('confirmModal').style.display = 'none';
        await fetchAllData();
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.event-menu') && !e.target.closest('[data-role="toggle-menu"]')) {
            document.querySelectorAll('.event-menu').forEach(m => m.style.display = 'none');
        }
    });

    document.getElementById('backBtn').addEventListener('click', function() {
        stopLottie();
        if (currentView === 'edit') {
            currentView = 'events';
            showEvents();
        } else {
            showMainMenu();
        }
    });

    function setupNavigation() {
        const nav = document.getElementById('mainMenu');
        if (!nav) return;

        nav.querySelectorAll('button').forEach(btn => {
            const action = btn.getAttribute('data-action');
            if (action === 'rates') btn.addEventListener('click', showRates);
            else if (action === 'weather') btn.addEventListener('click', showWeather);
            else if (action === 'mouse') btn.addEventListener('click', showMouseDay);
            else if (action === 'events') btn.addEventListener('click', showEvents);
        });
    }

    // ===== СТАРТ =====
    async function init() {
        await loadPhrases();   // сначала фразы
        await fetchAllData();  // потом данные
        showMainMenu();
        setupNavigation();
    }
    init();

    console.log('🚀 Приложение инициализировано. API:', API_URL);
});