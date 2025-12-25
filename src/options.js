/**
 * TabOut - Options Script
 */

// ============ Utility Functions ============

function getTodayKey() {
    const today = new Date();
    return `tracking_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getFaviconUrl(domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

function formatMinutes(minutes) {
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
}

function showSaveStatus(message = 'Saved!') {
    const statusEl = document.getElementById('saveStatus');
    statusEl.textContent = message;
    statusEl.classList.add('visible');
    setTimeout(() => statusEl.classList.remove('visible'), 2000);
}

// ============ Storage Functions ============

async function getSettings() {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {
        nudgeEnabled: true,
        limits: {},
        globalDailyLimit: 14400,
        nudgedToday: {}
    };
}

async function saveSettings(settings) {
    await chrome.storage.local.set({ settings });
    showSaveStatus();
}

// ============ UI Rendering ============

async function loadSettings() {
    const settings = await getSettings();

    document.getElementById('nudgeEnabled').checked = settings.nudgeEnabled;

    const globalLimitMinutes = Math.floor(settings.globalDailyLimit / 60);
    document.getElementById('globalLimitHours').value = Math.floor(globalLimitMinutes / 60);
    document.getElementById('globalLimitMinutes').value = globalLimitMinutes % 60;

    renderLimits(settings.limits);
}

function renderLimits(limits) {
    const container = document.getElementById('limitsContainer');
    const entries = Object.entries(limits);

    if (entries.length === 0) {
        container.innerHTML = '<p class="empty-limits">No site limits configured</p>';
        return;
    }

    container.innerHTML = entries
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([domain, seconds]) => `
            <div class="limit-item" data-domain="${domain}">
                <div class="limit-domain">
                    <img src="${getFaviconUrl(domain)}" alt="" onerror="this.style.display='none'">
                    <span>${domain}</span>
                </div>
                <div class="limit-actions">
                    <span class="limit-time">${formatMinutes(Math.round(seconds / 60))}</span>
                    <button class="limit-remove" title="Remove">&times;</button>
                </div>
            </div>
        `).join('');

    container.querySelectorAll('.limit-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const domain = e.target.closest('.limit-item').dataset.domain;
            await removeLimit(domain);
        });
    });
}

// ============ Event Handlers ============

async function handleNudgeToggle(e) {
    const settings = await getSettings();
    settings.nudgeEnabled = e.target.checked;
    await saveSettings(settings);
}

async function handleGlobalLimitChange() {
    const hours = parseInt(document.getElementById('globalLimitHours').value) || 0;
    const minutes = parseInt(document.getElementById('globalLimitMinutes').value) || 0;
    const totalSeconds = (hours * 3600) + (minutes * 60);

    const settings = await getSettings();
    settings.globalDailyLimit = totalSeconds;
    await saveSettings(settings);
}

async function addLimit() {
    const domainInput = document.getElementById('newSiteDomain');
    const minutesInput = document.getElementById('newSiteMinutes');

    let domain = domainInput.value.trim().toLowerCase();
    const minutes = parseInt(minutesInput.value) || 30;

    if (!domain) return;

    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

    const settings = await getSettings();
    settings.limits[domain] = minutes * 60;
    await saveSettings(settings);

    domainInput.value = '';
    minutesInput.value = '30';

    renderLimits(settings.limits);
}

async function removeLimit(domain) {
    const settings = await getSettings();
    delete settings.limits[domain];
    await saveSettings(settings);
    renderLimits(settings.limits);
}

async function resetToday() {
    if (!confirm('Reset today\'s tracking data?')) return;
    const key = getTodayKey();
    await chrome.storage.local.remove(key);
    showSaveStatus('Today\'s data cleared!');
}

async function clearAllData() {
    if (!confirm('Delete ALL data and settings? This cannot be undone.')) return;
    await chrome.storage.local.clear();
    showSaveStatus('All data cleared!');
    loadSettings();
}

// ============ Event Listeners ============

document.getElementById('nudgeEnabled').addEventListener('change', handleNudgeToggle);
document.getElementById('globalLimitHours').addEventListener('change', handleGlobalLimitChange);
document.getElementById('globalLimitMinutes').addEventListener('change', handleGlobalLimitChange);
document.getElementById('addLimitBtn').addEventListener('click', addLimit);
document.getElementById('newSiteDomain').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addLimit();
});
document.getElementById('resetTodayBtn').addEventListener('click', resetToday);
document.getElementById('clearAllBtn').addEventListener('click', clearAllData);

// ============ Initialization ============

loadSettings();
