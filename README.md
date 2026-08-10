# SkyBlock Price Regulator

A local Hypixel SkyBlock market dashboard for watching Bazaar order flips, spotting unusual prices, and tracking manual buys until they reach a target profit.

## Features

- Bazaar market table using Hypixel's public SkyBlock Bazaar endpoint
- Auction House BIN signal scanner using active auction data
- Bazaar order price chart with buy order, sell order, price grid, averages, and local history points
- Liquidity-aware Bazaar filters for finding practical buy-order to sell-order flips
- Filter presets for balanced, expensive, low-count, and liquid item searches
- Compact number inputs for large values, including `k`, `m`, `b`, and `t`
- Comma-formatted large numbers for easier reading
- Manual "Bought now" tracking with quantity, target percent, and profit status
- Quantity shorthand support, such as `10k`, `1m`, `24b`, and `2t`
- Input validation for empty values, leading zeroes, and invalid numbers
- Live data freshness display with automatic market refresh every 60 seconds
- Local Bazaar history snapshots saved for charting
- Device-local tracked buys saved in the browser

## How To Run

Install dependencies:

```bash
npm install
```

Start the local app:

```bash
npm run dev
```

The app usually opens through Vite at:

```text
http://127.0.0.1:5173
```

If that port is already busy, Vite may use the next available port, such as `5174`.

The local API server runs at:

```text
http://127.0.0.1:8787
```

If port `8787` is already in use, stop the other process or run the server with a different `PORT`.

## Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Local Data

The backend stores Bazaar history snapshots in:

```text
data/bazaar-history.json
```

That folder is ignored by Git because it is local runtime data.

Tracked buys are saved in your browser storage, so they are local to that browser/device.

## API Notes

This project uses Hypixel's public SkyBlock market endpoints through a local backend:

- `/api/bazaar`
- `/api/auctions?page=0`
- `/api/history/:productId`

The backend caches Bazaar and Auction House responses for 60 seconds to avoid unnecessary repeated requests.

This project is not affiliated with Hypixel.
