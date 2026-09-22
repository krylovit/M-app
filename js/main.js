// ===== навигация и init =====
function setupNavigation() {
    const nav = document.getElementById('mainMenu');
    if (!nav) return;
    nav.querySelectorAll('button').forEach(btn => {
        const a = btn.getAttribute('data-action');
        if (a === 'rates') btn.addEventListener('click', showRates);
        else if (a === 'weather') btn.addEventListener('click', showWeather);
        else if (a === 'mouse') btn.addEventListener('click', showMouseDay);
        else if (a === 'events') btn.addEventListener('click', showEvents);
        else if (a === 'radio') btn.addEventListener('click', showRadio);
        else if (a === 'video') btn.addEventListener('click', showVideo);
        else if (a === 'games') {
            btn.addEventListener('click', () => {
                currentView = 'platform';
                currentPlatformTab = 'games';
                showPlatform();
            });
        }
    });
}

async function init() {
    setupNavigation();
    const boot = dosBoot();
    await loadPhrases();
    await fetchAllData();
    await boot;
    showMainMenu();
    dosSplashHide();
}

document.addEventListener('DOMContentLoaded', init);
