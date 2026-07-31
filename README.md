# GVMC · Food Safety Inspection Frequency Monitoring (SW56)

Pilot build for **GVMC – Public Health, FSSAI**. Tracks which licensed food
businesses in each ward have been inspected in the last 12 months, and which are
**overdue** — with a live dashboard and auto-alerts.

## Problem (from official brief)
FSSAI mandates food-safety inspections for licensed businesses. No dashboard
tracks, per ward, which businesses were inspected in the past 12 months and
which are overdue. This is a greenfield build for GVMC.

## What this pilot ships
- **Inspection log** — append-only record of every inspection event
  (business, ward, license no., date, inspector, findings, next-due date).
- **Web dashboard** — ward-level compliance, overdue count, compliance rate,
  per-ward breakdown, and a per-business status table.
- **Alerts** — businesses whose latest inspection is >12 months old are
  auto-flagged OVERDUE (no manual patrol needed).

## Stack
- Backend: Node.js + Express, JSON file store (`backend/inspections.json`).
  Zero native deps → runs anywhere GVMC has Node.
- Frontend: React (Vite) dashboard.

> NOTE: `sqlite3` native binding failed to build on the hackathon machine; the
> store was switched to a JSON file (`store.js`) with an identical API. To move
> to SQLite later, re-point `store.js` at a working `sqlite3`/`better-sqlite3`
> build — the REST routes in `server.js` do not change.

## Run it
```bash
# 1. backend (port 5050)
cd backend
npm install
node seeds.js        # load pilot data (Wards 1-3)
node server.js

# 2. frontend (port 5173, proxies /api -> :5050)
cd ../frontend
npm install
npm run dev
```
Open http://localhost:5173

## API
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/dashboard/summary` | totals, compliance rate, per-ward |
| GET | `/api/businesses?ward=&status=OVERDUE` | per-business current status |
| GET | `/api/alerts/overdue` | auto-flagged overdue businesses |
| GET/POST/PUT/DELETE | `/api/inspections` | full CRUD on inspection log |

## Demo data
10 licensed businesses across 3 wards, 4 of them overdue (>12 months since last
inspection) → 60% compliance. Realistic FSSAI-style license numbers and findings.

## Rollout (per brief)
Week 1 Discovery → Week 2 Build (this pilot) → Week 3 Pilot against live zone
→ Handover as a GVMC-operable service. Replace pilot data with the live
inspection export and set the designated GVMC data owner.
