from fastapi import APIRouter

from app.api.routes import auth, business, integration, oauth_applications, oauth_partner, profile, recommend, scan

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(business.router)
api_router.include_router(oauth_applications.router)
api_router.include_router(scan.router)
api_router.include_router(profile.router)
api_router.include_router(recommend.router)
api_router.include_router(integration.router)
api_router.include_router(oauth_partner.router)
