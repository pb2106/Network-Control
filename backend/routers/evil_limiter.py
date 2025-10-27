from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import subprocess
import os
import platform
from datetime import datetime

router = APIRouter()

# Configuration for Evil Limiter executable path
EVIL_LIMITER_PATH = os.getenv("EVIL_LIMITER_PATH", "./evil-limiter.exe")
IS_WINDOWS = platform.system() == "Windows"

# In-memory storage for active limits (in production, use database)
active_limits = {}

class LimitRequest(BaseModel):
    target_ip: str
    target_mac: str
    download_limit: Optional[int] = None  # in KB/s
    upload_limit: Optional[int] = None    # in KB/s
    hostname: Optional[str] = None

class LimitResponse(BaseModel):
    id: str
    target_ip: str
    target_mac: str
    hostname: Optional[str]
    download_limit: Optional[int]
    upload_limit: Optional[int]
    status: str
    created_at: str

class NetworkScanResult(BaseModel):
    ip: str
    mac: str
    hostname: Optional[str]

def run_evil_limiter_command(args: List[str]) -> dict:
    """Execute Evil Limiter command and return result"""
    try:
        if not os.path.exists(EVIL_LIMITER_PATH):
            raise FileNotFoundError(f"Evil Limiter executable not found at {EVIL_LIMITER_PATH}")
        
        # Build command
        if IS_WINDOWS:
            cmd = [EVIL_LIMITER_PATH] + args
        else:
            cmd = ["sudo", EVIL_LIMITER_PATH] + args
        
        # Execute command
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Command timeout")
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute command: {str(e)}")

@router.get("/status")
async def get_evil_limiter_status():
    """Check if Evil Limiter is available and get status"""
    try:
        if not os.path.exists(EVIL_LIMITER_PATH):
            return {
                "available": False,
                "error": "Evil Limiter executable not found",
                "path": EVIL_LIMITER_PATH
            }
        
        return {
            "available": True,
            "path": EVIL_LIMITER_PATH,
            "platform": platform.system(),
            "active_limits": len(active_limits)
        }
    except Exception as e:
        return {
            "available": False,
            "error": str(e)
        }

@router.post("/scan")
async def scan_network():
    """Scan network for available devices (using Evil Limiter's scan feature)"""
    try:
        result = run_evil_limiter_command(["--scan"])
        
        if not result["success"]:
            raise HTTPException(
                status_code=500, 
                detail=f"Scan failed: {result['stderr']}"
            )
        
        # Parse scan results (format depends on Evil Limiter output)
        # This is a simplified parser - adjust based on actual output format
        devices = []
        lines = result["stdout"].split("\n")
        for line in lines:
            if line.strip() and ":" in line:
                parts = line.split()
                if len(parts) >= 2:
                    devices.append({
                        "ip": parts[0],
                        "mac": parts[1] if len(parts) > 1 else "Unknown",
                        "hostname": parts[2] if len(parts) > 2 else None
                    })
        
        return {
            "success": True,
            "devices": devices,
            "count": len(devices)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/limit")
async def apply_bandwidth_limit(request: LimitRequest):
    """Apply bandwidth limit to a specific device"""
    try:
        limit_id = f"{request.target_ip}_{request.target_mac}"
        
        # Build Evil Limiter command
        args = [
            "--target", request.target_ip,
            "--mac", request.target_mac
        ]
        
        if request.download_limit:
            args.extend(["--download", str(request.download_limit)])
        
        if request.upload_limit:
            args.extend(["--upload", str(request.upload_limit)])
        
        # Execute command
        result = run_evil_limiter_command(args)
        
        if not result["success"]:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to apply limit: {result['stderr']}"
            )
        
        # Store active limit
        active_limits[limit_id] = {
            "id": limit_id,
            "target_ip": request.target_ip,
            "target_mac": request.target_mac,
            "hostname": request.hostname,
            "download_limit": request.download_limit,
            "upload_limit": request.upload_limit,
            "status": "active",
            "created_at": datetime.now().isoformat()
        }
        
        return active_limits[limit_id]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/limit/{target_ip}")
async def remove_bandwidth_limit(target_ip: str):
    """Remove bandwidth limit from a device"""
    try:
        # Find limit by IP
        limit_id = None
        for lid, limit in active_limits.items():
            if limit["target_ip"] == target_ip:
                limit_id = lid
                break
        
        if not limit_id:
            raise HTTPException(status_code=404, detail="Limit not found")
        
        limit = active_limits[limit_id]
        
        # Build command to remove limit
        args = [
            "--remove",
            "--target", limit["target_ip"],
            "--mac", limit["target_mac"]
        ]
        
        result = run_evil_limiter_command(args)
        
        if not result["success"]:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to remove limit: {result['stderr']}"
            )
        
        # Remove from active limits
        del active_limits[limit_id]
        
        return {
            "success": True,
            "message": f"Bandwidth limit removed for {target_ip}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/limits")
async def get_active_limits():
    """Get all active bandwidth limits"""
    return {
        "limits": list(active_limits.values()),
        "count": len(active_limits)
    }

@router.get("/limits/{target_ip}")
async def get_limit_by_ip(target_ip: str):
    """Get bandwidth limit for a specific device"""
    for limit in active_limits.values():
        if limit["target_ip"] == target_ip:
            return limit
    
    raise HTTPException(status_code=404, detail="Limit not found")

@router.post("/limit/{target_ip}/update")
async def update_bandwidth_limit(target_ip: str, request: LimitRequest):
    """Update bandwidth limit for a device"""
    try:
        # Remove existing limit
        await remove_bandwidth_limit(target_ip)
        
        # Apply new limit
        return await apply_bandwidth_limit(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/block/{target_ip}")
async def block_device(target_ip: str):
    """Block all bandwidth for a device (set limits to 0)"""
    try:
        # Find device info
        limit = None
        for l in active_limits.values():
            if l["target_ip"] == target_ip:
                limit = l
                break
        
        if not limit:
            raise HTTPException(
                status_code=404, 
                detail="Device not found in active limits"
            )
        
        # Apply zero bandwidth limit
        request = LimitRequest(
            target_ip=target_ip,
            target_mac=limit["target_mac"],
            download_limit=0,
            upload_limit=0,
            hostname=limit.get("hostname")
        )
        
        return await apply_bandwidth_limit(request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/clear-all")
async def clear_all_limits():
    """Remove all active bandwidth limits"""
    try:
        errors = []
        removed_count = 0
        
        for limit_id, limit in list(active_limits.items()):
            try:
                args = [
                    "--remove",
                    "--target", limit["target_ip"],
                    "--mac", limit["target_mac"]
                ]
                
                result = run_evil_limiter_command(args)
                
                if result["success"]:
                    del active_limits[limit_id]
                    removed_count += 1
                else:
                    errors.append(f"{limit['target_ip']}: {result['stderr']}")
            except Exception as e:
                errors.append(f"{limit['target_ip']}: {str(e)}")
        
        return {
            "success": True,
            "removed_count": removed_count,
            "errors": errors if errors else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))