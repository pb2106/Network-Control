from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

# Routers
from routers import devices, users, alerts, firewall, snort, evil_limiter
import auth
from sync import ConnectionManager
from db import init_db

manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    yield
    # Shutdown
    pass

# FastAPI App
app = FastAPI(
    title="Network Dashboard API",
    description="Backend API for Network Dashboard — includes device, user, firewall, alert, Snort IDS/IPS, and Evil Limiter bandwidth control.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(devices.router, prefix="/api/devices", tags=["devices"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(firewall.router, prefix="/api/firewall", tags=["firewall"])
app.include_router(snort.router, prefix="/api/snort", tags=["snort"])
app.include_router(evil_limiter.router, prefix="/api/network-control", tags=["network-control"])

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Network Dashboard API is running"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "api_version": "1.0.0",
        "features": {
            "devices": True,
            "users": True,
            "alerts": True,
            "firewall": True,
            "snort": True,
            "network_control": True
        }
    }

# WebSocket for real-time sync
@app.websocket("/ws/sync")
async def websocket_sync(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Entry point
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)