document.addEventListener('DOMContentLoaded', function() {
    let tg = null;
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        console.log('✅ Telegram WebApp инициализирован');
    } else {
        console.warn('⚠️ Telegram WebApp не найден, работаем в браузере');
        tg = {
            ready: function() {},
            expand: function() {},
            sendData: function(data) { console.log('Отправка (заглушка):', data); },
            onEvent: function() {}
        };
    }

    let events = [];
    let rates = null;
    let weather = null;
    let mouseDay = null;
    let currentView = 'main';

    function sendToBot(action, payload = {}) {
        const data = JSON.stringify({ action, ...payload });
        if (tg) {
            tg.sendData(data);
            console.log('📤 Отправлено боту:', data);
        }
    }

    function fetchAllData() { sendToBot('get_all_data'); }
    function fetchRates() { sendToBot('get_rates'); }
    function fetchWeather() { sendToBot('get_weather'); }
    function fetchEvents() { sendToBot('get_events'); }
    function addEventToBot(name, date, isPublic) {
        sendToBot('add_event', { name, date, is_public: isPublic });
    }

    if (tg) {
        tg.onEvent('data', function(data) {
            try {
                const response = JSON.parse(data);
                console.log('📥 Получено от бота:', response);
                handleBotResponse(response);
            } catch (e) {
                console.error('❌ Ошибка парсинга ответа бота:', e);
            }
        });
    }

    function handleBotResponse(response) {
        const { action, payload } = response;
        switch (action) {
            case 'get_all_data':
                if (payload.rates) rates = payload.rates;
                if (payload.weather) weather = payload.weather;
                if (payload.events) events = payload.events;
                if (payload.mouseDay !== undefined) mouseDay = payload.mouseDay;
                break;
            case 'get_rates':
                if (payload) rates = payload;
                break;
            case 'get_weather':
                if (payload) weather = payload;
                break;
            case 'get_events':
                if (payload) events = payload;
                break;
            case 'add_event':
                if (payload && payload.success) fetchEvents();
                break;
            default:
                console.warn('⚠️ Неизвестный action:', action);
        }
        if (currentView === 'rates') showRates();
        else if (currentView === 'weather') showWeather();
        else if (currentView === 'events') showEvents();
        else if (currentView === 'main') showMainMenu();
    }

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
            fetchRates();
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
            fetchWeather();
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
        if (!events || events.length === 0) {
            render(`<h2>📅 Мои события</h2><p>Загрузка...</p>`);
            fetchEvents();
            return;
        }
        let html = `<h2>📅 Мои события</h2>`;
        events.forEach(e => {
            const icon = e.is_public ? '🌍' : '🔒';
            html += `<div class="event-item">${icon} <b>${e.name}</b> — ${e.date}</div>`;
        });
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

    function setupNavigation() {
        const nav = document.getElementById('mainMenu');
        if (nav) {
            const buttons = nav.querySelectorAll('button');
            const actions = {
                'Курсы': showRates,
                'Погода': showWeather,
                'День мыши': showMouseDay,
                'События': showEvents
            };
            buttons.forEach(btn => {
                const text = btn.textContent.trim().replace(/[^\w\s]/g, '').trim();
                if (actions[text]) {
                    btn.addEventListener('click', actions[text]);
                } else {
                    for (let key in actions) {
                        if (text.includes(key)) {
                            btn.addEventListener('click', actions[key]);
                            break;
                        }
                    }
                }
            });
        }
        document.getElementById('backBtn').addEventListener('click', goBack);
    }

    fetchAllData();
    showMainMenu();
    setupNavigation();
    console.log('🚀 Приложение инициализировано');
});