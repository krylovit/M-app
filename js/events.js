// ===== события + глобальные лисенеры (confirmModal, backBtn, battleship) =====
// ===== СОБЫТИЯ =====
function showEvents() {
    currentView = 'events'; setBackBtnVisible(true);
    let html = `<h2>📅 Мои события</h2>${renderTabs('mine')}<div class="events-list">`;
    if (!events || events.length === 0) html += `<p>У тебя пока нет событий</p>`;
    else events.forEach(e => { html += renderEventCard(e, true); });
    html += `</div><button class="action-btn" id="addEventBtn">➕ Добавить событие</button>`;
    html += `<button class="action-btn secondary" id="toggleHiddenBtn">${showHidden ? '🙈 Скрыть неактуальные' : '👁 Показать скрытые'}</button>`;
    render(html);
    document.getElementById('addEventBtn').addEventListener('click', openCreateScreen);
    document.getElementById('toggleHiddenBtn').addEventListener('click', toggleHidden);
    setupEventCardHandlers(true);
}

function showPublicEvents() {
    currentView = 'public_events'; setBackBtnVisible(true);
    let html = `<h2>🌍 Общие события</h2>${renderTabs('public')}<div class="events-list">`;
    if (!publicEvents || publicEvents.length === 0) html += `<p>Общих событий пока нет</p>`;
    else publicEvents.forEach(e => { html += renderEventCard(e, false); });
    html += `</div>`;
    render(html);
    setupEventCardHandlers(false);
}

function renderTabs(active) {
    return `<div class="tabs"><button class="${active === 'mine' ? 'tab active' : 'tab'}" id="tabMine">📅 Мои</button><button class="${active === 'public' ? 'tab active' : 'tab'}" id="tabPublic">🌍 Общие</button></div>`;
}

function renderEventCard(e, isMine) {
    const icon = e.is_public ? '🌍' : '🔒';
    const hiddenClass = e.is_hidden ? ' hidden-event' : '';
    const hideLabel = e.is_hidden ? '👁 Показать' : '🚫 Скрыть';
    const desc = e.description ? `<div class="event-card-desc">${escapeHtml(e.description)}</div>` : '';
    let thumb = e.image && imageCache[e.image] ? `<img src="${imageCache[e.image]}" class="event-thumb" alt="">` : `<span class="event-icon">${icon}</span>`;
    let menuBtn = '', menuBlock = '';
    if (isMine) {
        menuBtn = `<button class="event-menu-btn" data-role="toggle-menu" data-id="${e.id}">⋮</button>`;
        menuBlock = `<div class="event-menu" id="menu-${e.id}"><button data-role="edit" data-id="${e.id}">✏️ Редактировать</button><button data-role="hide" data-id="${e.id}" data-hidden="${e.is_hidden ? 1 : 0}">${hideLabel}</button><button class="danger" data-role="delete" data-id="${e.id}">🗑️ Удалить</button></div>`;
    }
    let author = !isMine && e.username ? `<div class="event-card-author">от @${escapeHtml(e.username)}</div>` : '';
    return `<div class="event-card${hiddenClass}" data-id="${e.id}"><div class="event-card-header" data-role="open-edit" data-id="${e.id}" data-mine="${isMine ? 1 : 0}">${thumb}<div class="event-card-info"><div class="event-card-name">${escapeHtml(e.name)}</div><div class="event-card-date">${e.date}</div>${desc}${author}</div>${menuBtn}</div>${menuBlock}</div>`;
}

function setupEventCardHandlers(isMine) {
    const tm = document.getElementById('tabMine'), tp = document.getElementById('tabPublic');
    if (tm) tm.addEventListener('click', showEvents);
    if (tp) tp.addEventListener('click', showPublicEvents);
    if (isMine) {
        document.querySelectorAll('[data-role="toggle-menu"]').forEach(btn => {
            btn.addEventListener('click', function(ev) {
                ev.stopPropagation();
                const id = this.getAttribute('data-id');
                const menu = document.getElementById('menu-' + id);
                const isOpen = menu.style.display === 'flex';
                document.querySelectorAll('.event-menu').forEach(m => m.style.display = 'none');
                if (!isOpen) menu.style.display = 'flex';
            });
        });
        document.querySelectorAll('[data-role="edit"]').forEach(btn => btn.addEventListener('click', function() { openEditScreen(this.getAttribute('data-id')); }));
        document.querySelectorAll('[data-role="hide"]').forEach(btn => btn.addEventListener('click', async function() { await hideEventApi(this.getAttribute('data-id'), this.getAttribute('data-hidden') !== '1'); await fetchAllData(); }));
        document.querySelectorAll('[data-role="delete"]').forEach(btn => btn.addEventListener('click', function() { const ev = events.find(e => e.id == this.getAttribute('data-id')); if (ev) openConfirmDelete(ev); }));
    }
    document.querySelectorAll('[data-role="open-edit"]').forEach(el => {
        el.addEventListener('click', function(ev) {
            if (ev.target.closest('[data-role="toggle-menu"]')) return;
            const id = this.getAttribute('data-id');
            if (this.getAttribute('data-mine') === '1') openEditScreen(id);
            else openViewScreen(id);
        });
    });
}

function toggleHidden() { showHidden = !showHidden; fetchAllData(); }

function openViewScreen(id) {
    const ev = publicEvents.find(e => e.id == id); if (!ev) return;
    currentView = 'edit'; setBackBtnVisible(true);
    let img = ev.image && imageCache[ev.image] ? `<img src="${imageCache[ev.image]}" class="event-full-image" alt="">` : '';
    render(`<h2>🌍 ${escapeHtml(ev.name)}</h2>${img}<p><b>📅 Дата:</b> ${ev.date}</p>${ev.description ? `<p><b>📝 Описание:</b></p><p>${escapeHtml(ev.description)}</p>` : ''}<p style="font-size:12px;color:var(--text-dim);">от @${escapeHtml(ev.username || 'неизвестный')}</p><button class="action-btn secondary" id="backToListBtn">🔙 К списку</button>`);
    document.getElementById('backToListBtn').addEventListener('click', showPublicEvents);
}

function openCreateScreen() { editingEventId = null; editingImageFilename = ''; currentView = 'edit'; renderEditScreen(null); }
function openEditScreen(id) { editingEventId = parseInt(id); const ev = events.find(e => e.id == editingEventId); editingImageFilename = ev ? (ev.image || '') : ''; currentView = 'edit'; renderEditScreen(ev); }
function showEditScreen() { if (currentView !== 'edit') return; renderEditScreen(editingEventId ? events.find(e => e.id == editingEventId) : null); }

function renderEditScreen(ev) {
    currentView = 'edit'; setBackBtnVisible(true);
    const title = ev ? '✏️ Редактирование' : '➕ Новое событие';
    const name = ev ? escapeHtml(ev.name) : '', date = ev ? ev.date : '';
    const desc = ev ? escapeHtml(ev.description || '') : '';
    const isPublic = ev ? ev.is_public : false, descLen = desc.length;
    let imageBlock = editingImageFilename && imageCache[editingImageFilename]
        ? `<img src="${imageCache[editingImageFilename]}" class="event-preview-image" alt=""><button type="button" class="action-btn secondary" id="removeImageBtn" style="margin-top:8px;">🗑️ Удалить фото</button>`
        : `<p style="font-size:13px;color:var(--text-dim);">Фото не загружено</p>`;
    render(`
        <h2>${title}</h2>
        <div class="form-group"><label>📷 Фото</label><div id="imagePreviewContainer">${imageBlock}</div><input type="file" id="edit-image-input" accept="image/*" style="display:none;"><button type="button" class="action-btn" id="uploadImageBtn" style="margin-top:8px;">📷 Загрузить фото</button></div>
        <div class="form-group"><label>Название</label><input type="text" id="edit-name" value="${name}" placeholder="Например: День рождения"></div>
        <div class="form-group"><label>Дата (ГГГГ-ММ-ДД)</label><input type="text" id="edit-date" value="${date}" placeholder="2027-12-31"></div>
        <div class="form-group"><label>Описание (до 200 символов)</label><textarea id="edit-desc" maxlength="200" placeholder="Кратко о событии...">${desc}</textarea><div class="char-counter" id="charCounter">${descLen} / 200</div></div>
        <div class="form-group"><label>Тип</label><div class="radio-group"><label><input type="radio" name="eventType" value="private" ${isPublic ? '' : 'checked'}> 🔒 Личное</label><label><input type="radio" name="eventType" value="public" ${isPublic ? 'checked' : ''}> 🌍 Общее</label></div></div>
        <button class="action-btn" id="saveBtn">💾 Сохранить</button>
        <button class="action-btn secondary" id="cancelEditBtn">❌ Отмена</button>
    `);
    document.getElementById('edit-desc').addEventListener('input', function() { document.getElementById('charCounter').textContent = this.value.length + ' / 200'; });
    const fi = document.getElementById('edit-image-input'), ub = document.getElementById('uploadImageBtn');
    ub.addEventListener('click', () => fi.click());
    fi.addEventListener('change', async function() {
        const f = this.files[0]; if (!f) return;
        if (f.size > 5 * 1024 * 1024) { alert('Максимум 5 МБ'); return; }
        ub.textContent = '⏳ Загрузка...'; ub.disabled = true;
        const res = await uploadImageApi(f);
        if (res.success) {
            editingImageFilename = res.filename;
            const localUrl = URL.createObjectURL(f);
            imageCache[editingImageFilename] = localUrl;
            document.getElementById('imagePreviewContainer').innerHTML = `<img src="${localUrl}" class="event-preview-image" alt=""><button type="button" class="action-btn secondary" id="removeImageBtn" style="margin-top:8px;">🗑️ Удалить фото</button>`;
            document.getElementById('removeImageBtn').addEventListener('click', function() { editingImageFilename = ''; document.getElementById('imagePreviewContainer').innerHTML = `<p style="font-size:13px;color:var(--text-dim);">Фото не загружено</p>`; });
        }
        ub.textContent = '📷 Загрузить фото'; ub.disabled = false; fi.value = '';
    });
    const rb = document.getElementById('removeImageBtn');
    if (rb) rb.addEventListener('click', function() { editingImageFilename = ''; document.getElementById('imagePreviewContainer').innerHTML = `<p style="font-size:13px;color:var(--text-dim);">Фото не загружено</p>`; });
    document.getElementById('saveBtn').addEventListener('click', saveEvent);
    document.getElementById('cancelEditBtn').addEventListener('click', function() { currentView = 'events'; showEvents(); });
}

async function saveEvent() {
    const name = document.getElementById('edit-name').value.trim();
    const date = document.getElementById('edit-date').value.trim();
    const description = document.getElementById('edit-desc').value.trim();
    const isPublic = document.querySelector('input[name="eventType"]:checked').value === 'public' ? 1 : 0;
    if (!name) { alert('Введи название'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert('Неверный формат даты'); return; }
    const payload = { name, date, is_public: isPublic, description, image: editingImageFilename || '' };
    if (editingEventId) await updateEventApi(editingEventId, payload);
    else await addEventApi(payload);
    editingEventId = null; editingImageFilename = ''; currentView = 'events'; await fetchAllData();
}

function openConfirmDelete(ev) { pendingDeleteId = ev.id; document.getElementById('confirmText').textContent = `«${ev.name}» — ${ev.date}`; document.getElementById('confirmModal').style.display = 'flex'; }
document.getElementById('confirmCancel').addEventListener('click', function() { pendingDeleteId = null; document.getElementById('confirmModal').style.display = 'none'; });
document.getElementById('confirmDelete').addEventListener('click', async function() { if (pendingDeleteId) { await deleteEventApi(pendingDeleteId); pendingDeleteId = null; } document.getElementById('confirmModal').style.display = 'none'; await fetchAllData(); });

document.addEventListener('click', function(e) { if (!e.target.closest('.event-menu') && !e.target.closest('[data-role="toggle-menu"]')) document.querySelectorAll('.event-menu').forEach(m => m.style.display = 'none'); });

document.getElementById('backBtn').addEventListener('click', function() {
    stopLottie(); destroyChart(); stopGameTimer(); stopC4Timer(); stopCheckersTimer();
    if (currentView === 'edit') { currentView = 'events'; showEvents(); }
    else if (currentView === 'chart') { currentView = 'rates'; showRates(); }
    else if (currentView === 'game_ttt' || currentView === 'game_c4' || currentView === 'game_checkers') { currentView = 'platform'; currentPlatformTab = 'games'; showPlatform(); }
    else if (currentView === 'videoplayer') { stopVideo(); currentView = 'video'; renderVideoDir(); }
    else if (currentView === 'video' && videoPath.length) { videoPath.pop(); renderVideoDir(); }
    else if (currentView === 'musicPlaylist') { currentView = 'musicCatalog'; musicPath = []; renderMusicDir(); }
    else if (currentView === 'musicCatalog' && musicPath.length) { musicPath.pop(); renderMusicDir(); }
    else if (currentView === 'musicCatalog') { showRadio(); }
    else if (currentView === 'platform' || currentView === 'video') { showMainMenu(); }
    else { showMainMenu(); }
});

var closeBtn = document.getElementById('closeBattleshipBtn');
var fsBtn = document.getElementById('fullscreenBtn');
var closeBtnTimer = null;
function showCloseBtn() {
    closeBtn.style.opacity = '1';
    closeBtn.style.pointerEvents = 'auto';
    fsBtn.style.opacity = '1';
    fsBtn.style.pointerEvents = 'auto';
    clearTimeout(closeBtnTimer);
}
closeBtn.addEventListener('click', function() {
    if (document.fullscreenElement) { document.exitFullscreen(); }
    document.getElementById('battleship-container').style.display = 'none';
    closeBtn.style.opacity = '1';
    closeBtn.style.pointerEvents = 'auto';
    fsBtn.style.opacity = '1';
    fsBtn.style.pointerEvents = 'auto';
    clearTimeout(closeBtnTimer);
});
fsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var container = document.getElementById('battleship-container');
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else if (container.requestFullscreen) {
        container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
    }
    showCloseBtn();
});
document.getElementById('battleship-container').addEventListener('click', function(e) {
    if (e.target === closeBtn || e.target === fsBtn) return;
    showCloseBtn();
});
document.addEventListener('fullscreenchange', function() {
    if (document.getElementById('battleship-container').style.display !== 'none') showCloseBtn();
});
window.addEventListener('blur', function() {
    if (document.activeElement && document.activeElement.id === 'battleship-frame'
        && document.getElementById('battleship-container').style.display !== 'none') {
        showCloseBtn();
    }
});

