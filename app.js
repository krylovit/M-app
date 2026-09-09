document.addEventListener('DOMContentLoaded', function() {

    // ===================== ИНИЦИАЛИЗАЦИЯ TELEGRAM =====================
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
            sendData: function(data) { console.log('Отправка данных (заглушка):', data); }
        };
    }

    // ===================== ДАННЫЕ =====================
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
        const target = new Date(2027, 1, 13);
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
                <button id="addEventBtn" style="padding:10px 20px; border:none; border-radius:10px; background:var(--tg-theme-button-color, #0088cc); color:var(--tg-theme-button-text-color, #ffffff); font-weight:600; cursor:pointer; width:100%;">
                    ➕ Добавить событие
                </button>
            </div>
        `;
        render(html);
        // После вставки HTML навешиваем обработчик на кнопку "Добавить"
        const addBtn = document.getElementById('addEventBtn');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                const name = prompt("Введи название события:");
                if (!name) return;
                const date = prompt("Введи дату (ГГГГ-ММ-ДД):");
                if (!date) return;
                const isPublic = confirm("Сделать общим?");
                events.push({ name, date, is_public: isPublic });
                showEvents();
                if (tg) {
                    tg.sendData(JSON.stringify({ action: 'add_event', name, date, is_public: isPublic }));
                }
            });
        }
        console.log('📅 Показаны события');
    }

    function goBack() {
        showMainMenu();
    }

    // ===================== НАВЕШИВАНИЕ СОБЫТИЙ НА КНОПКИ МЕНЮ =====================

    function setupNavigation() {
        const navButtons = {
            'Курсы': showRates,
            'Погода': showWeather,
            'День мыши': showMouseDay,
            'События': showEvents
        };

        // Ищем все кнопки внутри nav
        const nav = document.getElementById('mainMenu');
        if (nav) {
            const buttons = nav.querySelectorAll('button');
            buttons.forEach(btn => {
                const text = btn.textContent.trim();
                // Убираем эмодзи для поиска
                const cleanText = text.replace(/[^\w\s]/g, '').trim();
                if (navButtons[cleanText]) {
                    btn.addEventListener('click', navButtons[cleanText]);
                } else {
                    // fallback: если не совпало, пробуем по наличию подстроки
                    for (let key in navButtons) {
                        if (text.includes(key)) {
                            btn.addEventListener('click', navButtons[key]);
                            break;
                        }
                    }
                }
            });
        }

        // Кнопка "Назад"
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', goBack);
        }
    }

    // ===================== ЗАПУСК =====================

    showMainMenu();
    setupNavigation();

    console.log('🚀 Приложение инициализировано');
});