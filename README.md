# 🕐 TabOut

Track time on websites and get nudged when limits are exceeded.

## Features

- **Time Tracking** — Automatic time tracking per website
- **Stats** — Charts and detailed analytics
- **Site Limits** — Set per-site time limits
- **Blocking Overlay** — Full-page nudge when limit reached
- **Privacy First** — All data stored locally

## Installation

1. Go to `chrome://extensions` (or `brave://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder
5. Pin to toolbar 📌

## File Structure

```
TabOut/
├── manifest.json     # Extension config
├── popup.html        # Quick stats popup
├── README.md
├── src/              # JavaScript
│   ├── background.js
│   ├── content.js
│   ├── popup.js
│   ├── options.js
│   └── stats.js
├── css/              # Stylesheets
│   ├── popup.css
│   ├── options.css
│   └── stats.css
├── pages/            # HTML pages
│   ├── options.html
│   └── stats.html
├── icons/            # Extension icons
└── lib/              # Libraries
    └── chart.min.js
```

## Privacy

All data stored locally. No external servers.

---

Made with ☕ for better browsing habits