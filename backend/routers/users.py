from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from db import get_db, User, Alert, Session as UserSession
from auth import get_current_user, get_password_hash
import sys
sys.path.append('..')
from sync import ConnectionManager

router = APIRouter()
manager = ConnectionManager()

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "admin"

class UserUpdate(BaseModel):
    password: Optional[str] = None
    role: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    last_login: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    id: int
    user_id: int
    device_id: Optional[int]
    active: bool
    started_at: datetime
    ended_at: Optional[datetime]
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[UserResponse])
async def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    users = db.query(User).all()
    return users

@router.post("/", response_model=UserResponse)
async def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if username exists
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    new_user = User(
        username=user.username,
        hashed_password=get_password_hash(user.password),
        role=user.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Broadcast new user
    await manager.broadcast({
        "type": "user_created",
        "username": new_user.username,
        "role": new_user.role,
        "created_by": current_user.username
    })
    
    return new_user

@router.patch("/{user_id}")
async def update_user(
    user_id: int,
    update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if update.password:
        user.hashed_password = get_password_hash(update.password)
    if update.role:
        user.role = update.role
    
    db.commit()
    db.refresh(user)
    
    return {"success": True, "user": UserResponse.from_orm(user)}

@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    username = user.username
    db.delete(user)
    db.commit()
    
    await manager.broadcast({
        "type": "user_deleted",
        "username": username,
        "deleted_by": current_user.username
    })
    
    return {"success": True, "message": "User deleted"}

@router.get("/sessions", response_model=List[SessionResponse])
async def get_active_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(UserSession).filter(UserSession.active == True).all()
    return sessions

@router.post("/kick/{user_id}")
async def kick_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # End all active sessions for the user
    sessions = db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.active == True
    ).all()
    
    for session in sessions:
        session.active = False
        session.ended_at = datetime.utcnow()
    
    db.commit()
    
    # Create alert
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        alert = Alert(
            message=f"User {user.username} was kicked by {current_user.username}",
            level="warning",
            timestamp=datetime.utcnow()
        )
        db.add(alert)
        db.commit()
        
        await manager.broadcast({
            "type": "user_kicked",
            "user_id": user_id,
            "username": user.username,
            "kicked_by": current_user.username
        })
    
    return {"success": True, "sessions_ended": len(sessions)}