# Swiggy Modern Expense Tracker

A Next.js dashboard for exploring your Swiggy order history from a CSV export.

It parses your orders in the browser, stores them locally, and renders a polished dashboard with KPIs, charts, streak views, milestones, cuisine breakdowns, and deterministic insight tooltips.

## Screenshots

<img width="2880" height="2198" alt="screencapture-localhost-3000-2026-03-03-10_20_15" src="https://github.com/user-attachments/assets/82e90777-c90d-4607-898c-89a157b151a6" />

<img width="2880" height="2198" alt="screencapture-localhost-3000-2026-03-03-10_20_34" src="https://github.com/user-attachments/assets/ceaa2047-c613-43e5-b80e-70b1d1b9664e" />

## Features

- Upload your Swiggy orders CSV directly in the dashboard
- Persist imported orders, theme, profile data, and card order in browser `localStorage`
- Switch between `All Time` and per-year views
- Toggle dark and light themes
- Reorder the main chart cards with drag and drop
- View deterministic insight tooltips for KPI cards and chart cards
- Explore an additional section with `Milestones` and `Cuisine Radar`

## Dashboard Contents

### KPI cards

- Total spend
- Total orders
- Avg order value
- Active months
- Most used restaurant
- Most ordered item

### Main visualization grid

- Monthly Spend
- Spend by Restaurant
- Food Item Count
- Busiest Ordering Days/Times
- Order Trend
- Order Activity & Streak

### Additional section

- Milestones
- Cuisine Radar

## Insights

The project uses a local deterministic rule engine, not an external AI service.

- KPI and chart insights are generated from computed metrics
- Insight text is consistent with the visible dashboard state
- No CSV data is sent to any backend for insight generation

## Expected CSV Columns

The importer supports the current Swiggy export shape and reads these fields:

- `Order No`
- `Restaurant`
- `Date`
- `Time`
- `Status`
- `Items`
- `Order Total`

Additional columns are ignored.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

If the dev server gets into a stale `.next` state, use:

```bash
npm run dev:clean
```

If port `3000` is occupied by an old process, use:

```bash
npm run dev:fresh
```

## Data Storage

- Orders are stored in browser `localStorage` under `swiggy_orders_v1`
- Theme is stored under `swiggy_theme_v1`
- Card order and profile data are also stored locally

## Project Structure

- `app/page.tsx` - main page entry
- `app/layout.tsx` - app shell and theme bootstrapping
- `app/globals.css` - full dashboard styling
- `components/migration-dashboard.tsx` - top-level dashboard page state and KPI layer
- `components/dashboard-chart-grid.tsx` - chart grid, extra panels, calendar modal, and canvas rendering
- `lib/dashboard-data.ts` - CSV parsing, storage helpers, and dashboard state shaping
- `lib/dashboard-view.ts` - chart view-model computation
- `lib/kpi-insights.ts` - deterministic insight rule engine
- `scripts/dev-fresh.mjs` - clean dev startup helper

## Current State

- The dashboard is fully implemented as a Next.js application
- Insights are fully local and deterministic

## Note

This project is an independent utility and is not affiliated with or endorsed by Swiggy.
