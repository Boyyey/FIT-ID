# FitID Master Build Prompt

Build a production-grade web application called **FitID** that works both as:
- a website
- a mobile-like web app (PWA behavior similar to UAE PASS usage pattern)

## Core Product Goal
Create a universal digital fit identity that users can carry across fashion platforms. The user journey must be linear, modern, and clear.

## Required Tech Stack
- **Frontend**: Next.js (React + TypeScript), responsive mobile-first UI
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL
- **Auth**: Google OAuth + FitID JWT session
- **AI/ML/CV**: Python ecosystem for scan and recommendations

## Mandatory 7-Stage User Journey
1. **Sign-In**
   - High-quality modern screen
   - "Continue with Google"
   - "Sign in with FitID" branding option (with FitID logo)
2. **60-Second Body Scan**
   - Guided phase: front, side, posture
   - Capture body metrics, proportions, skin tone hint
3. **Sensitivity Questions**
   - Allergies/material sensitivity/preferences
4. **FitID Profile Generation**
   - Build digital profile card with measurements and identity
5. **Partner Site Integration**
   - Simulate "Sign in with FitID" on e-commerce partner pages
   - Consent-gated data sharing
6. **Virtual Try-On**
   - MVP visual experience (2D/3D approximation acceptable)
7. **Smart Recommendations**
   - Rank products by fit score, sensitivities, preferences

## Product and UX Requirements
- UI must look polished, premium, and modern
- App-like interaction on mobile, tablet, and desktop
- Clean spacing, subtle shadows, modern typography, soft transitions
- Dashboard + profile card should feel like a digital passport
- No dead-end pages; every step should move user forward

## Security and Privacy Requirements
- Verify Google ID token server-side
- Use JWT for FitID session
- Require explicit consent before partner data sharing
- Allow profile edit and profile deletion
- Store sensitive profile data securely

## Integration Requirements
- Backend APIs must include:
  - `/auth/google`
  - `/scan/{email}`
  - `/profile/{email}`
  - `/profile/{email}/sensitivity`
  - `/integration/consent`
  - `/integration/token`
  - `/recommend/{email}`
- Frontend should call these APIs in real journey sequence

## Delivery Criteria
- App runs locally and end-to-end flow works
- 7 stages are implemented as a coherent journey
- Google auth + backend token exchange is functional
- Recommendation feed is populated from backend
- Code is modular and production-extendable
