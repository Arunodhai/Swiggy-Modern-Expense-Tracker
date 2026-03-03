# Swiggy Expense Dashboard (CSV Upload)

A standalone dashboard app that visualizes your Swiggy order history from a CSV file.

The project now also includes a Next.js migration shell so you can move off the single-file dashboard incrementally without changing the current dashboard behavior.

## Screenshots
<img width="2880" height="2198" alt="screencapture-localhost-3000-2026-03-03-10_20_15" src="https://github.com/user-attachments/assets/82e90777-c90d-4607-898c-89a157b151a6" />

<img width="2880" height="2198" alt="screencapture-localhost-3000-2026-03-03-10_20_34" src="https://github.com/user-attachments/assets/ceaa2047-c613-43e5-b80e-70b1d1b9664e" />

## What It Does

- Upload your Swiggy orders CSV directly in the dashboard
- Store imported orders locally in browser `localStorage`
- Render KPIs and interactive charts from CSV data
- Filter analytics by year (`All Time` + per-year)
- Toggle light/dark theme
- Reorder dashboard cards with drag and drop

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
  - Spend by Restaurant (donut)
  - Busiest Ordering Days/Times (radial heatmap)
  - Food Item Count (horizontal bars)
  - Order Trend (line)
  - Order Activity & Streak (calendar grid)

## Expected CSV Columns

The importer supports your current format (example: `swiggy_orders_final.csv`) and reads these fields:

- `Order No`
- `Restaurant`
- `Date`
- `Time`
- `Status`
- `Items`
- `Order Total`

Additional columns are ignored.

## Run Locally

### Next.js app

1. Install dependencies:

```bash
npm install
```

2. Start the Next.js dev server:

```bash
npm run dev
```

3. Open `http://localhost:3000`

If the dev server starts throwing stale chunk errors such as `Cannot find module './548.js'`, run a clean dev start instead:

```bash
npm run dev:clean
```

If port `3000` is already occupied by an older Next process, use:

```bash
npm run dev:fresh
```

That command clears `.next`, stops the process currently listening on port `3000`, and starts one fresh dev server on `3000`.

The Next.js homepage renders the full dashboard natively, including the KPI cards, canvas charts, activity calendar, upload flow, theme toggle, year filter, card reordering, and deterministic rule-based insights.

## Data Storage

- Imported data is saved in browser `localStorage`
- Storage key used: `swiggy_orders_v1`
- Theme and card order are also stored locally

## Project Structure

- `components/migration-dashboard.tsx` - React implementation of the full dashboard UI, charts, calendar, and interactions
- `lib/dashboard-data.ts` - shared browser-side parsing, storage, KPI computation, and persisted dashboard state helpers
- `app/page.tsx` - Next.js homepage for the full dashboard
- `app/globals.css` - Next.js dashboard styling
- `package.json` - Next.js app scripts and dependencies

## Current State

- The dashboard is fully implemented in Next.js.
- The app uses browser `localStorage` for imported orders, theme preference, profile data, and card ordering.
- The old standalone HTML implementation and compatibility route have been removed.

## Notes

- This project is an independent utility and is not affiliated with or endorsed by Swiggy.
