// ===== курсы/погода/день мыши/графики/emu-лог =====
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
        var entry = { time: new Date().toLocaleTimeString(), type: e.data.logType, msg: e.data.msg };
        emuErrors.push(entry);
        if (e.data.logType === 'err' || e.data.logType === 'info') {
            fetch(API_URL + '/api/emu_log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...HEADERS },
                body: JSON.stringify({ time: entry.time, type: entry.type, msg: entry.msg })
            }).catch(function() {});
        }
    }
});

function openRetroMenu() {
    emuErrors = [];
    const container = document.getElementById('battleship-container');
    const frame = document.getElementById('battleship-frame');

    const GAMES = [
        { title: 'Micro Machines', name: 'micromachines', rom: 'roms/Micro Machines/Micro Machines.gen', core: 'segaMD', icon: 'icons/micromachines.jpg' },
        { title: 'Super',         name: 'super',         rom: 'roms/Super/Super.nes',                    core: 'nestopia',     icon: 'icons/super.jpg' },
        { title: 'Nova the Squirrel', name: 'novasquirrel', rom: 'roms/Nova the Squirrel/nova.nes',     core: 'nestopia',     icon: 'icons/novasquirrel.jpg' },
        { title: 'Battle City', name: 'battlecity', rom: 'roms/Battle City/Battle City.nes',            core: 'nestopia',     icon: 'icons/battlecity.jpg' }
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
    transition: 0.2s; user-select:none; overflow:hidden;
}
.item:active { transform: scale(0.96); border-color:#00d4ff; }
.item img { width:100%; height:120px; object-fit:cover; border-radius:8px; margin-bottom:8px; background:#0f1b3d; }
.item .emoji { font-size:28px; margin-bottom:6px; }
.name { font-size:12px; font-weight:600; }
.back-btn {
    display:block; width:100%; margin-top:16px; padding:14px;
    background:linear-gradient(145deg,#1a2a5c,#0f1b3d);
    border:1px solid #00d4ff66; border-radius:12px;
    color:#00d4ff; font-size:15px; font-weight:600; cursor:pointer;
}
.back-btn:active { transform:scale(0.97); }
</style>
</head>
<body>
<h2>\u{1F579}\uFE0F \u0412\u044B\u0431\u0435\u0440\u0438 \u0438\u0433\u0440\u0443</h2>
<div class="list">
${GAMES.map(g => `<div class="item" data-rom="${g.rom}" data-core="${g.core}" data-name="${g.name}">
<img src="${g.icon}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" alt="${g.title}">
<div class="emoji" style="display:none">\u{1F3AE}</div>
<div class="name">${g.title}</div>
</div>`).join('')}
</div>
<button class="back-btn" onclick="parent.document.getElementById('battleship-container').style.display='none'">\u{1F519} \u041D\u0430\u0437\u0430\u0434</button>
<script>
document.querySelectorAll('.item').forEach(function(el) {
el.addEventListener('click', function() {
    var rom = el.getAttribute('data-rom');
    var core = el.getAttribute('data-core');
    var name = el.getAttribute('data-name');
    var api = '${API_URL}';
    window.location.href = 'emulator.html?rom=' + encodeURIComponent(rom) + '&core=' + core + '&name=' + name + '&api=' + encodeURIComponent(api);
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

function openGame3d() {
    const url = 'https://kapitanpiho.duckdns.org/game3d/';
    if (tg && tg.openLink) tg.openLink(url);
    else window.open(url, '_blank');
}

