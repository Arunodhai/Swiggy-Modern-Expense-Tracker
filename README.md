# Swiggy Expense Tracker (Chrome Extension)

A Manifest V3 Chrome extension that captures Swiggy order history and shows a modern, minimalist expense dashboard.

## Features

- Tracks orders discovered on Swiggy order pages and stores them in `chrome.storage.local`
- Deduplicates orders to avoid repeated imports
- Popup with quick stats and sync action
- Dashboard with multiple visualizations:
  - Total spend / total orders / average order value / active months
  - Monthly spend bar chart
  - Spend-by-restaurant donut chart
  - Monthly order trend line chart
  - Top restaurants list

## Install (Developer Mode)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder:
   - `/Users/arunodhaiv/Desktop/Swiggy Expense Tracker`

## How to use

1. Open Swiggy and navigate to your order history (for example `/my-account/orders`)
2. Scroll to load older orders (Swiggy lazy-loads history)
3. Open the extension popup and click **Sync current Swiggy page**
4. Click **Open dashboard** to view analytics
5. Repeat sync after scrolling further to capture more historical orders

## Notes

- DOM scraping can break if Swiggy changes page structure.
- This extension only reads order information visible in your signed-in browser session.
- Data stays local in your browser (`chrome.storage.local`).

## Future enhancements

- Export CSV
- Category tagging (food type/cuisine)
- Cross-device sync through authenticated backend
- Better parser tuned to latest Swiggy DOM attributes
