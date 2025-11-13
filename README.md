# TradePopping

Private lab environment for trading research and tools.

## Structure

- `backend/` — FastAPI backend (API, auth, data access)
- `frontend/` — React + Tailwind UI (lab console)
- `reverse-proxy/` — Nginx reverse proxy for / and /api routes
- `.github/workflows/` — CI/CD pipelines (Docker deploy, etc.)

## High-Level Goals

- One front door at `www.tradepopping.com`
- No public marketing site, just a login
- All internal tools under `/apps/*` behind auth
- Dockerized deployment to DigitalOcean Droplet