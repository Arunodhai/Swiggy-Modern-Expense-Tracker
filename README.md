# Swiggy Expense Tracker (Chrome Extension)

A Chrome Extension (Manifest V3) to track your Swiggy order spending and visualize it in a modern analytics dashboard.

## Screenshots
<img width="317" height="420" alt="Screenshot 2026-02-27 at 11 44 49 AM" src="https://github.com/user-attachments/assets/efe0e30d-ef37-43d2-bf28-7fe487f53924" />

<img width="1440" height="812" alt="Screenshot 2026-02-27 at 11 37 55 AM" src="https://github.com/user-attachments/assets/8dc0b4e7-6ccd-488f-b295-f96c182b91e7" />

<img width="1440" height="812" alt="Screenshot 2026-02-27 at 11 37 37 AM" src="https://github.com/user-attachments/assets/d63c8b0f-fde1-4fc3-8a66-3482007cb859" />



## Highlights

- Sync orders from your currently open Swiggy tab
- Deduplicated local order store (`chrome.storage.local`)
- Single-page analytics dashboard with multiple visualizations
- Global year filter (`All Time` + per-year)
- Theme toggle (Light / Dark)
- Animated chart entry transitions
- Profile phone capture from Swiggy account page

## Dashboard Includes

- KPI cards:
  - Total spend
  - Total orders
  - Avg order value
  - Active months
  - Most used restaurant
  - Most ordered item
- Charts:
  - Monthly Spend (bar)
  - Spend by Restaurant (donut + hover value)
  - Busiest Ordering Days/Times (heatmap + hover)
  - Food Item Count (horizontal bars + hover)
  - Order Trend (line + hover)
  - Order Activity & Streak (calendar grid + streak stats)

## Screenshots

Add your screenshots here:

```md
![Popup](screenshots/popup.png)
![Dashboard Light](screenshots/dashboard-light.png)
![Dashboard Dark](screenshots/dashboard-dark.png)
```

## Installation (Developer Mode)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder

## Usage

1. Open Swiggy order history: `https://www.swiggy.com/my-account/orders`
2. Scroll down to load older orders (lazy-loaded by Swiggy)
3. Open extension popup
4. Click **Sync current Swiggy page**
5. Click **Open full dashboard**
6. Use year filter / theme toggle as needed
7. Repeat sync after scrolling further for older history

## Data Storage & Privacy

- Data is stored locally in your browser using `chrome.storage.local`
- No backend/server is used
- No cloud sync by default
- Keys:
  - `swiggy_orders_v1`
  - `swiggy_profile_v1`
  - `swiggy_dashboard_theme_v1`

## Permissions Used

- `storage` - save orders/profile/theme
- `tabs` - access active tab for sync
- `scripting` - inject content script fallback when needed
- Host permission: `https://www.swiggy.com/*`

## Tech Stack

- Manifest V3
- Service worker background script
- Content script DOM extraction
- Canvas-based custom chart rendering
- Vanilla JS + CSS

## Project Structure

- `manifest.json` - extension config
- `src/background.js` - message handlers + storage + sync orchestration
- `src/content.js` - Swiggy page scraping (orders + profile)
- `src/popup.html|css|js` - popup UI and actions
- `src/dashboard.html|css|js` - dashboard UI, theming, charts, interactions
- `src/icons/` - app icons/logo

## Troubleshooting

- **Could not establish connection. Receiving end does not exist**
  - Open a Swiggy tab and retry sync
  - Extension has fallback script injection; retry once after page load
- **No/low spend values**
  - Ensure order cards on page show `Total Paid`
  - Scroll more, then sync again
- **Data looks outdated**
  - Click **Refresh from current tab** in dashboard after syncing

## Disclaimer

This project is an independent utility and is not affiliated with or endorsed by Swiggy.
