# FitID

FitID is a cross-platform web application (PWA-first) that creates a universal digital fit identity users can reuse across e-commerce platforms.

This repository is structured as an MVP foundation with:
- FastAPI backend for identity, scan processing, profile management, and recommendations
- Next.js frontend for mobile-first user experience and dashboard workflow
- PostgreSQL-ready infrastructure and Docker-based local deployment

## MVP Scope Implemented

The current build covers the requested development priorities:

1. Authentication system (real Google ID token verification + FitID JWT issuance)
2. Basic profile system (FitID profile creation, retrieval, and sensitivity updates)
3. Simplified body scan (fast measurement ingestion + pose/posture placeholders)
4. Recommendation engine (size-fit scoring and compatibility ranking)
5. Product filtering foundation (ranked candidate products by fit profile)
6. Responsive UI shell and PWA manifest
7. Integration entrypoint for "Sign in with FitID" partner flow

## Project Structure

```text
FIT-ID/
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ routes/
│  │  │  │  ├─ auth.py
│  │  │  │  ├─ integration.py
│  │  │  │  ├─ profile.py
│  │  │  │  ├─ recommend.py
│  │  │  │  └─ scan.py
│  │  │  └─ router.py
│  │  ├─ core/
│  │  │  ├─ config.py
│  │  │  └─ security.py
│  │  ├─ db/
│  │  │  ├─ models.py
│  │  │  ├─ schemas.py
│  │  │  └─ session.py
│  │  ├─ services/
│  │  │  ├─ recommendation.py
│  │  │  └─ scan.py
│  │  └─ main.py
│  ├─ .env.example
│  ├─ Dockerfile
│  └─ requirements.txt
├─ frontend/
│  ├─ public/
│  │  ├─ icon.svg
│  │  ├─ manifest.json
│  │  └─ sw.js
│  ├─ src/
│  │  ├─ app/
│  │  │  ├─ dashboard/page.tsx
│  │  │  ├─ scan/page.tsx
│  │  │  ├─ layout.tsx
│  │  │  └─ page.tsx
│  │  ├─ components/Hero.tsx
│  │  ├─ lib/api.ts
│  │  └─ styles/globals.css
│  ├─ .env.local.example
│  ├─ Dockerfile
│  ├─ next.config.js
│  ├─ package.json
│  └─ tsconfig.json
├─ docker-compose.yml
├─ .gitignore
└─ README.md
```

## Architecture Overview

### Backend (FastAPI, Python)

- `auth`: verifies Google ID token against configured client ID, then returns FitID access token
- `scan`: accepts 60-second scan measurement payload and produces structured body data
- `profile`: manages FitID profile retrieval, sensitivity/preference updates, and deletion
- `recommend`: scores products against FitID profile for size and material compatibility
- `integration`: partner token endpoint for approved data sharing flow

### Frontend (Next.js, TypeScript)

- Landing page with app intro and scan/dashboard entry points
- Real Google sign-in button via NextAuth
- Auth success callback exchanges Google `id_token` with backend `POST /auth/google`
- FitID session persisted in browser storage and used by scan/dashboard flows
- Scan flow page with MVP capture trigger
- Dashboard page that displays stored profile and ranked recommendations
- API utility layer for backend communication
- PWA setup (`manifest.json`, service worker bootstrap, standalone-capable metadata)

## Security and Privacy Model (MVP + Upgrade Path)

Implemented now:
- Server-side Google ID token verification (`google-auth`)
- JWT-based FitID session token issuance
- CORS control by environment config
- PostgreSQL-backed profile persistence (SQLAlchemy)
- Structured consent model for partner data sharing API

Required production upgrades:
- Encrypted sensitive fields at rest
- DB-backed consent ledger + audit logs
- Fine-grained OAuth scopes per partner
- Secure key management (Vault/KMS)
- User data deletion workflow + retention policy

## Setup Instructions

## 1) Run with Docker (recommended)

From repository root:

```bash
docker compose up --build
```

Services:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:8000](http://localhost:8000)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Production deployment (Docker)

1. Copy `.env.deploy.example` to `.env.deploy` and fill real secrets/URLs.
2. Set your production Google OAuth settings:
   - Authorized JavaScript origin: `https://app.fitid.yourdomain.com`
   - Authorized redirect URI: `https://app.fitid.yourdomain.com/api/auth/callback/google`
3. Deploy:

```bash
docker compose --env-file .env.deploy up --build -d
```

Health checks:
- Backend readiness: `GET /ready`
- Backend liveness: `GET /health`

## 2) Run manually

### Backend

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
copy .env.local.example .env.local
npm run dev
```

Set required env values in `frontend/.env.local`:
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_API_BASE`

Set required env values in `backend/.env`:
- `DATABASE_URL`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `ALLOWED_ORIGINS`

## API Endpoints (MVP)

Base URL: `http://localhost:8000/api/v1`

- `POST /auth/google` -> verify Google token and issue FitID JWT token
- `POST /scan/{email}` -> run simplified scan and upsert profile body data
- `GET /profile/{email}` -> read FitID profile
- `PUT /profile/{email}/sensitivity` -> update allergy/sensitivity/preferences
- `DELETE /profile/{email}` -> delete profile data
- `POST /recommend/{email}` -> rank candidate products for fit compatibility
- `POST /integration/consent` -> store/update explicit partner data sharing consent
- `POST /integration/token` -> issue partner token only if consent exists and requested fields are approved

## Example Functional Flow

1. User clicks Sign in with Google on landing page
2. Google login returns to `/auth/success`
3. Frontend sends Google `id_token` to backend `POST /auth/google`
4. Backend verifies token and returns FitID JWT + identity
5. Frontend stores FitID session and routes user to dashboard
6. User runs scan and loads profile recommendations

## New Guided Journey UI

- Start at `/` for modern sign-in screen
- Complete step-by-step journey at `/journey`
- Journey follows 7 required FitID stages end-to-end
- Uses backend APIs for scan, profile, consent, and recommendations

## AI Build Prompt

- Use `docs/FITID_MASTER_BUILD_PROMPT.md` as the canonical system creation prompt.

## Next Milestones (Post-MVP)

- Camera-based guided scan pipeline (MediaPipe/OpenCV live capture)
- 3D avatar generation and virtual try-on rendering
- Production OAuth provider support for partner stores ("Sign in with FitID")
- Recommendation model evolution from rules to ML scoring
- Full consent center and profile deletion UX

## Notes

- No license file is added, as requested.
- This repository is intentionally modular so each feature can evolve independently.
