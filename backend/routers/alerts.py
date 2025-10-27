from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime

from db import get_db, Alert
from auth import get_current_user, User

router = APIRouter()

class AlertResponse(BaseModel):
    id: int
    message: str
    level: str
    timestamp: datetime
    read: bool
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[AlertResponse])
async def get_alerts(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Alert)
    
    if unread_only:
        query = query.filter(Alert.read == False)
    
    alerts = query.order_by(Alert.timestamp.desc()).offset(skip).limit(limit).all()
    return alerts

@router.patch("/{alert_id}/read")
async def mark_alert_read(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.read = True
    db.commit()
    
    return {"success": True}

@router.post("/mark-all-read")
async def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Alert).filter(Alert.read == False).update({"read": True})
    db.commit()
    
    return {"success": True}

@router.delete("/{alert_id}")
async def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    db.delete(alert)
    db.commit()
    
    return {"success": True}

@router.get("/stats")
async def get_alert_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total = db.query(Alert).count()
    unread = db.query(Alert).filter(Alert.read == False).count()
    info = db.query(Alert).filter(Alert.level == "info").count()
    warning = db.query(Alert).filter(Alert.level == "warning").count()
    danger = db.query(Alert).filter(Alert.level == "danger").count()
    
    return {
        "total": total,
        "unread": unread,
        "by_level": {
            "info": info,
            "warning": warning,
            "danger": danger
        }
    }