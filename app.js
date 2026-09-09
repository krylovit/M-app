// Ожидаем полной загрузки DOM
document.addEventListener('DOMContentLoaded', function() {

    // Проверяем наличие Telegram WebApp
    let tg = null;
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand(); // Растягиваем на всю высоту
        console.log('✅ Telegram WebApp инициализирован');
    } else {
        console.warn('⚠️ Telegram WebApp не найден, работаем в браузере');
        // В браузере создаём заглушку
        tg = {
            ready: function() {},
            expand: function() {},
            sendData: function(data) { console.log('Отправка данных (заглушка):', data); }
        };
    }

    // ===================== ДАННЫЕ (временные) =====================
    let events = [
        { name: "Конференция Dahua", date: "2026-09-22", is_public: true },
        { name: "Техно-День (Москва)", date: "2026-10-08", is_public: false },
        { name: "ДР", date: "2026-11-12", is_public: false }
    ];

    let currentView = 'main';

    // ===================== ФУНКЦИИ ОТОБРАЖЕНИЯ =====================

    function render(contentHTML) {
        const content = document.getElementById('content');
        if (content) {
            content.innerHTML = contentHTML;
        } else {
            console.error('❌ Элемент #content не найден');
        }
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
        console.log('🏠 Главное меню отображено');
    }

    function showRates() {
        currentView = 'rates';
        document.getElementById('backBtn').style.display = 'block';
        render(`
            <h2>💵 Курсы валют</h2>
            <p>🇺🇸 1 USD = <b>86.42</b> RUB</p>
            <p>🇺🇸 1 USD = <b>32.90</b> THB</p>
            <p>🇹🇭 1 THB = <b>2.63</b> RUB</p>
            <p style="font-size:12px; color:var(--tg-theme-hint-color, gray); margin-top:12px;">Обновлено: ${new Date().toLocaleTimeString()}</p>
        `);
        console.log('💵 Показаны курсы');
    }

    function showWeather() {
        currentView = 'weather';
        document.getElementById('backBtn').style.display = 'block';
        render(`
            <h2>🌴 Погода на Кочанге</h2>
            <p>🌡️ <b>28°C</b></p>
            <p>💨 <b>15 км/ч</b></p>
            <p style="font-size:12px; color:var(--tg-theme-hint-color, gray); margin-top:12px;">Обновлено: ${new Date().toLocaleTimeString()}</p>
        `);
        console.log('🌤️ Показана погода');
    }

    function showMouseDay() {
        currentView = 'mouse';
        document.getElementById('backBtn').style.display = 'block';
        const now = new Date();
        const target = new Date(2027, 1, 13); // 13 февраля 2027
        const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
        render(`
            <h2>🐭 День мыши</h2>
            <p>До 13 февраля осталось <b>${diff}</b> дней</p>
        `);
        console.log('🐭 Показан день мыши');
    }

    function showEvents() {
        currentView = 'events';
        document.getElementById('backBtn').style.display = 'block';
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
                <button onclick="addEvent()" style="padding:10px 20px; border:none; border-radius:10px; background:var(--tg-theme-button-color, #0088cc); color:var(--tg-theme-button-text-color, #ffffff); font-weight:600; cursor:pointer; width:100%;">
                    ➕ Добавить событие
                </button>
            </div>
        `;
        render(html);
        console.log('📅 Показаны события');
    }

    // ===================== ДОБАВЛЕНИЕ СОБЫТИЯ (через диалог) =====================

    function addEvent() {
        const name = prompt("Введи название события:");
        if (!name) return;
        const date = prompt("Введи дату (ГГГГ-ММ-ДД):");
        if (!date) return;
        const isPublic = confirm("Сделать общим?");
        events.push({ name, date, is_public: isPublic });
        showEvents();
        // Отправляем данные боту (если есть Telegram)
        if (tg) {
            tg.sendData(JSON.stringify({ action: 'add_event', name, date, is_public: isPublic }));
            console.log('📤 Отправлены данные боту');
        }
    }

    // ===================== НАЗАД =====================

    function goBack() {
        showMainMenu();
    }

    // ===================== ЗАПУСК =====================

    // Показываем главное меню при загрузке
    showMainMenu();

    console.log('🚀 Приложение инициализировано');
});