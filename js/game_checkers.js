// ===== шашки =====
// ===== ШАШКИ =====
async function showCheckers() {
    currentView = 'game_checkers';
    setBackBtnVisible(true);
    const user_id = getUserId();
    try {
        const r = await fetch(`${API_URL}/api/game/checkers/my_active?user_id=${user_id}`, { headers: HEADERS });
        const d = await r.json();
        if (d.success && d.games && d.games.length > 0) {
            await loadCheckersState(d.games[0].id);
        } else {
            renderCheckersLobby();
        }
    } catch (e) { renderCheckersLobby(); }
}

function renderCheckersLobby() {
    render(`
        <h2>⚫ Шашки</h2>
        <p style="text-align:center; color:var(--text-dim); font-size:14px; margin-bottom:20px;">
            Русские шашки — собери соперника «в дамки» или забери все его фигуры
        </p>
        <button class="action-btn" id="createCheckersBtn">➕ Создать игру</button>
    `);
    document.getElementById('createCheckersBtn').addEventListener('click', createCheckersGame);
}

async function createCheckersGame() {
    try {
        const r = await fetch(`${API_URL}/api/game/checkers/create`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
            body: JSON.stringify({ user_id: getUserId() })
        });
        const d = await r.json();
        if (d.success) await loadCheckersState(d.game_id);
    } catch (e) { alert('Ошибка'); }
}

async function loadCheckersState(game_id) {
    try {
        const user_id = getUserId();
        const r = await fetch(`${API_URL}/api/game/checkers/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
        const d = await r.json();
        if (!d.success) { renderCheckersLobby(); return; }
        currentCheckersGame = d.game;
        selectedCell = null;
        renderCheckersBoard();
        startCheckersAutoRefresh(game_id);
    } catch (e) { renderCheckersLobby(); }
}

function renderCheckersBoard() {
    const g = currentCheckersGame;

    let statusText = '', statusColor = 'var(--text-dim)';
    if (g.status === 'waiting') { statusText = '⏳ Ждём соперника...'; statusColor = 'var(--accent-amber)'; }
    else if (g.status === 'active') {
        if (g.is_my_turn) { statusText = '🎯 Твой ход'; statusColor = 'var(--accent-green)'; }
        else { statusText = '⏳ Ход соперника'; statusColor = 'var(--accent-amber)'; }
    } else if (g.status === 'finished') {
        if (g.winner_id === getUserId()) { statusText = '🏆 Ты победил!'; statusColor = 'var(--accent-green)'; }
        else { statusText = '😔 Ты проиграл'; statusColor = 'var(--accent-pink)'; }
    }

    const pieces = parseCheckersFen(g.fen);

    let lastMoveCells = [];
    if (g.last_move) {
        const parts = g.last_move.split(/[-x]/);
        lastMoveCells = parts.map(p => parseInt(p)).filter(n => !isNaN(n));
    }

    let boardHtml = '<div class="checkers-board-wrapper"><div class="checkers-board">';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const isDark = (row + col) % 2 === 1;
            const cellClass = isDark ? 'checkers-cell dark' : 'checkers-cell light';

            let cellNum = null;
            if (isDark) {
                const squaresInRowBefore = row * 4;
                const offsetInRow = Math.floor(col / 2);
                cellNum = squaresInRowBefore + offsetInRow + 1;
            }

            const piece = cellNum ? pieces[cellNum] : null;

            let cellExtra = '';
            let pieceHtml = '';

            if (piece) {
                let pieceClass = `checkers-piece ${piece.color}`;
                if (piece.isKing) pieceClass += ' king';
                pieceHtml = `<div class="${pieceClass}"></div>`;
            }

            if (cellNum && selectedCell === cellNum) cellExtra += ' selected';
            if (cellNum && selectedCell && isLegalTarget(selectedCell, cellNum)) cellExtra += ' legal-target';
            if (cellNum && lastMoveCells.includes(cellNum)) cellExtra += ' last-move';

            const canClick = g.status === 'active' && g.is_my_turn && cellNum;

            boardHtml += `<div class="${cellClass}${cellExtra}${canClick ? ' playable' : ''}" data-cell="${cellNum || ''}">${pieceHtml}</div>`;
        }
    }
    boardHtml += '</div></div>';

    let opponentInfo = g.opponent_username ? `<p style="text-align:center; font-size:13px; color:var(--text-dim); margin-top:12px;">Соперник: ${escapeHtml(g.opponent_username)}</p>` : '';

    let buttonsHtml = '';
    if (g.status === 'waiting') {
        buttonsHtml = `<button class="action-btn" id="inviteCheckersBtn">📨 Пригласить друга</button><button class="action-btn secondary" id="cancelCheckersBtn">❌ Отменить</button>`;
    } else if (g.status === 'finished') {
        buttonsHtml = `<button class="action-btn" id="newCheckersBtn">🔄 Новая игра</button><button class="action-btn secondary" id="backToPlatformCheckersBtn">🔙 К платформе</button>`;
    } else {
        buttonsHtml = `<button class="action-btn secondary" id="leaveCheckersBtn">🚪 Выйти</button>`;
    }

    render(`
        <h2>⚫ Шашки #${g.id}</h2>
        <p style="text-align:center; font-size:15px; font-weight:600; color:${statusColor}; margin-bottom:10px;">${statusText}</p>
        ${boardHtml}
        ${opponentInfo}
        <div style="margin-top:16px;">${buttonsHtml}</div>
    `);

    document.querySelectorAll('.checkers-cell.playable').forEach(cell => {
        cell.addEventListener('click', function() {
            const cellNum = parseInt(this.getAttribute('data-cell'));
            onCheckersCellClick(cellNum);
        });
    });

    const inviteBtn = document.getElementById('inviteCheckersBtn');
    if (inviteBtn) inviteBtn.addEventListener('click', () => openInviteDialog(g.id, 'checkers'));
    const cancelBtn = document.getElementById('cancelCheckersBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', async () => {
        if (currentCheckersGame) {
            try {
                await fetch(`${API_URL}/api/game/checkers/cancel`, {
                    method: 'POST', headers: HEADERS,
                    body: JSON.stringify({ game_id: currentCheckersGame.id, user_id: getUserId() })
                });
            } catch (e) {}
        }
        stopCheckersTimer(); currentCheckersGame = null; renderCheckersLobby();
    });
    const newBtn = document.getElementById('newCheckersBtn');
    if (newBtn) newBtn.addEventListener('click', () => { stopCheckersTimer(); currentCheckersGame = null; renderCheckersLobby(); });
    const backBtn = document.getElementById('backToPlatformCheckersBtn');
    if (backBtn) backBtn.addEventListener('click', () => { stopCheckersTimer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
    const leaveBtn = document.getElementById('leaveCheckersBtn');
    if (leaveBtn) leaveBtn.addEventListener('click', () => { stopCheckersTimer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
}

function parseCheckersFen(fen) {
    const pieces = {};
    try {
        let fenClean = fen;
        const match = fen.match(/\[FEN "(.+?)"\]/);
        if (match) fenClean = match[1];

        const parts = fenClean.split(':');

        for (let i = 1; i < parts.length; i++) {
            let side = parts[i];
            const color = side.startsWith('W') ? 'white' : 'black';
            side = side.substring(1);

            if (!side) continue;

            side.split(',').forEach(cellStr => {
                let isKing = false;
                if (cellStr.startsWith('K')) {
                    isKing = true;
                    cellStr = cellStr.substring(1);
                }
                const cell = parseInt(cellStr);
                if (!isNaN(cell)) {
                    pieces[cell] = { color, isKing };
                }
            });
        }
    } catch (e) {
        console.error('Ошибка parseCheckersFen:', e);
    }
    return pieces;
}

function onCheckersCellClick(cellNum) {
    const g = currentCheckersGame;
    if (!g || g.status !== 'active' || !g.is_my_turn) return;

    const pieces = parseCheckersFen(g.fen);
    const piece = pieces[cellNum];

    if (selectedCell && isLegalTarget(selectedCell, cellNum)) {
        const moveStr = `${selectedCell}-${cellNum}`;
        makeCheckersMove(moveStr, selectedCell, cellNum);
        return;
    }

    if (piece && piece.color === g.my_color) {
        selectedCell = cellNum;
        renderCheckersBoard();
        return;
    }

    selectedCell = null;
    renderCheckersBoard();
}

function isLegalTarget(from, to) {
    const g = currentCheckersGame;
    if (!g || !g.legal_moves) return false;

    return g.legal_moves.some(moveStr => {
        const parts = moveStr.split(/[-x]/);
        return parts[0] === String(from) && parts[parts.length - 1] === String(to);
    });
}

async function makeCheckersMove(moveStr, from, to) {
    const g = currentCheckersGame;
    if (!g) return;

    let actualMove = null;
    if (g.legal_moves) {
        actualMove = g.legal_moves.find(m => {
            const parts = m.split(/[-x]/);
            return parts[0] === String(from) && parts[parts.length - 1] === String(to);
        });
    }

    if (!actualMove) {
        alert(`❌ Ход не найден: ${from}-${to}\nДоступные: ${JSON.stringify(g.legal_moves)}`);
        return;
    }

    try {
        const r = await fetch(`${API_URL}/api/game/checkers/move`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
            body: JSON.stringify({ game_id: g.id, user_id: getUserId(), move: actualMove })
        });
        const d = await r.json();
        if (d.success) {
            selectedCell = null;
            await loadCheckersState(g.id);
        } else {
            alert(`❌ Ошибка хода: ${d.error || 'unknown'}\nХод: ${actualMove}`);
            await loadCheckersState(g.id);
        }
    } catch (e) {
        alert(`❌ Сеть: ${e}`);
    }
}

function startCheckersAutoRefresh(game_id) {
    stopCheckersTimer();
    checkersRefreshTimer = setInterval(async () => {
        if (currentView !== 'game_checkers') { stopCheckersTimer(); return; }
        try {
            const user_id = getUserId();
            const r = await fetch(`${API_URL}/api/game/checkers/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
            const d = await r.json();
            if (d.success) {
                currentCheckersGame = d.game;
                renderCheckersBoard();
            }
        } catch (e) {}
    }, 3000);
}

