# Inventory Management System — Backend

## What's built

**Part 1 (Auth):** JWT auth, role-based access, password reset, refresh token rotation. See git history / prior notes for details — unchanged in this pass.

**Part 2 (this pass) — every remaining module**, matching the frontend's feature set:

- **Categories, Suppliers, Customers** — straightforward CRUD, with delete guarded against orphaning products/sales (e.g. can't delete a category that still has products in it).
- **Products** — full CRUD, `stockStatus` (IN_STOCK/LOW_STOCK/OUT_OF_STOCK) computed server-side, `searchProducts`, `lowStockProducts`, `outOfStockProducts`, `expiringProducts` (optional `expiryDate` field). Barcode/QR are generated **client-side** (the frontend already does this with `jsbarcode`/`qrcode.react`) — the backend just stores the `barcode` string, avoiding the native `canvas` build dependency issues noted in Part 1.
- **Purchases** — `createPurchase` creates the order **and immediately receives it**: increases stock, logs a `StockMovement`, and clears any stale low-stock notification for each affected product.
- **Sales** — `createSale` validates stock availability for every line item **before** changing anything (no partial-failure sales), takes price from the product's current `sellingPrice` server-side (never trusts a client-supplied price), decreases stock, logs movements, and fires a `NEW_ORDER` notification.
- **Stock Management** — `stockIn`/`stockOut`/`stockAdjust`/`stockTransfer` mutations, all writing to a shared `StockMovement` audit trail. Adjustments/removals that would take stock below zero are rejected.
- **Notifications** — a real `Notification` collection. Low-stock/out-of-stock notifications are created and cleared automatically as stock changes (`utils/notifications.js`), rather than needing every resolver to manage this by hand.
- **Dashboard** — `dashboardSummary` query aggregates totals, revenue/profit/expenses, monthly sales-vs-purchases (last 6 months), and stock-by-category — computed in JS from the relevant collections rather than a complex aggregation pipeline, which is appropriate at this data scale.
- **Image uploads** — `POST /api/upload` (multer, 2MB limit, PNG/JPEG/WEBP/GIF only, bearer-token authenticated) returns a URL under `/uploads/...` for the frontend to store on a product. This is a REST route, not GraphQL — full GraphQL multipart upload support wasn't worth the added complexity for this use case.

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## Design notes / trade-offs

- **Sale creation isn't wrapped in a MongoDB transaction.** It validates all stock availability up front (so a sale can't fail partway through), but under concurrent load there's a small race window between the check and the `$inc` update. If you deploy against a replica set, wrap `createSale`/`createPurchase`'s stock mutations in a `mongoose.startSession()` transaction for full correctness under concurrency.
- **Stock transfers don't model separate warehouse/location entities** — `stockTransfer` logs an audit entry (`from`/`to` as free-text) without actually moving stock between two tracked locations, since the schema doesn't have a "Location" collection. Total stock on hand is unaffected by a transfer, which matches the frontend's existing behavior.
- **`nodemailer` was bumped from 6.9.13 to 9.0.3** after `npm audit` flagged several high-severity advisories (SMTP command injection, CRLF injection, TLS validation issues) in the older version. The basic `createTransport`/`sendMail` API used here is unaffected — no code changes were needed beyond the version bump.

## What's tested

- Every file passes `node --check`; `npm install` completes cleanly with **0 vulnerabilities** per `npm audit`.
- The full merged GraphQL schema (all 10 modules) builds successfully via `makeExecutableSchema` — verified by printing and inspecting it.
- **I could not run this against a live database in this sandbox.** I tried both `mongodb-memory-server` (blocked: the sandbox's network allowlist blocks MongoDB's binary download server) and `apt install mongodb` (MongoDB no longer ships packages in Ubuntu's default repos). I wrote a full end-to-end test script exercising register → create category/supplier/product → purchase (stock increases) → sale (stock decreases, overselling rejected) → notifications (fire on low stock, clear on restock) → dashboard summary → stock movement history, but couldn't execute it here.
- **Please run this against your own MongoDB instance and walk through that same flow** before treating it as verified — I'm confident in the logic from careful review, but it has not been proven against a real database in this environment.

## Next step: wiring the frontend to this backend

The frontend (delivered separately) currently runs against an in-memory mock (`src/context/DataContext.jsx`) with identical business logic to what's now implemented here. The natural next step is swapping each page's `useData()` calls for real Apollo `useQuery`/`useMutation` calls against this schema — happy to do that next.

"# Inventory_API" 
