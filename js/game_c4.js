// ===== 4 в ряд =====
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
        <p style="text-align:center; color:var(--text-dim); font-size:14px; margin-bottom:20px;">Бросай фишки и собери 4 в ряд</p>
        <button class="action-btn" id="createC4Btn">➕ Создать игру</button>
        <button class="action-btn secondary" id="botC4Btn">🤖 Играть с ботом</button>
    `);
    document.getElementById('createC4Btn').addEventListener('click', createC4Game);
    document.getElementById('botC4Btn').addEventListener('click', startC4BotGame);
}

async function createC4Game() {
    try {
        const r = await fetch(`${API_URL}/api/game/c4/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId() }) });
        const d = await r.json();
        if (d.success) await loadC4State(d.game_id);
    } catch (e) { alert('Ошибка'); }
}

async function startC4BotGame() {
    try {
        const r = await fetch(`${API_URL}/api/game/c4/start_bot`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId() }) });
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
    let statusText = '', statusColor = 'var(--text-dim)';
    if (g.status === 'waiting') { statusText = '⏳ Ждём соперника...'; statusColor = 'var(--accent-amber)'; }
    else if (g.status === 'active') {
        if (g.is_my_turn) { statusText = '🎯 Твой ход — выбери столбец'; statusColor = 'var(--accent-green)'; }
        else { statusText = g.is_vs_bot ? '🤖 Ход бота...' : '⏳ Ход соперника'; statusColor = 'var(--accent-amber)'; }
    } else if (g.status === 'finished') {
        if (g.winner_id === getUserId()) { statusText = '🏆 Ты победил!'; statusColor = 'var(--accent-green)'; }
        else if (g.winner_id === null) { statusText = '🤝 Ничья'; statusColor = 'var(--accent-blue)'; }
        else { statusText = '😔 Ты проиграл'; statusColor = 'var(--accent-pink)'; }
    }
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
    const oldBoard = lastC4Board || '';
    const droppingCells = [];
    if (oldBoard.length === board.length) {
        for (let i = 0; i < board.length; i++) {
            if (oldBoard[i] !== board[i] && board[i] !== '-') droppingCells.push(i);
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
    let opponentInfo = g.opponent_username ? `<p style="text-align:center; font-size:13px; color:var(--text-dim); margin-top:8px;">Соперник: ${escapeHtml(g.opponent_username)}</p>` : '';
    let buttonsHtml = '';
    if (g.status === 'waiting') buttonsHtml = `<button class="action-btn" id="inviteC4Btn">📨 Пригласить друга</button><button class="action-btn secondary" id="cancelC4Btn">❌ Отменить</button>`;
    else if (g.status === 'finished') buttonsHtml = `<button class="action-btn" id="newC4Btn">🔄 Новая игра</button><button class="action-btn secondary" id="backToPlatformC4Btn">🔙 К платформе</button>`;
    else buttonsHtml = `<button class="action-btn secondary" id="leaveC4Btn">🚪 Выйти</button>`;
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
        btn.addEventListener('click', function() { makeC4Move(parseInt(this.getAttribute('data-col'))); });
    });
    const inviteC4Btn = document.getElementById('inviteC4Btn');
    if (inviteC4Btn) inviteC4Btn.addEventListener('click', () => openInviteDialog(g.id, 'c4'));
    const cancelC4Btn = document.getElementById('cancelC4Btn');
    if (cancelC4Btn) cancelC4Btn.addEventListener('click', async () => {
        if (currentC4Game) {
            try {
                await fetch(`${API_URL}/api/game/c4/cancel`, {
                    method: 'POST', headers: HEADERS,
                    body: JSON.stringify({ game_id: currentC4Game.id, user_id: getUserId() })
                });
            } catch (e) {}
        }
        stopC4Timer(); currentC4Game = null; renderC4Lobby();
    });
    const newC4Btn = document.getElementById('newC4Btn');
    if (newC4Btn) newC4Btn.addEventListener('click', () => { stopC4Timer(); currentC4Game = null; renderC4Lobby(); });
    const backBtn = document.getElementById('backToPlatformC4Btn');
    if (backBtn) backBtn.addEventListener('click', () => { stopC4Timer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
    const leaveC4Btn = document.getElementById('leaveC4Btn');
    if (leaveC4Btn) leaveC4Btn.addEventListener('click', () => { stopC4Timer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
}

async function makeC4Move(col) {
    const g = currentC4Game;
    if (!g || g.status !== 'active' || !g.is_my_turn) return;
    try {
        const r = await fetch(`${API_URL}/api/game/c4/move`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ game_id: g.id, user_id: getUserId(), col: col }) });
        const d = await r.json();
        if (d.success) {
            currentC4Game = { ...currentC4Game, board: d.board, status: d.status, winner_id: d.winner_id };
            renderC4Board();
            if (d.status === 'active') setTimeout(async () => { await loadC4State(g.id); }, 500);
            else await loadC4State(g.id);
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

