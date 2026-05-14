# FitID Project Structure & Architecture

This document provides a comprehensive explanation of the FitID project structure, architecture, and how all components work together.

## Overview

FitID is a **universal digital fit identity platform** that creates a reusable body profile users can carry across e-commerce platforms. It consists of:

- **Backend**: FastAPI (Python) - handles authentication, body scanning, recommendations, and partner integrations
- **Frontend**: Next.js (React + TypeScript) - provides the mobile-first user interface
- **Database**: PostgreSQL (production) / SQLite (development) - stores user profiles, consents, and OAuth data

---

## Project Structure

```
FIT-ID/
├── backend/                    # FastAPI backend application
│   ├── app/
│   │   ├── api/               # API layer - routes and dependencies
│   │   │   ├── router.py      # Main API router aggregation
│   │   │   ├── deps.py        # Dependency injection (auth, DB)
│   │   │   └── routes/        # Individual API endpoints
│   │   │       ├── auth.py          # Authentication (Google OAuth + password)
│   │   │       ├── business.py      # Business insights dashboard
│   │   │       ├── integration.py   # Partner consent & data sharing
│   │   │       ├── oauth_applications.py  # OAuth app management
│   │   │       ├── oauth_partner.py       # Partner OAuth flow
│   │   │       ├── profile.py       # Profile CRUD operations
│   │   │       ├── recommend.py     # Product recommendations
│   │   │       └── scan.py          # Body scan processing
│   │   ├── core/              # Core configuration
│   │   │   ├── config.py      # Environment settings (Pydantic)
│   │   │   └── security.py    # JWT handling and security utils
│   │   ├── data/              # Static data and constants
│   │   │   ├── posture_labels.py    # Human-readable posture descriptions
│   │   │   └── product_catalog.py   # Sample product dataset
│   │   ├── db/                # Database layer
│   │   │   ├── models.py      # SQLAlchemy ORM models
│   │   │   ├── schemas.py     # Pydantic request/response schemas
│   │   │   └── session.py     # Database connection management
│   │   ├── services/          # Business logic layer
│   │   │   ├── recommendation.py      # Fit scoring algorithms
│   │   │   └── scan.py              # Image processing & measurements
│   │   └── main.py            # FastAPI application entry point
│   ├── .env                   # Environment variables (not committed)
│   ├── .env.example           # Environment template
│   ├── Dockerfile             # Container configuration
│   ├── requirements.txt       # Python dependencies
│   └── fitid.db               # SQLite database (development)
│
├── frontend/                  # Next.js frontend application
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── api/          # API routes (NextAuth)
│   │   │   ├── auth/         # Authentication success/callback
│   │   │   ├── avatar/       # 3D avatar visualization
│   │   │   ├── business/     # Business dashboard
│   │   │   ├── dashboard/    # User profile dashboard
│   │   │   ├── fashion-hub/  # Fashion catalog
│   │   │   ├── journey/      # 7-step onboarding journey
│   │   │   ├── partner/      # Partner OAuth flow
│   │   │   ├── scan/         # Body scan page
│   │   │   ├── sign-in/      # Sign-in page
│   │   │   ├── try-on/       # Virtual try-on
│   │   │   ├── layout.tsx    # Root layout
│   │   │   └── page.tsx      # Landing page
│   │   ├── components/       # Reusable React components
│   │   │   ├── auth/         # Auth-related components
│   │   │   ├── avatar/       # 3D avatar components
│   │   │   ├── business/     # Business UI components
│   │   │   ├── fashion/      # Fashion components
│   │   │   ├── Hero.tsx      # Landing hero section
│   │   │   └── ThemeProvider.tsx  # Theme context
│   │   ├── lib/              # Utility libraries
│   │   │   ├── api.ts        # Backend API client
│   │   │   ├── auth.ts       # Client-side auth utilities
│   │   │   ├── avatar-utils.ts     # Avatar helper functions
│   │   │   ├── journey.ts    # Journey stage definitions
│   │   │   └── product-catalog.ts  # Product data
│   │   ├── types/            # TypeScript type definitions
│   │   └── styles/           # Global styles
│   ├── public/               # Static assets
│   │   ├── icon.svg
│   │   ├── manifest.json     # PWA manifest
│   │   ├── sw.js             # Service worker
│   │   └── fitid-logo.png
│   ├── .env.local            # Frontend environment
│   ├── next.config.js        # Next.js configuration
│   ├── package.json          # Node.js dependencies
│   └── tsconfig.json         # TypeScript configuration
│
├── docs/                     # Documentation
│   ├── FITID_MASTER_BUILD_PROMPT.md  # Original build specification
│   ├── PROJECT_STRUCTURE.md          # This file
│   └── MATHEMATICS.md                # Mathematical foundations
│
├── docker-compose.yml        # Docker orchestration
├── README.md                 # Project overview
└── .gitignore
```

---

## Architecture Deep Dive

### Backend Architecture (FastAPI)

#### 1. **API Layer** (`app/api/`)

The API layer handles HTTP requests and responses. It follows a clean separation:

- **Router** (`router.py`): Aggregates all route modules under `/api/v1`
- **Dependencies** (`deps.py`): Injectable dependencies for authentication and database sessions
- **Routes**: Each domain has its own route file

**Authentication Flow**:
```
User → Google Sign-In → Frontend → POST /auth/google → Backend
                                    ↓
                              Verify Google token
                                    ↓
                              Issue FitID JWT
                                    ↓
                              Return to Frontend → Store in session
```

#### 2. **Database Layer** (`app/db/`)

**Models** (`models.py`):
- `FitProfile`: Core user profile with body measurements, allergies, preferences
- `PartnerConsent`: Tracks which partners can access what data
- `OAuthPendingLogin`: Temporary state during OAuth flow
- `OAuthClient`: Registered third-party applications
- `OAuthAuthCode`: Authorization codes for token exchange

**Schemas** (`schemas.py`):
- Pydantic models for request validation and response serialization
- Separates API contract from database models

**Session Management** (`session.py`):
- SQLAlchemy engine configuration
- Connection retry logic for production databases
- Automatic table creation on startup

#### 3. **Services Layer** (`app/services/`)

Contains pure business logic, independent of HTTP:

- **`scan.py`**: Computer vision processing for body measurements
  - Image decoding and preprocessing
  - Silhouette detection using OpenCV
  - Measurement extraction from front/side views
  - Parametric 3D avatar model generation

- **`recommendation.py`**: Product scoring and ranking
  - Size recommendation based on waist circumference
  - Material allergy checking
  - Fit preference matching
  - Composite scoring algorithm

#### 4. **Core** (`app/core/`)

- **`config.py`**: Pydantic-settings based configuration
  - Environment variable loading
  - Default values for development
  - Production overrides via `.env`

- **`security.py`**: JWT creation and verification
  - Token encoding with user email and expiration
  - Token decoding with error handling

### Frontend Architecture (Next.js)

#### 1. **App Router** (`src/app/`)

Next.js 13+ App Router structure:

| Route | Purpose |
|-------|---------|
| `/` | Landing page with sign-in |
| `/journey` | 7-step guided onboarding |
| `/dashboard` | User profile and recommendations |
| `/scan` | Body scan interface |
| `/avatar` | 3D avatar visualization |
| `/fashion-hub` | Fashion catalog |
| `/try-on` | Virtual try-on experience |
| `/partner/*` | OAuth partner flow |
| `/business` | Business insights dashboard |

#### 2. **Component Architecture**

Components are organized by domain:

```
components/
├── auth/           # Sign-in buttons, session handling
├── avatar/         # 3D avatar canvas, parametric model rendering
├── business/       # Charts, KPI cards
├── fashion/        # Product cards, recommendation lists
├── Hero.tsx        # Landing page hero
└── ThemeProvider.tsx # Dark/light mode context
```

#### 3. **API Client** (`src/lib/api.ts`)

Centralized backend communication:

- **`exchangeGoogleToken`**: Exchanges Google ID token for FitID JWT
- **`runScan` / `runLiveScan`**: Body scan submission
- **`fetchProfile`**: Retrieve user profile
- **`getRecommendations`**: Get product recommendations
- **`savePartnerConsent`**: Store data sharing consent
- **`issuePartnerToken`**: Generate partner access tokens
- **`fetchBusinessInsights`**: Analytics for business accounts

---

## Data Flow

### 1. User Registration & Authentication

```
1. User clicks "Sign in with Google"
2. Google OAuth popup → returns ID token
3. Frontend POST /auth/google with token
4. Backend verifies token with Google
5. Backend creates/updates FitProfile in database
6. Backend issues FitID JWT (7-day expiry)
7. Frontend stores JWT in session
8. User redirected to dashboard or journey
```

### 2. Body Scan Flow

```
1. User enters height and weight
2. Camera captures front view image
3. Camera captures side view image
4. Images validated (silhouette detection)
5. POST /scan/live/{email} with images
6. Backend processes images:
   - Decode JPEG/PNG
   - Detect body silhouette
   - Calculate pixel-to-cm scale
   - Extract measurements at key points
   - Generate parametric avatar model
7. Measurements stored in FitProfile
8. Frontend displays 3D avatar preview
```

### 3. Recommendation Flow

```
1. User views dashboard or fashion hub
2. Frontend requests recommendations:
   POST /recommend/{email} with product candidates
3. Backend loads user profile from database
4. For each product:
   - Determine recommended size from waist measurement
   - Check for material allergies
   - Apply fit preference bonuses
   - Calculate composite score (0-100)
5. Sort by score descending
6. Return ranked recommendations
7. Frontend displays with reasons and fit labels
```

### 4. Partner Integration Flow

```
1. Partner site initiates "Sign in with FitID"
2. Redirect to /partner/authorize with client_id, redirect_uri, state
3. User authenticates (if not already)
4. User reviews and approves data sharing
5. POST /integration/consent to store approval
6. Backend issues authorization code
7. Redirect back to partner with code
8. Partner exchanges code for access token
9. Partner uses token to fetch approved profile data
```

---

## Key Features Explained

### 7-Stage User Journey (`/journey`)

The guided onboarding experience:

1. **Sign-In**: Authentication via Google
2. **Body Scan**: 60-second capture with front/side images
3. **Sensitivity**: Allergies and material preferences
4. **Profile**: Generated digital identity card
5. **Partner Integration**: OAuth consent flow
6. **Virtual Try-On**: 3D avatar visualization
7. **Recommendations**: Personalized product feed

### 3D Avatar Generation

The avatar system creates a parametric 3D model:

- **Model Type**: `parametric-v1`
- **Scale Factors**: Derived from actual measurements
  - Shoulders: `shoulder_width_cm / 44.0` (normalized to reference)
  - Torso: `torso_length_cm / 55.0`
  - Hips: `hip_circumference / (2π * 38.0)`
- **Rendering**: Three.js-based canvas component

### Business Insights (`/business`)

For business accounts, provides:

- **KPIs**: Profile counts, scan rates, consent opt-ins
- **Demographics**: Gender split, size distribution
- **Trends**: Weekly activity patterns
- **AI Recommendations**: Actionable business insights

---

## Security Model

### Authentication

- **Google OAuth**: Server-side ID token verification
- **FitID JWT**: Custom tokens with 7-day expiration
- **Password Auth**: Bcrypt-hashed passwords for non-Google users

### Data Protection

- **Consent-Based Sharing**: Explicit approval required for each partner
- **Field-Level Permissions**: Users choose which data to share
- **CORS**: Origin restrictions via environment config
- **HTTPS**: Required for production deployments

### OAuth2 Implementation

Full OAuth2 flow for partner integrations:

- **Authorization Endpoint**: `/partner/authorize`
- **Token Endpoint**: `/partner/token`
- **Scopes**: Fine-grained data access controls
- **State Parameter**: CSRF protection

---

## Deployment Architecture

### Docker Configuration

```yaml
# docker-compose.yml
- Frontend: Node.js container (port 3000)
- Backend: Python container (port 8000)
- Database: PostgreSQL container (port 5432) - production only
```

### Environment Configuration

**Backend** (`.env`):
```
DATABASE_URL=postgresql://... | sqlite:///./fitid.db
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=google-oauth-client-id
ALLOWED_ORIGINS=http://localhost:3000
```

**Frontend** (`.env.local`):
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=nextauth-secret
GOOGLE_CLIENT_ID=google-oauth-client-id
GOOGLE_CLIENT_SECRET=google-oauth-secret
NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1
```

### Health Checks

- **Liveness**: `GET /health` - returns {"status": "ok"}
- **Readiness**: `GET /ready` - checks database connectivity

---

## Extension Points

The architecture is designed for extensibility:

1. **New Scan Methods**: Add to `services/scan.py`
2. **New Recommendation Algorithms**: Extend `services/recommendation.py`
3. **New Partner Integrations**: Register in `oauth_clients` table
4. **New Data Fields**: Add to `FitProfile` model and schemas
5. **New Pages**: Add to `app/` directory following Next.js conventions

---

## API Reference

### Authentication
- `POST /api/v1/auth/google` - Google OAuth exchange
- `POST /api/v1/auth/register` - Password registration
- `POST /api/v1/auth/login` - Password login

### Profile
- `GET /api/v1/profile/{email}` - Retrieve profile
- `PUT /api/v1/profile/{email}/sensitivity` - Update preferences
- `DELETE /api/v1/profile/{email}` - Delete profile

### Scan
- `POST /api/v1/scan/{email}` - Quick scan (manual measurements)
- `POST /api/v1/scan/live/{email}` - Live scan (image processing)

### Recommendations
- `POST /api/v1/recommend/{email}` - Rank candidate products
- `GET /api/v1/recommend/personalized/{email}` - Full catalog ranking

### Integration
- `POST /api/v1/integration/consent` - Store partner consent
- `POST /api/v1/integration/token` - Issue partner token

### Business
- `GET /api/v1/business/insights` - Analytics dashboard data

### OAuth
- `GET /partner/authorize` - OAuth authorization endpoint
- `POST /partner/token` - OAuth token exchange

---

## Next Steps & Roadmap

See `README.md` for post-MVP features:

- Camera-based guided scan pipeline (MediaPipe/OpenCV live capture)
- 3D avatar generation and virtual try-on rendering
- Production OAuth provider support for partner stores
- Recommendation model evolution from rules to ML scoring
- Full consent center and profile deletion UX
