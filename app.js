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
    // Для локального теста в браузере (на этом же компьютере):
    const API_URL = 'http://localhost:5000';
    // Для теста в Telegram на телефоне замени на свой ngrok URL, например:
    // const API_URL = 'https://puma-suction-anteater.ngrok-free.dev';

    const HEADERS = { 'ngrok-skip-browser-warning': 'true' };

    // ===== СОСТОЯНИЕ =====
    let events = [];
    let rates = null;
    let weather = null;
    let mouseDay = null;
    let currentView = 'main';
    let showHidden = false;
    let editingEventId = null; // null = создаём новое, число = редактируем

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
            mouseDay = data.mouseDay;
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

    // ===== ВИДЫ =====
    function renderCurrentView() {
        if (currentView === 'rates') showRates();
        else if (currentView === 'weather') showWeather();
        else if (currentView === 'mouse') showMouseDay();
        else if (currentView === 'events') showEvents();
        else if (currentView === 'edit') showEditScreen();
        else showMainMenu();
    }

    function showMainMenu() {
        currentView = 'main';
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

    function showMouseDay() {
        currentView = 'mouse';
        setBackBtnVisible(true);
        const days = mouseDay !== null ? mouseDay : '...';
        render(`
            <h2>🐭 День мыши</h2>
            <p>До 13 февраля осталось <b>${days}</b> дней</p>
        `);
    }

    // ===== СПИСОК СОБЫТИЙ =====
    function showEvents() {
        currentView = 'events';
        setBackBtnVisible(true);

        let html = `<h2>📅 Мои события</h2>`;
        html += `<div class="events-list">`;

        if (!events || events.length === 0) {
            html += `<p>У тебя пока нет событий</p>`;
        } else {
            events.forEach(e => {
                const icon = e.is_public ? '🌍' : '🔒';
                const hiddenClass = e.is_hidden ? ' hidden-event' : '';
                const hideLabel = e.is_hidden ? '👁 Показать' : '🚫 Скрыть';
                const desc = e.description ? `<div class="event-card-desc">${escapeHtml(e.description)}</div>` : '';

                html += `
                    <div class="event-card${hiddenClass}" data-id="${e.id}">
                        <div class="event-card-header" data-role="open-edit" data-id="${e.id}">
                            <span class="event-icon">${icon}</span>
                            <div class="event-card-info">
                                <div class="event-card-name">${escapeHtml(e.name)}</div>
                                <div class="event-card-date">${e.date}</div>
                                ${desc}
                            </div>
                            <button class="event-menu-btn" data-role="toggle-menu" data-id="${e.id}">⋮</button>
                        </div>
                        <div class="event-menu" id="menu-${e.id}">
                            <button data-role="edit" data-id="${e.id}">✏️ Редактировать</button>
                            <button data-role="hide" data-id="${e.id}" data-hidden="${e.is_hidden ? 1 : 0}">${hideLabel}</button>
                            <button class="danger" data-role="delete" data-id="${e.id}">🗑️ Удалить</button>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        html += `<button class="action-btn" id="addEventBtn">➕ Добавить событие</button>`;

        const toggleLabel = showHidden ? '🙈 Скрыть неактуальные' : '👁 Показать скрытые';
        html += `<button class="action-btn secondary" id="toggleHiddenBtn">${toggleLabel}</button>`;

        render(html);

        // Навешиваем обработчики
        document.getElementById('addEventBtn').addEventListener('click', openCreateScreen);
        document.getElementById('toggleHiddenBtn').addEventListener('click', toggleHidden);

        document.querySelectorAll('[data-role="toggle-menu"]').forEach(btn => {
            btn.addEventListener('click', function(ev) {
                ev.stopPropagation();
                const id = this.getAttribute('data-id');
                const menu = document.getElementById('menu-' + id);
                const isOpen = menu.style.display === 'flex';
                // Закрываем все меню
                document.querySelectorAll('.event-menu').forEach(m => m.style.display = 'none');
                // Открываем это, если было закрыто
                if (!isOpen) menu.style.display = 'flex';
            });
        });

        document.querySelectorAll('[data-role="open-edit"]').forEach(el => {
            el.addEventListener('click', function(ev) {
                // Если кликнули именно по кнопке ⋮, игнорируем
                if (ev.target.closest('[data-role="toggle-menu"]')) return;
                const id = this.getAttribute('data-id');
                openEditScreen(id);
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

    function toggleHidden() {
        showHidden = !showHidden;
        fetchAllData();
    }

    // ===== ЭКРАН РЕДАКТИРОВАНИЯ / СОЗДАНИЯ =====
    function openCreateScreen() {
        editingEventId = null;
        currentView = 'edit';
        renderEditScreen(null);
    }

    function openEditScreen(id) {
        editingEventId = parseInt(id);
        currentView = 'edit';
        const ev = events.find(e => e.id == editingEventId);
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

        render(`
            <h2>${title}</h2>

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

        // Счётчик символов
        const descEl = document.getElementById('edit-desc');
        const counter = document.getElementById('charCounter');
        descEl.addEventListener('input', function() {
            counter.textContent = this.value.length + ' / 200';
        });

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

        // Простая проверка даты
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            alert('Неверный формат даты. Используй ГГГГ-ММ-ДД');
            return;
        }

        if (editingEventId) {
            await updateEventApi(editingEventId, { name, date, is_public: isPublic, description });
        } else {
            await addEventApi({ name, date, is_public: isPublic, description });
        }

        editingEventId = null;
        currentView = 'events';
        await fetchAllData();
    }

    // ===== ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ =====
    let pendingDeleteId = null;

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

    // ===== ЗАКРЫТИЕ МЕНЮ ПРИ КЛИКЕ ВНЕ =====
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.event-menu') && !e.target.closest('[data-role="toggle-menu"]')) {
            document.querySelectorAll('.event-menu').forEach(m => m.style.display = 'none');
        }
    });

    // ===== КНОПКА НАЗАД =====
    document.getElementById('backBtn').addEventListener('click', function() {
        if (currentView === 'edit') {
            currentView = 'events';
            showEvents();
        } else {
            showMainMenu();
        }
    });

    // ===== НАВИГАЦИЯ =====
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
    fetchAllData();
    showMainMenu();
    setupNavigation();

    console.log('🚀 Приложение инициализировано');
});