/**
 * TabOut - Background Service Worker
 * 
 * Memory-optimized design using Chrome Alarms API
 */

// State - minimal, rehydrated from storage when needed
let currentSite = null;
let lastActiveTime = Date.now();

// ============ Utility Functions ============

function getTodayKey() {
    const today = new Date();
    return `tracking_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        // Skip internal browser pages
        if (urlObj.protocol === 'chrome:' || urlObj.protocol === 'chrome-extension:' ||
            urlObj.protocol === 'brave:' || urlObj.protocol === 'about:') {
            return null;
        }
        return urlObj.hostname.replace('www.', '');
    } catch {
        return null;
    }
}

// ============ Storage Functions ============

async function getTrackingData() {
    const key = getTodayKey();
    const result = await chrome.storage.local.get(key);
    return result[key] || {};
}

async function saveTrackingData(data) {
    const key = getTodayKey();
    await chrome.storage.local.set({ [key]: data });
}

async function getSettings() {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {
        nudgeEnabled: true,
        limits: {},
        globalDailyLimit: 14400, // 4 hours default
        nudgedToday: {}
    };
}

async function saveSettings(settings) {
    await chrome.storage.local.set({ settings });
}

// ============ Time Tracking ============

async function updateTimeForSite(domain, seconds) {
    if (!domain) return;

    const data = await getTrackingData();
    data[domain] = (data[domain] || 0) + seconds;
    await saveTrackingData(data);

    // Check limits after updating
    await checkLimits(domain, data[domain]);
}

async function checkLimits(domain, timeSpent) {
    const settings = await getSettings();

    console.log('[TabOut] checkLimits called:', { domain, timeSpent, nudgeEnabled: settings.nudgeEnabled });

    if (!settings.nudgeEnabled) {
        console.log('[TabOut] Nudge disabled, skipping');
        return;
    }

    // Initialize nudgedToday if needed
    const todayKey = getTodayKey();
    if (!settings.nudgedToday || settings.nudgedToday.date !== todayKey) {
        console.log('[TabOut] Resetting nudgedToday for new day');
        settings.nudgedToday = { date: todayKey, sites: {} };
        await saveSettings(settings);
    }

    // Check site-specific limit
    const siteLimit = settings.limits[domain];
    console.log('[TabOut] Site limit check:', {
        domain,
        siteLimit,
        timeSpent,
        alreadyNudged: settings.nudgedToday.sites[domain],
        shouldNotify: siteLimit && timeSpent >= siteLimit && !settings.nudgedToday.sites[domain]
    });

    if (siteLimit && timeSpent >= siteLimit && !settings.nudgedToday.sites[domain]) {
        // Mark as nudged to avoid spam
        settings.nudgedToday.sites[domain] = true;
        await saveSettings(settings);

        console.log('[TabOut] Sending nudge overlay to content script');

        // Send message to content script to show overlay
        await sendNudgeToActiveTab(domain, timeSpent, siteLimit);
    }

    // Check global limit
    const data = await getTrackingData();
    const totalTime = Object.values(data).reduce((sum, t) => sum + t, 0);

    if (settings.globalDailyLimit && totalTime >= settings.globalDailyLimit && !settings.nudgedToday.sites['__global__']) {
        settings.nudgedToday.sites['__global__'] = true;
        await saveSettings(settings);

        console.log('[TabOut] Sending global nudge overlay');
        await sendNudgeToActiveTab('all sites', totalTime, settings.globalDailyLimit);
    }
}

// Send nudge message to the active tab's content script
async function sendNudgeToActiveTab(domain, timeSpent, limit) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            await chrome.tabs.sendMessage(tab.id, {
                type: 'SHOW_NUDGE',
                domain: domain,
                timeSpent: timeSpent,
                limit: limit
            });
            console.log('[TabOut] Nudge message sent to tab:', tab.id);
        }
    } catch (err) {
        console.error('[TabOut] Failed to send nudge:', err);
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_LIMIT') {
        // Content script asking to check if limit is exceeded
        handleCheckLimit(message.domain, sender.tab?.id);
    } else if (message.type === 'USER_CONTINUED') {
        // User chose to continue despite limit
        console.log('[TabOut] User continued browsing:', message.domain);
    } else if (message.type === 'CLOSE_TAB') {
        // User clicked "Leave Site" - close the tab
        if (sender.tab?.id) {
            chrome.tabs.remove(sender.tab.id);
        }
    }
    return true;
});

async function handleCheckLimit(domain, tabId) {
    if (!domain || !tabId) return;

    const data = await getTrackingData();
    const settings = await getSettings();
    const timeSpent = data[domain] || 0;
    const siteLimit = settings.limits[domain];

    if (siteLimit && timeSpent >= siteLimit && settings.nudgeEnabled) {
        // Already over limit, show nudge immediately
        try {
            await chrome.tabs.sendMessage(tabId, {
                type: 'SHOW_NUDGE',
                domain: domain,
                timeSpent: timeSpent,
                limit: siteLimit
            });
        } catch (err) {
            console.error('[TabOut] Failed to send initial nudge:', err);
        }
    }
}

// ============ Tab & Window Tracking ============

async function updateCurrentSite() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
            const domain = extractDomain(tab.url);
            if (domain !== currentSite) {
                currentSite = domain;
                lastActiveTime = Date.now();
            }
        } else {
            currentSite = null;
        }
    } catch {
        currentSite = null;
    }
}

// ============ Alarm Handler (Memory Efficient) ============

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'trackTime') {
        // Check if user is active
        const state = await chrome.idle.queryState(60);
        if (state === 'active' && currentSite) {
            const now = Date.now();
            const elapsed = Math.round((now - lastActiveTime) / 1000);

            if (elapsed > 0 && elapsed < 120) { // Sanity check: max 2 min per interval
                await updateTimeForSite(currentSite, elapsed);
            }

            lastActiveTime = now;
        }

        // Refresh current site info
        await updateCurrentSite();
    }
});

// ============ Event Listeners ============

chrome.tabs.onActivated.addListener(async () => {
    await updateCurrentSite();
    lastActiveTime = Date.now();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        await updateCurrentSite();
        lastActiveTime = Date.now();
    }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        currentSite = null;
    } else {
        await updateCurrentSite();
        lastActiveTime = Date.now();
    }
});

chrome.idle.onStateChanged.addListener((state) => {
    if (state !== 'active') {
        currentSite = null;
    } else {
        updateCurrentSite();
        lastActiveTime = Date.now();
    }
});

// ============ Initialization ============

chrome.runtime.onInstalled.addListener(() => {
    // Create tracking alarm - fires every 5 seconds
    chrome.alarms.create('trackTime', { periodInMinutes: 5 / 60 });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create('trackTime', { periodInMinutes: 5 / 60 });
    updateCurrentSite();
});

// Initial setup
updateCurrentSite();
chrome.alarms.create('trackTime', { periodInMinutes: 5 / 60 });
