/**
 * TabOut - Content Script
 */

let overlayShown = false;
let currentDomain = window.location.hostname.replace('www.', '');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHOW_NUDGE') {
        showNudgeOverlay(message.domain, message.timeSpent, message.limit);
    } else if (message.type === 'HIDE_NUDGE') {
        hideNudgeOverlay();
    }
});

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutes`;
}

function showNudgeOverlay(domain, timeSpent, limit) {
    if (overlayShown) return;
    overlayShown = true;

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'sites-tracker-overlay';
    overlay.innerHTML = `
    <div class="st-overlay-backdrop"></div>
    <div class="st-overlay-modal">
      <div class="st-overlay-icon">⏰</div>
      <h1 class="st-overlay-title">Time Limit Reached!</h1>
      <p class="st-overlay-message">
        You've spent <strong>${formatTime(timeSpent)}</strong> on <strong>${domain}</strong>.
        <br>Your limit is ${formatTime(limit)}.
      </p>
      <p class="st-overlay-submessage">
        Taking a break can help you stay focused and productive.
      </p>
      <div class="st-overlay-buttons">
        <button class="st-btn st-btn-primary" id="st-leave-btn">
          Leave Site
        </button>
        <button class="st-btn st-btn-secondary" id="st-continue-btn">
          Continue Anyway
        </button>
      </div>
      <p class="st-overlay-footer">
        Powered by TabOut
      </p>
    </div>
  `;

    // Add styles
    const styles = document.createElement('style');
    styles.id = 'sites-tracker-styles';
    styles.textContent = `
    #sites-tracker-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483647;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .st-overlay-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(10, 10, 15, 0.97);
      backdrop-filter: blur(12px);
    }

    .st-overlay-modal {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(145deg, #12121a 0%, #1a1a24 100%);
      border: 1px solid rgba(0, 212, 170, 0.15);
      border-radius: 20px;
      padding: 44px;
      max-width: 440px;
      width: 90%;
      text-align: center;
      box-shadow: 0 32px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
      animation: st-modal-appear 0.3s ease-out;
    }

    @keyframes st-modal-appear {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.9);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    .st-overlay-icon {
      font-size: 56px;
      margin-bottom: 20px;
      animation: st-pulse 2s ease-in-out infinite;
    }

    @keyframes st-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .st-overlay-title {
      color: #00d4aa;
      font-size: 26px;
      font-weight: 700;
      margin: 0 0 14px 0;
    }

    .st-overlay-message {
      color: #e5e7eb;
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 10px 0;
    }

    .st-overlay-message strong {
      color: #00d4aa;
    }

    .st-overlay-submessage {
      color: #6b7280;
      font-size: 14px;
      margin: 0 0 28px 0;
    }

    .st-overlay-buttons {
      display: flex;
      gap: 14px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .st-btn {
      padding: 13px 28px;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 150px;
    }

    .st-btn-primary {
      background: linear-gradient(135deg, #00d4aa 0%, #00b894 50%, #0984e3 100%);
      color: #0a0a0f;
      box-shadow: 0 4px 16px rgba(0, 212, 170, 0.3);
    }

    .st-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 212, 170, 0.4);
    }

    .st-btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #9ca3af;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .st-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    .st-overlay-footer {
      color: #4b5563;
      font-size: 11px;
      margin: 22px 0 0 0;
    }
  `;

    document.head.appendChild(styles);
    document.body.appendChild(overlay);

    // Add event listeners
    document.getElementById('st-leave-btn').addEventListener('click', () => {
        // Send message to background script to close this tab
        chrome.runtime.sendMessage({ type: 'CLOSE_TAB' });
    });

    document.getElementById('st-continue-btn').addEventListener('click', () => {
        hideNudgeOverlay();
        // Notify background that user chose to continue
        chrome.runtime.sendMessage({ type: 'USER_CONTINUED', domain: currentDomain });
    });
}

function hideNudgeOverlay() {
    overlayShown = false;
    const overlay = document.getElementById('sites-tracker-overlay');
    const styles = document.getElementById('sites-tracker-styles');
    if (overlay) overlay.remove();
    if (styles) styles.remove();
}

// Check on page load
chrome.runtime.sendMessage({ type: 'CHECK_LIMIT', domain: currentDomain });
