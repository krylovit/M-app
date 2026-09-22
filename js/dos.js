// ===== DOS-сплэш и главное меню =====
// ===== DOS ТЕРМИНАЛ =====
const DOS_JOKES = [
    '640K хватит всем.',
    'Keyboard not found. Press F1 to continue.',
    'Insert disk 2 and press any key...',
    'HIMEM.SYS is testing extended memory... done',
    "It's now safe to turn off your computer.",
    'Abort, Retry, Fail? _',
    'General failure reading drive A:',
    'Bad command or file name',
    'Non-system disk or disk error',
    'Mouse driver v8.20 loaded',
    'EMM386: expanded memory OK',
    'SMARTDRV: cache initialized',
];

function dosSleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function dosBoot() {
    const term = document.getElementById('dosTerm');
    if (!term) return;
    const joke = DOS_JOKES[Math.floor(Math.random() * DOS_JOKES.length)];
    const lines = [
        'KAPITAN BIOS v1.12',
        'Проверка памяти.......... 640K OK',
        'Драйвер мыши............. OK',
        'Звуковая карта........... OK',
        'C:\\> KAPITAN.EXE',
        'Загрузка помощника....... ',
    ];
    let out = '';
    for (const line of lines) {
        out += line + '\n';
        term.innerHTML = out + '<span class="dos-cursor"></span>';
        await dosSleep(180 + Math.random() * 220);
    }
    // прогресс-бар
    for (let p = 0; p <= 10; p++) {
        const bar = '█'.repeat(p) + '░'.repeat(10 - p);
        term.innerHTML = out + bar + ' ' + (p * 10) + '%\n<span class="dos-cursor"></span>';
        await dosSleep(90 + Math.random() * 140);
    }
    out += '██████████ 100%\n';
    term.innerHTML = out + '<span class="dos-cursor"></span>';
    await dosSleep(300);
    out += joke + '\nC:\\> ';
    term.innerHTML = out + '<span class="dos-cursor"></span>';
}

function dosSplashHide() {
    const s = document.getElementById('dos-splash');
    if (!s) return;
    s.classList.add('fade');
    setTimeout(() => { s.style.display = 'none'; }, 750);
}

function showMainMenu() {
    currentView = 'main'; stopLottie(); destroyChart(); stopGameTimer(); stopC4Timer(); stopCheckersTimer(); setBackBtnVisible(false);
    render(`<div class="dos-terminal idle">C:\\&gt; выбери раздел<span class="dos-cursor"></span></div>`);
}

