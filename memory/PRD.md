# Jivdani Vegetable Suppliers — PRD

## App Overview
B2B vegetable supply management application. Vegetable supplier manages orders from restaurants, tracks deliveries, billing, and payments.

## Completed Features

### Core (Original)
- Admin and Restaurant portals with role-based auth
- Restaurant order placement with vegetable selection
- Admin order confirmation (review qty/rate), delivery marking
- Daily vegetable rate setting by admin
- Restaurant ledger and payment tracking
- Purchase list (consolidated daily purchase report)
- Vegetable management, Restaurant management

### Phase 2 (Completed July 2025)
- **Purchases**: Supplier management (CRUD), purchase bills from suppliers (with items/rate/qty), supplier payment recording, paid/unpaid bill tracking
- **Expenses**: Misc operational expenses with categories (Transport, Labor, Fuel, Packaging, Maintenance, Utilities, Misc), month filter, bill reference notes
- **Reports**: Monthly financial summary (revenue, payments received, pending receivables, supplier cost, expenses, gross profit), yearly bar chart, month-by-month table
- **Print improvements**: @media print CSS - hides sidebar, full-width content, A4 page margins, `no-print` class convention
- **Print button**: Added to AdminOrders, AdminPurchases, AdminExpenses, AdminReports pages
- **PWA**: manifest.json (dark green theme), service-worker.js (offline caching), icons (192x192 + 512x512), registered in index.js
 — PRD

## Original Problem Statement
B2B web app for "Jivdani Vegetable Suppliers". 50+ restaurants currently send vegetable requirements via PDF photos; admin manually tallies quantities & rates for next-morning supply. Replace this with a digital ordering platform where restaurants log in, fill an order form (kg), see a live estimated bill using daily market rates, and submit. Admin manages orders, daily rates, restaurants, and ledgers (pending bills). Tech: Caddy, MongoDB, Docker. Must be responsive.

## User Choices
- Login: restaurants self-register (admin approves) AND admin can create accounts.
- Rates: both auto-calc using daily rate + admin override per order.
- Billing: ledger/pending-balance tracking only (no online payment).
- Workflow: show estimated bill instantly, then admin confirms.
- Design: clean, minimal, soothing (Organic & Earthy green theme — Manrope/Karla).

## Architecture
- **Frontend**: React 19 + Tailwind + shadcn/ui + framer-motion + recharts. JWT (Bearer in localStorage), AuthContext, role-based routing.
- **Backend**: FastAPI (`/api` prefix), JWT auth (bcrypt), MongoDB (motor).
- **DB collections**: users (admin+restaurant), vegetables, orders, payments, daily_rates.
- Env-driven config (MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_EMAIL/PASSWORD). Kubernetes ingress plays Caddy's reverse-proxy role; Docker/Caddy configs supplied at self-host deployment.

## Implemented (2026-06-05)
- Auth: register (pending approval), login, /me, admin seeding, role guards.
- Restaurant: live-total order form (+/- kg steppers), order confirmation, My Orders history, My Ledger (billed/paid/pending), pending-approval gate.
- Admin: dashboard (6 stat cards + 7-day chart + recent orders), Orders (filter, review & confirm with qty/rate override, mark delivered), Daily Rates (bulk update + snapshot), Vegetables CRUD, Restaurants (create/approve/delete), Ledgers (per-restaurant + record payment).
- 18 default vegetables seeded. Cascade delete on restaurant removal; payment amount validation.
- Tested: 25/25 backend + full frontend e2e passed (iteration_1).

## Implemented (Iteration 2)
- Admin Orders: search by restaurant + delete order (DELETE /api/orders/{id}).
- Admin Restaurants: search by name/email + full edit dialog (name/phone/address/password).
- Restaurant My Orders: search (date/vegetable) + status filter chips.
- **Daily Consolidated Purchase List** (/admin/purchase-list): aggregates total qty & est cost per vegetable across all restaurants for a chosen delivery date (pending+confirmed), with print support — for next-morning buying.
- Tested: 34/34 backend + full frontend e2e passed (iteration_2).

## Implemented (Iteration 3)
- **Repeat last order** button on the order screen (loads latest order at today's rates).
- **Per-order Repeat** ("Repeat this order") on each past order in My Orders → re-order any specific order via router state, recalculated at today's rates, skips unavailable items.
- **Admin-configurable order cut-off** (new Settings page `/admin/settings`): toggle + time (IST/Asia-Kolkata). After cut-off, backend blocks new orders (403) and the order screen shows a lock banner + disabled submit; the morning purchase list locks automatically. Backend: GET/PUT `/api/settings`, settings collection, IST-aware `compute_lock`.

## Implemented (Iteration 4)
- **Deployment & Seeding Resolution**: Resolved MongoDB crash on host without AVX instruction support by downgrading MongoDB from version 7 to `4.4`.
- **Environment Template**: Created `.env.example` file.
- **Deployment Automation**: Added `deploy.sh` script to pull changes and redeploy automatically using `docker-compose`.
- **E2E Status**: Successfully deployed to `45.196.196.114`, seeded admin user (`admin@jivdani.com`) and 18 default vegetables.

## Personas
- **Admin (Jivdani owner)**: manages rates, confirms orders, tracks dues.
- **Restaurant**: places daily orders, views bills & ledger.

## Backlog
- P1: Order CSV/PDF export & daily purchase summary (consolidated buy-list across all restaurants for next morning).
- P1: WhatsApp/SMS order confirmations (Twilio).
- P2: Overpayment shown as "Credit", `/orders/status` JSON body, brute-force lockout, split server.py into modules.
- P2: Restaurant favourites / repeat-last-order shortcut.

## Next Tasks
- Provide Caddyfile + docker-compose for self-hosting on deploy.
- Daily consolidated purchase report for admin.
