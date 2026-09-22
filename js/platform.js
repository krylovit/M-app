// ===== игровая платформа (табы, рейтинг) =====
// ===== ИГРОВАЯ ПЛАТФОРМА =====
function showPlatform() {
    currentView = 'platform';
    setBackBtnVisible(true);
    stopGameTimer(); stopC4Timer(); stopCheckersTimer();
    if (currentPlatformTab === 'games') renderPlatformGames();
    else if (currentPlatformTab === 'leaderboard') renderPlatformLeaderboard();
    else if (currentPlatformTab === 'profile') renderPlatformProfile();
}

function platformTabsHtml() {
    return `
        <div class="platform-tabs">
            <button class="platform-tab ${currentPlatformTab === 'games' ? 'active' : ''}" data-tab="games">
                <i class="ti ti-device-gamepad-2"></i>
                <span>Игры</span>
            </button>
            <button class="platform-tab ${currentPlatformTab === 'leaderboard' ? 'active' : ''}" data-tab="leaderboard">
                <i class="ti ti-trophy"></i>
                <span>Рейтинг</span>
            </button>
            <button class="platform-tab ${currentPlatformTab === 'profile' ? 'active' : ''}" data-tab="profile">
                <i class="ti ti-user"></i>
                <span>Профиль</span>
            </button>
        </div>
    `;
}

function setupPlatformTabs() {
    document.querySelectorAll('.platform-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            currentPlatformTab = this.getAttribute('data-tab');
            showPlatform();
        });
    });
}

function renderPlatformGames() {
    render(`
        <h2>🎮 Игровая платформа</h2>
        <div class="games-grid">
            <div class="game-card" data-game="ttt">
                <div class="game-card-icon">🎯</div>
                <div class="game-card-title">ГОМОКУ</div>
                <div class="game-card-stats">${playerStats.wins}П / ${playerStats.losses}П</div>
            </div>
            <div class="game-card" data-game="c4">
                <div class="game-card-icon amber">🔴</div>
                <div class="game-card-title">4 В РЯД</div>
                <div class="game-card-stats">Играй с другом</div>
            </div>
            <div class="game-card" data-game="battleship">
                <div class="game-card-icon">⚓</div>
                <div class="game-card-title">МОРСКОЙ БОЙ</div>
                <div class="game-card-stats">Сетевой / с ботом</div>
            </div>
            <div class="game-card" data-game="checkers">
                <div class="game-card-icon">⚫</div>
                <div class="game-card-title">ШАШКИ</div>
                <div class="game-card-stats">Играй с другом</div>
            </div>
            <div class="game-card" data-game="retro">
                <div class="game-card-icon">🕹️</div>
                <div class="game-card-title">РЕТРО</div>
                <div class="game-card-stats">Эмулятор</div>
            </div>
            <div class="game-card" data-game="game3d">
                <div class="game-card-icon"><img src="icons/3d.jpg" alt="3D" style="width:48px;height:48px;border-radius:10px;object-fit:cover;" onerror="this.outerHTML='🎮'"></div>
                <div class="game-card-title">3D ИГРА</div>
                <div class="game-card-stats">Unity WebGL</div>
            </div>
            <div class="game-card disabled">
                <div class="game-card-badge">Скоро</div>
                <div class="game-card-icon" style="opacity:0.4;">➕</div>
                <div class="game-card-title">НОВАЯ ИГРА</div>
                <div class="game-card-stats">В разработке</div>
            </div>
        </div>
        ${platformTabsHtml()}
    `);
    document.querySelectorAll('.game-card[data-game]').forEach(card => {
        card.addEventListener('click', function() {
            const game = this.getAttribute('data-game');
            if (game === 'ttt') { currentView = 'game_ttt'; showTicTacToe(); }
            else if (game === 'c4') { currentView = 'game_c4'; showConnectFour(); }
            else if (game === 'checkers') { currentView = 'game_checkers'; showCheckers(); }
            else if (game === 'battleship') { currentView = 'game_battleship'; showBattleshipLobby(); }
            else if (game === 'retro') openRetroMenu();
            else if (game === 'game3d') openGame3d();
        });
    });
    setupPlatformTabs();
}

async function renderPlatformLeaderboard() {
    render(`
        <h2>🏆 Рейтинг</h2>
        <p style="text-align:center; color:var(--text-dim);">Загрузка...</p>
        ${platformTabsHtml()}
    `);
    setupPlatformTabs();

    try {
        const r = await fetch(`${API_URL}/api/game/leaderboard`, { headers: HEADERS });
        const d = await r.json();
        let html = `<h2>🏆 Рейтинг</h2>`;

        if (!d.success || !d.leaderboard.length) {
            html += `<p style="text-align:center; color:var(--text-dim); margin-top:20px;">Пока никого нет. Сыграй первым!</p>`;
        } else {
            d.leaderboard.forEach((p, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                const isMe = p.user_id === getUserId();
                html += `
                    <div class="leaderboard-row ${isMe ? 'me' : ''}">
                        <div class="leaderboard-medal">${medal}</div>
                        <div class="leaderboard-info">
                            <div class="leaderboard-name">@${escapeHtml(p.username || 'игрок')}</div>
                            <div class="leaderboard-detail">⚔️ ${p.wins}П / ${p.losses}П / ${p.draws}Н</div>
                        </div>
                        <div class="leaderboard-rating">${p.rating}</div>
                    </div>
                `;
            });
        }

        html += platformTabsHtml();
        render(html);
        setupPlatformTabs();
    } catch (e) {
        render(`<h2>🏆 Рейтинг</h2><p style="text-align:center; color:var(--accent-pink);">Ошибка загрузки</p>${platformTabsHtml()}`);
        setupPlatformTabs();
    }
}

function renderPlatformProfile() {
    const photoUrl = getPhotoUrl();
    const avatar = photoUrl
        ? `<img src="${photoUrl}" class="profile-avatar" alt="">`
        : `<div class="profile-avatar" style="display:flex;align-items:center;justify-content:center;font-size:28px;background:var(--bg-panel);">👤</div>`;

    render(`
        <h2>👤 Профиль</h2>
        <div class="profile-header">
            ${avatar}
            <div class="profile-info">
                <h3>${escapeHtml(getFirstName())}</h3>
                <p>@${escapeHtml(getUsername() || 'игрок')}</p>
            </div>
        </div>
        <div class="profile-stats">
            <div class="stat-box">
                <span class="stat-value amber">${playerStats.wins || 0}</span>
                <span class="stat-label">Побед</span>
            </div>
            <div class="stat-box">
                <span class="stat-value">${playerStats.rating || 0}</span>
                <span class="stat-label">Рейтинг</span>
            </div>
            <div class="stat-box">
                <span class="stat-value">${playerStats.losses || 0}</span>
                <span class="stat-label">Поражений</span>
            </div>
            <div class="stat-box">
                <span class="stat-value">${playerStats.draws || 0}</span>
                <span class="stat-label">Ничьих</span>
            </div>
        </div>
        ${platformTabsHtml()}
    `);
    setupPlatformTabs();
}

