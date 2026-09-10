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

    // ===== АДРЕС API (ngrok) =====
    const API_URL = 'https://puma-suction-anteater.ngrok-free.dev';

    // Заголовок для обхода предупреждения ngrok
    const HEADERS = {
        'ngrok-skip-browser-warning': 'true'
    };

    // ===== СОСТОЯНИЕ =====
    let events = [];
    let rates = null;
    let weather = null;
    let mouseDay = null;
    let currentView = 'main';

    // ===== ПОЛУЧЕНИЕ user_id =====
    function getUserId() {
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
            return tg.initDataUnsafe.user.id;
        }
        return 0;
    }

    // ===== ЗАПРОСЫ К API =====
    async function fetchAllData() {
        try {
            const user_id = getUserId();
            const response = await fetch(`${API_URL}/api/all?user_id=${user_id}`, {
                headers: HEADERS
            });
            const data = await response.json();
            console.log('📥 Получены данные от API:', data);
            rates = data.rates;
            weather = data.weather;
            events = data.events;
            mouseDay = data.mouseDay;
            if (currentView === 'rates') showRates();
            else if (currentView === 'weather') showWeather();
            else if (currentView === 'events') showEvents();
            else if (currentView === 'mouse') showMouseDay();
        } catch (e) {
            console.error('❌ Ошибка запроса к API:', e);
        }
    }

    async function addEventToBot(name, date, isPublic) {
        try {
            const user_id = getUserId();
            const response = await fetch(`${API_URL}/api/add_event`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ user_id, name, date, is_public: isPublic })
            });
            const result = await response.json();
            if (result.success) {
                await fetchAllData();
            }
        } catch (e) {
            console.error('❌ Ошибка добавления события:', e);
        }
    }

    // ===== ОТОБРАЖЕНИЕ =====
    function render(html) {
        const content = document.getElementById('content');
        if (content) content.innerHTML = html;
    }

    function showMainMenu() {
        currentView = 'main';
        document.getElementById('backBtn').style.display = 'none';
        render(`
            <p>👋 Выбери раздел выше</p>
            <p style="font-size:12px; color:var(--tg-theme-hint-color, gray); margin-top:12px;">
                ${tg ? '✅ Подключено к Telegram' : '⚠️ Работаем в браузере'}
            </p>
        `);
    }

    function showRates() {
        currentView = 'rates';
        document.getElementById('backBtn').style.display = 'block';
        if (!rates) {
            render(`<h2>💵 Курсы валют</h2><p>Загрузка...</p>`);
            fetchAllData();
            return;
        }
        render(`
            <h2>💵 Курсы валют</h2>
            <p>🇺🇸 1 USD = <b>${rates.usd_rub}</b> RUB</p>
            <p>🇺🇸 1 USD = <b>${rates.usd_thb}</b> THB</p>
            <p>🇹🇭 1 THB = <b>${rates.thb_rub}</b> RUB</p>
            <p style="font-size:12px; color:gray;">Обновлено: ${new Date().toLocaleTimeString()}</p>
        `);
    }

    function showWeather() {
        currentView = 'weather';
        document.getElementById('backBtn').style.display = 'block';
        if (!weather) {
            render(`<h2>🌴 Погода на Кочанге</h2><p>Загрузка...</p>`);
            fetchAllData();
            return;
        }
        render(`
            <h2>🌴 Погода на Кочанге</h2>
            <p>🌡️ <b>${weather.temp}</b></p>
            <p>💨 <b>${weather.wind}</b></p>
            <p style="font-size:12px; color:gray;">Обновлено: ${new Date().toLocaleTimeString()}</p>
        `);
    }

    function showMouseDay() {
        currentView = 'mouse';
        document.getElementById('backBtn').style.display = 'block';
        const days = mouseDay !== null ? mouseDay : '...';
        render(`
            <h2>🐭 День мыши</h2>
            <p>До 13 февраля осталось <b>${days}</b> дней</p>
        `);
    }

    function showEvents() {
        currentView = 'events';
        document.getElementById('backBtn').style.display = 'block';
        if (!events) {
            render(`<h2>📅 Мои события</h2><p>Загрузка...</p>`);
            fetchAllData();
            return;
        }
        let html = `<h2>📅 Мои события</h2>`;
        if (events.length === 0) {
            html += `<p>У тебя пока нет событий</p>`;
        } else {
            events.forEach(e => {
                const icon = e.is_public ? '🌍' : '🔒';
                html += `<div class="event-item">${icon} <b>${e.name}</b> — ${e.date}</div>`;
            });
        }
        html += `
            <div style="margin-top:16px;">
                <button id="addEventBtn" style="padding:10px 20px; border:none; border-radius:10px; background:var(--tg-theme-button-color, #0088cc); color:#fff; font-weight:600; cursor:pointer; width:100%;">
                    ➕ Добавить событие
                </button>
            </div>
        `;
        render(html);
        document.getElementById('addEventBtn').addEventListener('click', function() {
            const name = prompt("Введи название события:");
            if (!name) return;
            const date = prompt("Введи дату (ГГГГ-ММ-ДД):");
            if (!date) return;
            const isPublic = confirm("Сделать общим?");
            addEventToBot(name, date, isPublic);
        });
    }

    function goBack() {
        showMainMenu();
    }

    // ===== НАВЕШИВАНИЕ ОБРАБОТЧИКОВ =====
    function setupNavigation() {
        const nav = document.getElementById('mainMenu');
        if (!nav) return;

        const buttons = nav.querySelectorAll('button');
        buttons.forEach(btn => {
            const action = btn.getAttribute('data-action');
            if (action === 'rates') btn.addEventListener('click', showRates);
            else if (action === 'weather') btn.addEventListener('click', showWeather);
            else if (action === 'mouse') btn.addEventListener('click', showMouseDay);
            else if (action === 'events') btn.addEventListener('click', showEvents);
        });

        const backBtn = document.getElementById('backBtn');
        if (backBtn) backBtn.addEventListener('click', goBack);
    }

    // ===== ЗАПУСК =====
    fetchAllData();
    showMainMenu();
    setupNavigation();

    console.log('🚀 Приложение инициализировано. API:', API_URL);
});