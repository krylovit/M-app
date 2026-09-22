// ===== морской бой =====
// ===== МОРСКОЙ БОЙ (СЕТЕВОЙ) =====
let currentBsGame = null;
let bsRefreshTimer = null;
let bsPlacement = Array(100).fill('-');
let bsShipOrientation = 'horizontal';
let bsCurrentShip = null;
let bsPlacedShips = [];

const BS_SHIPS = [
    { name: 'Carrier', size: 5, id: 'carrier' },
    { name: 'Battleship', size: 4, id: 'battleship' },
    { name: 'Cruiser', size: 3, id: 'cruiser' },
    { name: 'Submarine', size: 3, id: 'submarine' },
    { name: 'Destroyer', size: 2, id: 'destroyer' }
];

async function showBattleshipLobby() {
    currentView = 'game_battleship';
    setBackBtnVisible(true);
    const user_id = getUserId();
    try {
        const r = await fetch(`${API_URL}/api/game/bs/my_active?user_id=${user_id}`, { headers: HEADERS });
        const d = await r.json();
        if (d.success && d.games && d.games.length > 0) {
            await loadBsState(d.games[0].id);
        } else {
            renderBsLobby();
        }
    } catch (e) { renderBsLobby(); }
}

function renderBsLobby() {
    render(`
        <h2>⚓ Морской бой</h2>
        <p style="text-align:center; color:var(--text-dim); font-size:14px; margin-bottom:20px;">Сразись с другом на поле 10×10. Расставь корабли и потопи врага!</p>
        <button class="action-btn" id="bsCreateBtn">➕ Создать игру</button>
        <button class="action-btn secondary" id="bsSingleBtn">🤖 Играть с ботом (офлайн)</button>
    `);
    document.getElementById('bsCreateBtn').addEventListener('click', createBsGame);
    document.getElementById('bsSingleBtn').addEventListener('click', () => {
        openBattleship();
    });
}

async function createBsGame() {
    try {
        const r = await fetch(`${API_URL}/api/game/bs/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS }, body: JSON.stringify({ user_id: getUserId() }) });
        const d = await r.json();
        if (d.success) await loadBsState(d.game_id);
    } catch (e) { alert('Ошибка создания игры'); }
}

async function loadBsState(game_id) {
    try {
        const user_id = getUserId();
        const r = await fetch(`${API_URL}/api/game/bs/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
        const d = await r.json();
        if (!d.success) { renderBsLobby(); return; }
        currentBsGame = d.game;
        if (d.game.status === 'waiting') renderBsWaiting();
        else if (d.game.status === 'placing') renderBsPlacement();
        else if (d.game.status === 'active' || d.game.status === 'finished') renderBsBattle();
        startBsAutoRefresh(game_id);
    } catch (e) { renderBsLobby(); }
}

function renderBsWaiting() {
    const g = currentBsGame;
    render(`
        <h2>⚓ Морской бой #${g.id}</h2>
        <p style="text-align:center; font-size:16px; font-weight:600; color:var(--accent-amber); margin-bottom:16px;">⏳ Ждём соперника...</p>
        <p style="text-align:center; color:var(--text-dim); font-size:13px; margin-bottom:16px;">Игра создана. Пригласи друга!</p>
        <div style="margin-top:20px;">
            <button class="action-btn" id="bsInviteBtn">📨 Пригласить друга</button>
            <button class="action-btn secondary" id="bsCancelBtn">❌ Отменить</button>
        </div>
    `);
    document.getElementById('bsInviteBtn').addEventListener('click', () => openInviteDialog(g.id, 'battleship'));
    document.getElementById('bsCancelBtn').addEventListener('click', cancelBsGame);
}

function renderBsPlacement() {
    const g = currentBsGame;
    if (g.my_ready) {
        render(`
            <h2>⚓ Морской бой #${g.id}</h2>
            <p style="text-align:center; font-size:16px; font-weight:600; color:var(--accent-amber); margin-bottom:16px;">⏳ Ждём, пока соперник расставит корабли...</p>
            <div style="margin-top:20px;"><button class="action-btn secondary" id="bsCancelBtn">❌ Отменить</button></div>
        `);
        document.getElementById('bsCancelBtn').addEventListener('click', cancelBsGame);
        return;
    }
    bsPlacement = Array(100).fill('-');
    bsPlacedShips = [];
    bsCurrentShip = BS_SHIPS[0];
    bsShipOrientation = 'horizontal';
    renderBsPlacementBoard();
}

function renderBsPlacementBoard() {
    const g = currentBsGame;
    let shipsHtml = BS_SHIPS.map((s, i) => {
        const placed = bsPlacedShips.find(p => p.id === s.id);
        const active = bsCurrentShip && bsCurrentShip.id === s.id && !placed;
        let cls = 'bs-ship-item';
        if (placed) cls += ' placed';
        if (active) cls += ' active';
        return `<div class="${cls}" data-ship-idx="${i}">${s.name} (${s.size})${placed ? ' ✓' : ''}</div>`;
    }).join('');
    let boardHtml = '<div class="bs-grid bs-placement-grid">';
    for (let i = 0; i < 100; i++) {
        const r = Math.floor(i / 10), c = i % 10;
        const hasShip = bsPlacement[i] === 'S';
        let cls = 'bs-cell';
        if (hasShip) cls += ' ship';
        boardHtml += `<div class="${cls}" data-pos="${i}"></div>`;
    }
    boardHtml += '</div>';
    const allPlaced = bsPlacedShips.length === BS_SHIPS.length;
    render(`
        <h2>⚓ Расстановка кораблей</h2>
        <p style="text-align:center; color:var(--text-dim); font-size:13px; margin-bottom:12px;">Тапни по полю, чтобы поставить корабль. 🔄 — поворот.</p>
        <div class="bs-ship-list">${shipsHtml}</div>
        <div style="text-align:center; margin:10px 0;">
            <button class="action-btn secondary" id="bsRotateBtn" style="display:inline-block; width:auto; padding:8px 16px;">🔄 Поворот</button>
            <button class="action-btn secondary" id="bsRandomBtn" style="display:inline-block; width:auto; padding:8px 16px;">🎲 Случайно</button>
            <button class="action-btn secondary" id="bsClearBtn" style="display:inline-block; width:auto; padding:8px 16px;">🗑 Очистить</button>
        </div>
        ${boardHtml}
        <div style="margin-top:16px;">
            <button class="action-btn" id="bsReadyBtn" ${allPlaced ? '' : 'disabled'}>⚔️ Готов к бою!</button>
            <button class="action-btn secondary" id="bsCancelBtn">❌ Отменить</button>
        </div>
    `);
    document.querySelectorAll('.bs-placement-grid .bs-cell').forEach(cell => {
        cell.addEventListener('click', function() {
            const pos = parseInt(this.getAttribute('data-pos'));
            placeBsShip(pos);
        });
    });
    document.querySelectorAll('.bs-ship-item').forEach(item => {
        item.addEventListener('click', function() {
            const idx = parseInt(this.getAttribute('data-ship-idx'));
            const ship = BS_SHIPS[idx];
            if (!bsPlacedShips.find(p => p.id === ship.id)) {
                bsCurrentShip = ship;
                renderBsPlacementBoard();
            }
        });
    });
    document.getElementById('bsRotateBtn').addEventListener('click', () => {
        bsShipOrientation = bsShipOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    });
    document.getElementById('bsRandomBtn').addEventListener('click', randomBsPlacement);
    document.getElementById('bsClearBtn').addEventListener('click', () => {
        bsPlacement = Array(100).fill('-');
        bsPlacedShips = [];
        bsCurrentShip = BS_SHIPS[0];
        renderBsPlacementBoard();
    });
    document.getElementById('bsReadyBtn').addEventListener('click', submitBsPlacement);
    document.getElementById('bsCancelBtn').addEventListener('click', cancelBsGame);
}

function placeBsShip(pos) {
    if (!bsCurrentShip) return;
    if (bsPlacedShips.find(p => p.id === bsCurrentShip.id)) return;
    const size = bsCurrentShip.size;
    const r = Math.floor(pos / 10), c = pos % 10;
    let cells = [];
    if (bsShipOrientation === 'horizontal') {
        if (c + size > 10) { alert('Не помещается!'); return; }
        for (let i = 0; i < size; i++) cells.push(r * 10 + c + i);
    } else {
        if (r + size > 10) { alert('Не помещается!'); return; }
        for (let i = 0; i < size; i++) cells.push((r + i) * 10 + c);
    }
    for (let cell of cells) {
        if (bsPlacement[cell] === 'S') { alert('Пересечение с другим кораблём!'); return; }
        const cr = Math.floor(cell / 10), cc = cell % 10;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = cr + dr, nc = cc + dc;
                if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
                    if (bsPlacement[nr * 10 + nc] === 'S') {
                        alert('Корабли не должны касаться друг друга!'); return;
                    }
                }
            }
        }
    }
    for (let cell of cells) bsPlacement[cell] = 'S';
    bsPlacedShips.push({ id: bsCurrentShip.id, cells });
    const nextShip = BS_SHIPS.find(s => !bsPlacedShips.find(p => p.id === s.id));
    bsCurrentShip = nextShip || null;
    renderBsPlacementBoard();
}

function randomBsPlacement() {
    bsPlacement = Array(100).fill('-');
    bsPlacedShips = [];
    for (let ship of BS_SHIPS) {
        let placed = false;
        for (let attempts = 0; attempts < 100 && !placed; attempts++) {
            const horizontal = Math.random() < 0.5;
            const maxR = horizontal ? 10 : 10 - ship.size;
            const maxC = horizontal ? 10 - ship.size : 10;
            const r = Math.floor(Math.random() * maxR);
            const c = Math.floor(Math.random() * maxC);
            let cells = [];
            let valid = true;
            for (let i = 0; i < ship.size; i++) {
                const cell = horizontal ? r * 10 + c + i : (r + i) * 10 + c;
                cells.push(cell);
                if (bsPlacement[cell] === 'S') { valid = false; break; }
                const cr = Math.floor(cell / 10), cc = cell % 10;
                for (let dr = -1; dr <= 1 && valid; dr++) {
                    for (let dc = -1; dc <= 1 && valid; dc++) {
                        const nr = cr + dr, nc = cc + dc;
                        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
                            if (bsPlacement[nr * 10 + nc] === 'S') valid = false;
                        }
                    }
                }
            }
            if (valid) {
                for (let cell of cells) bsPlacement[cell] = 'S';
                bsPlacedShips.push({ id: ship.id, cells });
                placed = true;
            }
        }
    }
    bsCurrentShip = BS_SHIPS.find(s => !bsPlacedShips.find(p => p.id === s.id)) || null;
    renderBsPlacementBoard();
}

async function submitBsPlacement() {
    if (bsPlacedShips.length !== BS_SHIPS.length) { alert('Расставь все корабли!'); return; }
    const board = bsPlacement.join('');
    try {
        const r = await fetch(`${API_URL}/api/game/bs/place`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
            body: JSON.stringify({ game_id: currentBsGame.id, user_id: getUserId(), board })
        });
        const d = await r.json();
        if (d.success) await loadBsState(currentBsGame.id);
        else alert('Ошибка: ' + (d.error || 'unknown'));
    } catch (e) { alert('Сеть: ' + e); }
}

function renderBsBattle() {
    const g = currentBsGame;
    let statusText = '', statusColor = 'var(--text-dim)';
    if (g.status === 'active') {
        if (g.is_my_turn) { statusText = '🎯 Твой ход — стреляй!'; statusColor = 'var(--accent-green)'; }
        else { statusText = '⏳ Ход соперника...'; statusColor = 'var(--accent-amber)'; }
    } else if (g.status === 'finished') {
        if (g.winner_id === getUserId()) { statusText = '🏆 Победа! Все корабли врага потоплены!'; statusColor = 'var(--accent-green)'; }
        else { statusText = '😔 Поражение. Твой флот уничтожен.'; statusColor = 'var(--accent-pink)'; }
    }
    const myBoard = g.my_board.split('');
    const myShots = g.my_shots.split('');
    const oppShots = (g.opp_shots || '-'.repeat(100)).split('');
    let myBoardHtml = '<div class="bs-grid">';
    for (let i = 0; i < 100; i++) {
        let cls = 'bs-cell';
        if (myBoard[i] === 'S') cls += ' ship';
        if (myBoard[i] === 'S' && oppShots[i] === 'H') cls += ' hit';
        else if (oppShots[i] === 'M') cls += ' miss';
        myBoardHtml += `<div class="${cls}"></div>`;
    }
    myBoardHtml += '</div>';
    let oppBoardHtml = '<div class="bs-grid">';
    for (let i = 0; i < 100; i++) {
        let cls = 'bs-cell';
        if (myShots[i] === 'H') cls += ' hit';
        else if (myShots[i] === 'M') cls += ' miss';
        const canClick = g.status === 'active' && g.is_my_turn && myShots[i] === '-';
        if (canClick) cls += ' clickable';
        oppBoardHtml += `<div class="${cls}" ${canClick ? `data-pos="${i}"` : ''}></div>`;
    }
    oppBoardHtml += '</div>';
    let buttonsHtml = '';
    if (g.status === 'finished') buttonsHtml = `<button class="action-btn" id="bsNewBtn">🔄 Новая игра</button><button class="action-btn secondary" id="bsBackBtn">🔙 К платформе</button>`;
    else buttonsHtml = `<button class="action-btn secondary" id="bsCancelBtn">❌ Отменить</button>`;
    render(`
        <h2>⚓ Морской бой #${g.id}</h2>
        <p style="text-align:center; font-size:16px; font-weight:600; color:${statusColor}; margin-bottom:12px;">${statusText}</p>
        <div class="bs-battle-boards">
            <div class="bs-board-section">
                <h3>🛡 Твой флот (${g.my_ships_remaining})</h3>
                ${myBoardHtml}
            </div>
            <div class="bs-board-section">
                <h3>🎯 Враг (${g.opp_ships_remaining})</h3>
                ${oppBoardHtml}
            </div>
        </div>
        ${g.opponent_username ? `<p style="text-align:center; font-size:13px; color:var(--text-dim); margin-top:12px;">Соперник: ${escapeHtml(g.opponent_username)}</p>` : ''}
        <div style="margin-top:16px;">${buttonsHtml}</div>
    `);
    document.querySelectorAll('.bs-grid .bs-cell[data-pos]').forEach(cell => {
        cell.addEventListener('click', function() {
            const pos = parseInt(this.getAttribute('data-pos'));
            bsShoot(pos);
        });
    });
    if (g.status === 'finished') {
        document.getElementById('bsNewBtn').addEventListener('click', () => { stopBsTimer(); currentBsGame = null; renderBsLobby(); });
        document.getElementById('bsBackBtn').addEventListener('click', () => { stopBsTimer(); currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); });
    }
    const cancelBtn = document.getElementById('bsCancelBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelBsGame);
}

function isBsCellHit(pos, game, isMyBoard) {
    if (!game) return false;
    const shots = isMyBoard ? game.opp_shots : game.my_shots;
    if (!shots) return false;
    return shots[pos] === 'H' || shots[pos] === 'M';
}

async function bsShoot(position) {
    const g = currentBsGame;
    if (!g || g.status !== 'active' || !g.is_my_turn) return;
    try {
        const r = await fetch(`${API_URL}/api/game/bs/shoot`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
            body: JSON.stringify({ game_id: g.id, user_id: getUserId(), position })
        });
        const d = await r.json();
        if (d.success) await loadBsState(g.id);
        else alert('Ошибка: ' + (d.error || 'unknown'));
    } catch (e) { alert('Сеть: ' + e); }
}

async function cancelBsGame() {
    if (!currentBsGame) return;
    try {
        await fetch(`${API_URL}/api/game/bs/cancel`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...HEADERS },
            body: JSON.stringify({ game_id: currentBsGame.id, user_id: getUserId() })
        });
    } catch (e) {}
    stopBsTimer();
    currentBsGame = null;
    renderBsLobby();
}

function startBsAutoRefresh(game_id) {
    stopBsTimer();
    bsRefreshTimer = setInterval(async () => {
        if (currentView !== 'game_battleship') { stopBsTimer(); return; }
        try {
            const user_id = getUserId();
            const r = await fetch(`${API_URL}/api/game/bs/state?game_id=${game_id}&user_id=${user_id}`, { headers: HEADERS });
            const d = await r.json();
            if (d.success) {
                currentBsGame = d.game;
                if (d.game.status === 'waiting') renderBsWaiting();
                else if (d.game.status === 'placing') renderBsPlacement();
                else renderBsBattle();
            }
        } catch (e) {}
    }, 3000);
}

function stopBsTimer() {
    if (bsRefreshTimer) { clearInterval(bsRefreshTimer); bsRefreshTimer = null; }
}

