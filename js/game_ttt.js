// ===== гомоку 10x10 =====
// ===== ГОМОКУ 10×10 =====
async function showTicTacToe() {
    currentView = 'game_ttt';
    setBackBtnVisible(true);
    const user_id = getUserId();
    try {
        const r = await fetch(`${API_URL}/api/game/my_active?user_id=${user_id}`, { headers: HEADERS });
        const d = await r.json();
        if (d.success && d.games && d.games.length > 0) {
            await loadGameState(d.games[0].id);
        } else {
            renderTttLobby();
        }
    } catch (e) { renderTttLobby(); }
}

function renderTttLobby() {
    render(`
        <h2>🎯 Гомоку 10×10</h2>
        <p style="text-align:center; color:var(--text-dim); font-size:14px; margin-bottom:20px;">Собери 5 в ряд на поле 10×10. Создай игру и пригласи друга, или сыграй с ботом</p>
        <button class="action-btn" id="createGameBtn">➕ Создать игру</button>
        <button class="action-btn secondary" id="botGameBtn">🤖 Играть с ботом</button>
    `);
    document.getElementById('createGameBtn').addEventListener('click', createGame);
    document.getElementById('botGameBtn').addEventListener('click', startBotGame);
}

async function createGame() {
    try {
        const r = await fetch(`${API_URL}/api/game/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId() }) });
        const d = await r.json();
        if (d.success) await loadGameState(d.game_id);
    } catch (e) { alert('Ошибка'); }
}

async function startBotGame() {
    try {
        const r = await fetch(`${API_URL}/api/game/start_bot`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId() }) });
        const d = await r.json();
        if (d.success) await loadGameState(d.game_id);
    } catch (e) { alert('Ошибка'); }
}

async function loadGameState(game_id) {
    try {
        const user_id = getUserId();
        const r = await fetch(`${API_URL}/api/game/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
        const d = await r.json();
        if (!d.success) { renderTttLobby(); return; }
        currentGame = d.game;
        lastBoard = '';
        renderGameBoard();
        startGameAutoRefresh(game_id);
    } catch (e) { renderTttLobby(); }
}

function renderGameBoard() {
    const g = currentGame;
    const board = g.board.split('');
    let statusText = '', statusColor = 'var(--text-dim)';
    if (g.status === 'waiting') { statusText = '⏳ Ждём соперника...'; statusColor = 'var(--accent-amber)'; }
    else if (g.status === 'active') {
        if (g.is_my_turn) { statusText = '🎯 Твой ход'; statusColor = 'var(--accent-green)'; }
        else { statusText = g.is_vs_bot ? '🤖 Ход бота...' : '⏳ Ход соперника'; statusColor = 'var(--accent-amber)'; }
    } else if (g.status === 'finished') {
        if (g.winner_id === getUserId()) { statusText = '🏆 Ты победил!'; statusColor = 'var(--accent-green)'; }
        else if (g.winner_id === null) { statusText = '🤝 Ничья'; statusColor = 'var(--accent-blue)'; }
        else { statusText = '😔 Ты проиграл'; statusColor = 'var(--accent-pink)'; }
    }
    let winningLine = g.winning_line || null;
    let boardHtml = '<div class="ttt-board gomoku-board">';
    for (let i = 0; i < 100; i++) {
        const cell = board[i] || '-';
        let cellClass = 'ttt-cell';
        if (cell === 'X') cellClass += ' x';
        else if (cell === 'O') cellClass += ' o';
        if (winningLine && winningLine.includes(i)) cellClass += ' winning';
        const canClick = g.status === 'active' && g.is_my_turn && cell === '-';
        boardHtml += `<div class="${cellClass}" data-pos="${i}" ${canClick ? 'data-clickable="1"' : ''}>${cell === '-' ? '' : cell}</div>`;
    }
    boardHtml += '</div>';
    let opponentInfo = g.opponent_username ? `<p style="text-align:center; font-size:13px; color:var(--text-dim); margin-top:12px;">Соперник: ${escapeHtml(g.opponent_username)}</p>` : '';
    let buttonsHtml = '';
    if (g.status === 'waiting') buttonsHtml = `<button class="action-btn" id="inviteBtn">📨 Пригласить друга</button><button class="action-btn secondary" id="cancelGameBtn">❌ Отменить</button>`;
    else if (g.status === 'finished') buttonsHtml = `<button class="action-btn" id="newGameBtn">🔄 Новая игра</button><button class="action-btn secondary" id="backToPlatformBtn">🔙 К платформе</button>`;
    else buttonsHtml = `<button class="action-btn secondary" id="leaveGameBtn">🚪 Выйти</button>`;
    render(`
        <h2>🎯 Гомоку #${g.id}</h2>
        <p style="text-align:center; font-size:16px; font-weight:600; color:${statusColor}; margin-bottom:16px;">${statusText}</p>
        ${boardHtml}
        ${opponentInfo}
        <div style="margin-top:20px;">${buttonsHtml}</div>
    `);
    lastBoard = g.board;
    document.querySelectorAll('.ttt-cell[data-clickable="1"]').forEach(cell => {
        cell.addEventListener('click', function() { makeMove(parseInt(this.getAttribute('data-pos'))); });
    });
    const inviteBtn = document.getElementById('inviteBtn');
    if (inviteBtn) inviteBtn.addEventListener('click', () => openInviteDialog(g.id, 'ttt'));
    const cancelBtn = document.getElementById('cancelGameBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelCurrentGame);
    const newGameBtn = document.getElementById('newGameBtn');
    if (newGameBtn) newGameBtn.addEventListener('click', () => { stopGameTimer(); currentGame = null; renderTttLobby(); });
    const backBtn = document.getElementById('backToPlatformBtn');
    if (backBtn) backBtn.addEventListener('click', () => { stopGameTimer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
    const leaveBtn = document.getElementById('leaveGameBtn');
    if (leaveBtn) leaveBtn.addEventListener('click', () => { stopGameTimer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
}

async function makeMove(position) {
    const g = currentGame;
    if (!g || g.status !== 'active' || !g.is_my_turn) return;
    try {
        const r = await fetch(`${API_URL}/api/game/move`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ game_id: g.id, user_id: getUserId(), position: position }) });
        const d = await r.json();
        if (d.success) await loadGameState(g.id);
    } catch (e) {}
}

function startGameAutoRefresh(game_id) {
    stopGameTimer();
    gameRefreshTimer = setInterval(async () => {
        if (currentView !== 'game_ttt') { stopGameTimer(); return; }
        try {
            const user_id = getUserId();
            const r = await fetch(`${API_URL}/api/game/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
            const d = await r.json();
            if (d.success) { currentGame = d.game; renderGameBoard(); }
        } catch (e) {}
    }, 3000);
}

function openInviteDialog(game_id, game_type) {
    const username = prompt('Введи @username друга (без @):');
    if (!username) return;
    sendInvite(game_id, username.replace('@', ''), game_type);
}

async function sendInvite(game_id, username, game_type) {
    try {
        const r = await fetch(`${API_URL}/api/game/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ game_id: game_id, username: username, from_username: getUsername(), game_type: game_type || 'ttt' }) });
        const d = await r.json();
        if (!d.success) { alert('❌ Не удалось найти игрока: ' + (d.error || 'unknown')); return; }
        alert(`✅ Приглашение отправлено @${d.invited_username}!`);
    } catch (e) { alert('Ошибка'); }
}

async function cancelCurrentGame() {
    if (!confirm('Отменить игру?')) return;
    if (currentGame) {
        try {
            await fetch(`${API_URL}/api/game/cancel`, {
                method: 'POST', headers: HEADERS,
                body: JSON.stringify({ game_id: currentGame.id, user_id: getUserId() })
            });
        } catch (e) {}
    }
    stopGameTimer();
    currentGame = null;
    renderTttLobby();
}

