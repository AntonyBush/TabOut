/**
 * TabOut - Stats Script
 */

// ============ State ============

let currentDate = new Date();
let pieChart = null;
let barChart = null;
let weeklyChart = null;

// Chart colors - new cyan/teal theme
const CHART_COLORS = [
    '#00d4aa', '#00b894', '#0984e3', '#74b9ff',
    '#10b981', '#34d399', '#6ee7b7',
    '#f59e0b', '#fbbf24', '#fcd34d',
    '#ef4444', '#f87171', '#fca5a5'
];

// ============ Utility Functions ============

function getDateKey(date) {
    return `tracking_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(date) {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
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

function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

// ============ Data Loading ============

async function getTrackingData(date) {
    const key = getDateKey(date);
    const result = await chrome.storage.local.get(key);
    return result[key] || {};
}

async function getWeeklyData() {
    const weekData = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const data = await getTrackingData(date);
        const total = Object.values(data).reduce((sum, t) => sum + t, 0);
        weekData.push({
            date: date,
            label: date.toLocaleDateString('en-US', { weekday: 'short' }),
            total: total
        });
    }

    return weekData;
}

// ============ Chart Rendering ============

function renderPieChart(data) {
    const ctx = document.getElementById('pieChart').getContext('2d');

    const sites = Object.entries(data)
        .map(([domain, seconds]) => ({ domain, seconds }))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 8);

    if (sites.length === 0) {
        if (pieChart) pieChart.destroy();
        pieChart = null;
        return;
    }

    const chartData = {
        labels: sites.map(s => s.domain),
        datasets: [{
            data: sites.map(s => s.seconds),
            backgroundColor: CHART_COLORS.slice(0, sites.length),
            borderWidth: 0
        }]
    };

    if (pieChart) {
        pieChart.data = chartData;
        pieChart.update();
    } else {
        pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#a0a0b8',
                            font: { size: 11 },
                            boxWidth: 12,
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${formatTime(ctx.raw)}`
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
}

function renderBarChart(data) {
    const ctx = document.getElementById('barChart').getContext('2d');

    const sites = Object.entries(data)
        .map(([domain, seconds]) => ({ domain, seconds }))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 6);

    if (sites.length === 0) {
        if (barChart) barChart.destroy();
        barChart = null;
        return;
    }

    const chartData = {
        labels: sites.map(s => s.domain),
        datasets: [{
            data: sites.map(s => Math.round(s.seconds / 60)),
            backgroundColor: CHART_COLORS.slice(0, sites.length),
            borderRadius: 6,
            barThickness: 24
        }]
    };

    if (barChart) {
        barChart.data = chartData;
        barChart.update();
    } else {
        barChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.raw} minutes`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: '#252542' },
                        ticks: { color: '#6b6b80' },
                        title: {
                            display: true,
                            text: 'Minutes',
                            color: '#6b6b80'
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#a0a0b8', font: { size: 11 } }
                    }
                }
            }
        });
    }
}

async function renderWeeklyChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    const weekData = await getWeeklyData();

    const chartData = {
        labels: weekData.map(d => d.label),
        datasets: [{
            data: weekData.map(d => Math.round(d.total / 60)),
            backgroundColor: weekData.map((d, i) =>
                isToday(d.date) ? '#00d4aa' : '#1a1a24'
            ),
            borderRadius: 6,
            barThickness: 40
        }]
    };

    if (weeklyChart) {
        weeklyChart.data = chartData;
        weeklyChart.update();
    } else {
        weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.raw} minutes`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#a0a0b8' }
                    },
                    y: {
                        grid: { color: '#252542' },
                        ticks: {
                            color: '#6b6b80',
                            callback: (val) => `${val}m`
                        }
                    }
                }
            }
        });
    }
}

// ============ UI Rendering ============

function renderSummary(data) {
    const sites = Object.entries(data);
    const totalSeconds = sites.reduce((sum, [, seconds]) => sum + seconds, 0);
    const topSite = sites.sort((a, b) => b[1] - a[1])[0];

    document.getElementById('totalTime').textContent = formatTime(totalSeconds);
    document.getElementById('siteCount').textContent = sites.length;
    document.getElementById('topSite').textContent = topSite ? topSite[0] : '-';
}

function renderSitesList(data) {
    const container = document.getElementById('sitesList');
    const sites = Object.entries(data)
        .map(([domain, seconds]) => ({ domain, seconds }))
        .sort((a, b) => b.seconds - a.seconds);

    const totalSeconds = sites.reduce((sum, s) => sum + s.seconds, 0);

    if (sites.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <span class="emoji">📊</span>
        <p>No browsing data for this day</p>
      </div>
    `;
        return;
    }

    container.innerHTML = sites.map(({ domain, seconds }) => {
        const percent = totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0;
        return `
      <div class="site-detail-item">
        <div class="site-detail-info">
          <img src="${getFaviconUrl(domain)}" alt="" class="site-detail-favicon" onerror="this.style.display='none'">
          <span class="site-detail-name">${domain}</span>
        </div>
        <div class="site-detail-stats">
          <span class="site-detail-time">${formatTime(seconds)}</span>
          <span class="site-detail-percent">${percent}%</span>
        </div>
      </div>
    `;
    }).join('');
}

async function renderAll() {
    document.getElementById('currentDate').textContent = formatDate(currentDate);

    // Disable next button if viewing today
    document.getElementById('nextDay').disabled = isToday(currentDate);

    try {
        const data = await getTrackingData(currentDate);
        console.log('[TabOut] Stats data:', data);

        renderSummary(data);

        // Check if Chart.js is loaded
        if (typeof Chart !== 'undefined') {
            renderPieChart(data);
            renderBarChart(data);
            await renderWeeklyChart();
        } else {
            console.error('[TabOut] Chart.js not loaded');
        }

        renderSitesList(data);
    } catch (err) {
        console.error('[TabOut] Error rendering stats:', err);
    }
}

// ============ Event Handlers ============

document.getElementById('prevDay').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    renderAll();
});

document.getElementById('nextDay').addEventListener('click', () => {
    if (!isToday(currentDate)) {
        currentDate.setDate(currentDate.getDate() + 1);
        renderAll();
    }
});

// ============ Initialization ============

// Wait for everything including external scripts to load
window.addEventListener('load', () => {
    console.log('[TabOut] Page loaded, Chart available:', typeof Chart !== 'undefined');
    renderAll();
});
