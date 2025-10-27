from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from db import get_db, Device, Alert
from auth import get_current_user, User
from network import scan_network, get_network_range
import sys
sys.path.append('..')
from sync import ConnectionManager

router = APIRouter()
manager = ConnectionManager()

class DeviceCreate(BaseModel):
    mac: str
    ip: str
    hostname: str
    role: Optional[str] = "Others"

class DeviceUpdate(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None

class DeviceResponse(BaseModel):
    id: int
    mac: str
    ip: str
    hostname: str
    role: str
    last_seen: datetime
    status: str
    updated_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[DeviceResponse])
async def get_devices(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    devices = db.query(Device).offset(skip).limit(limit).all()
    return devices

@router.post("/scan")
async def scan_devices(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Scan network and update device database"""
    try:
        # Perform network scan
        discovered = scan_network()
        
        new_devices = 0
        updated_devices = 0
        
        for device_data in discovered:
            existing = db.query(Device).filter(Device.mac == device_data["mac"]).first()
            
            if existing:
                # Update existing device
                existing.ip = device_data["ip"]
                existing.hostname = device_data["hostname"]
                existing.last_seen = datetime.utcnow()
                existing.updated_at = datetime.utcnow()
                updated_devices += 1
            else:
                # Create new device
                new_device = Device(
                    mac=device_data["mac"],
                    ip=device_data["ip"],
                    hostname=device_data["hostname"],
                    role="Others",
                    status="active"
                )
                db.add(new_device)
                new_devices += 1
                
                # Create alert for new device
                alert = Alert(
                    message=f"New device detected: {device_data['hostname']} ({device_data['ip']})",
                    level="info",
                    timestamp=datetime.utcnow()
                )
                db.add(alert)
        
        db.commit()
        
        # Broadcast update via WebSocket
        await manager.broadcast({
            "type": "scan_complete",
            "new_devices": new_devices,
            "updated_devices": updated_devices,
            "total": len(discovered)
        })
        
        return {
            "success": True,
            "discovered": len(discovered),
            "new_devices": new_devices,
            "updated_devices": updated_devices
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.patch("/{device_id}")
async def update_device(
    device_id: int,
    update: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if update.role is not None:
        device.role = update.role
    if update.status is not None:
        device.status = update.status
    
    device.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(device)
    
    # Broadcast update
    await manager.broadcast({
        "type": "device_updated",
        "device_id": device.id,
        "mac": device.mac,
        "role": device.role,
        "status": device.status,
        "updated_by": current_user.username
    })
    
    return {"success": True, "device": DeviceResponse.from_orm(device)}

@router.delete("/{device_id}")
async def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    db.delete(device)
    db.commit()
    
    # Broadcast deletion
    await manager.broadcast({
        "type": "device_deleted",
        "device_id": device_id,
        "deleted_by": current_user.username
    })
    
    return {"success": True, "message": "Device deleted"}