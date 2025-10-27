from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime

from db import get_db, FirewallLog, Device, Alert
from auth import get_current_user, User
from firewall import block_ip, unblock_ip
import sys
sys.path.append('..')
from sync import ConnectionManager

router = APIRouter()
manager = ConnectionManager()

class FirewallAction(BaseModel):
    ip: str
    action: str  # block, unblock

class FirewallLogResponse(BaseModel):
    id: int
    action: str
    target_ip: str
    admin: str
    timestamp: datetime
    success: bool
    details: str
    
    class Config:
        from_attributes = True

@router.post("/action")
async def perform_firewall_action(
    action_request: FirewallAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute firewall action (block/unblock)"""
    ip = action_request.ip
    action = action_request.action
    
    result = {"success": False, "message": "Unknown action"}
    
    if action == "block":
        result = block_ip(ip)
    elif action == "unblock":
        result = unblock_ip(ip)
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    # Log the action
    log_entry = FirewallLog(
        action=action,
        target_ip=ip,
        admin=current_user.username,
        timestamp=datetime.utcnow(),
        success=result["success"],
        details=result["message"]
    )
    db.add(log_entry)
    
    # Update device status if exists
    device = db.query(Device).filter(Device.ip == ip).first()
    if device:
        if action == "block":
            device.status = "blocked"
        elif action == "unblock":
            device.status = "active"
        device.updated_at = datetime.utcnow()
    
    # Create alert
    alert_level = "info" if result["success"] else "danger"
    alert = Alert(
        message=f"Firewall {action} on {ip} by {current_user.username}: {result['message']}",
        level=alert_level,
        timestamp=datetime.utcnow()
    )
    db.add(alert)
    
    db.commit()
    
    # Broadcast update
    await manager.broadcast({
        "type": "firewall_action",
        "action": action,
        "ip": ip,
        "success": result["success"],
        "message": result["message"],
        "admin": current_user.username
    })
    
    return result

@router.post("/kick/{device_id}")
async def kick_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Kick a device by blocking its IP temporarily"""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Block the IP
    result = block_ip(device.ip)
    
    # Update device status
    device.status = "kicked"
    device.updated_at = datetime.utcnow()
    
    # Log the action
    log_entry = FirewallLog(
        action="kick",
        target_ip=device.ip,
        admin=current_user.username,
        timestamp=datetime.utcnow(),
        success=result["success"],
        details=result["message"]
    )
    db.add(log_entry)
    
    # Create alert
    alert = Alert(
        message=f"Device {device.hostname} ({device.ip}) kicked by {current_user.username}",
        level="warning",
        timestamp=datetime.utcnow()
    )
    db.add(alert)
    
    db.commit()
    
    # Broadcast
    await manager.broadcast({
        "type": "device_kicked",
        "device_id": device_id,
        "ip": device.ip,
        "hostname": device.hostname,
        "kicked_by": current_user.username
    })
    
    return {"success": result["success"], "message": result["message"]}

@router.get("/logs", response_model=List[FirewallLogResponse])
async def get_firewall_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logs = db.query(FirewallLog).order_by(
        FirewallLog.timestamp.desc()
    ).offset(skip).limit(limit).all()
    return logs

@router.get("/stats")
async def get_firewall_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_actions = db.query(FirewallLog).count()
    blocks = db.query(FirewallLog).filter(FirewallLog.action == "block").count()
    unblocks = db.query(FirewallLog).filter(FirewallLog.action == "unblock").count()
    kicks = db.query(FirewallLog).filter(FirewallLog.action == "kick").count()
    successes = db.query(FirewallLog).filter(FirewallLog.success == True).count()
    failures = db.query(FirewallLog).filter(FirewallLog.success == False).count()
    
    return {
        "total_actions": total_actions,
        "blocks": blocks,
        "unblocks": unblocks,
        "kicks": kicks,
        "success_rate": successes / total_actions if total_actions > 0 else 0,
        "successes": successes,
        "failures": failures
    }