/**
 * TabOut - Popup Script
 */

// ============ Utility Functions ============

function getTodayKey() {
  const today = new Date();
  return `tracking_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getFaviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

function getProgressClass(percentage, hasLimit) {
  if (!hasLimit) return '';
  if (percentage >= 100) return 'danger';
  if (percentage >= 75) return 'warning';
  return '';
}

// ============ Data Loading ============

async function loadTrackingData() {
  const key = getTodayKey();
  const result = await chrome.storage.local.get([key, 'settings']);
  const data = result[key] || {};
  const settings = result.settings || { limits: {} };

  return { data, settings };
}

// ============ UI Rendering ============

function renderSiteCard(domain, seconds, maxSeconds, limit) {
  const percentage = Math.min((seconds / maxSeconds) * 100, 100);
  const limitPercentage = limit ? Math.min((seconds / limit) * 100, 100) : null;
  const progressClass = getProgressClass(limitPercentage, !!limit);

  return `
    <div class="site-card">
      <div class="site-header">
        <div class="site-name">
          <img src="${getFaviconUrl(domain)}" alt="" class="site-favicon" onerror="this.style.display='none'">
          <span>${domain}</span>
        </div>
        <span class="site-time">${formatTime(seconds)}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${progressClass}" style="width: ${percentage}%"></div>
      </div>
    </div>
  `;
}

async function renderSitesList() {
  const { data, settings } = await loadTrackingData();
  const sitesListEl = document.getElementById('sitesList');
  const totalTimeEl = document.getElementById('totalTime');

  // Convert to array and sort by time (descending)
  const sites = Object.entries(data)
    .map(([domain, seconds]) => ({ domain, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  // Calculate totals
  const totalSeconds = sites.reduce((sum, s) => sum + s.seconds, 0);
  const maxSeconds = sites.length > 0 ? sites[0].seconds : 0;

  // Update total time
  totalTimeEl.textContent = formatTime(totalSeconds);

  // Render sites or empty state
  if (sites.length === 0) {
    sitesListEl.innerHTML = `
      <div class="empty-state">
        <span class="emoji">📊</span>
        <p>Start browsing to track your time!</p>
      </div>
    `;
    return;
  }

  sitesListEl.innerHTML = sites
    .map(({ domain, seconds }) =>
      renderSiteCard(domain, seconds, maxSeconds, settings.limits?.[domain])
    )
    .join('');
}

// ============ Event Handlers ============

document.getElementById('openSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('openStats').addEventListener('click', () => {
  chrome.tabs.create({ url: 'pages/stats.html' });
});

// ============ Initialization ============

renderSitesList();

// Refresh every 5 seconds while popup is open
setInterval(renderSitesList, 5000);
