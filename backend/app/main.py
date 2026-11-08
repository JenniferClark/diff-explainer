"""Entry point: create the app, set up CORS, and mount the routers."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.fake_routes import router as fake_router
from app.routes import router

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(fake_router)  # test-only endpoints