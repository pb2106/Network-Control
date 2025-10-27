from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from db import get_db, Base
import subprocess
import os
import re

router = APIRouter()

# ==================== Database Models ====================

class SnortRule(Base):
    __tablename__ = "snort_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    sid = Column(Integer, unique=True, index=True)
    action = Column(String(20))  # alert, log, pass, drop, reject
    protocol = Column(String(10))  # tcp, udp, icmp, ip
    source_ip = Column(String(100))
    source_port = Column(String(20))
    direction = Column(String(5))  # ->, <>, <-
    dest_ip = Column(String(100))
    dest_port = Column(String(20))
    msg = Column(String(500))
    content = Column(Text, nullable=True)
    classtype = Column(String(100), nullable=True)
    priority = Column(Integer, default=3)
    reference = Column(String(500), nullable=True)
    enabled = Column(Boolean, default=True)
    custom = Column(Boolean, default=False)
    raw_rule = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SnortAlert(Base):
    __tablename__ = "snort_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    sid = Column(Integer, index=True)
    msg = Column(String(500))
    classification = Column(String(200))
    priority = Column(Integer)
    protocol = Column(String(10))
    source_ip = Column(String(50))
    source_port = Column(Integer, nullable=True)
    dest_ip = Column(String(50))
    dest_port = Column(Integer, nullable=True)
    severity = Column(String(20))  # low, medium, high, critical
    raw_alert = Column(Text)
    acknowledged = Column(Boolean, default=False)


class SnortConfig(Base):
    __tablename__ = "snort_config"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True)
    value = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ==================== Pydantic Schemas ====================

class RuleBase(BaseModel):
    action: Literal["alert", "log", "pass", "drop", "reject"]
    protocol: Literal["tcp", "udp", "icmp", "ip"]
    source_ip: str
    source_port: str
    direction: Literal["->", "<>", "<-"] = "->"
    dest_ip: str
    dest_port: str
    msg: str
    content: Optional[str] = None
    classtype: Optional[str] = None
    priority: int = Field(default=3, ge=1, le=4)
    reference: Optional[str] = None
    enabled: bool = True


class RuleCreate(RuleBase):
    sid: int


class RuleUpdate(BaseModel):
    action: Optional[str] = None
    enabled: Optional[bool] = None
    priority: Optional[int] = None
    msg: Optional[str] = None


class RuleResponse(RuleBase):
    id: int
    sid: int
    custom: bool
    raw_rule: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AlertResponse(BaseModel):
    id: int
    timestamp: datetime
    sid: int
    msg: str
    classification: str
    priority: int
    protocol: str
    source_ip: str
    source_port: Optional[int]
    dest_ip: str
    dest_port: Optional[int]
    severity: str
    acknowledged: bool
    
    class Config:
        from_attributes = True


class SnortStats(BaseModel):
    total_rules: int
    enabled_rules: int
    custom_rules: int
    total_alerts: int
    unacknowledged_alerts: int
    alerts_today: int
    critical_alerts: int
    high_alerts: int
    medium_alerts: int
    low_alerts: int


class SnortStatus(BaseModel):
    running: bool
    mode: str  # ids or ips
    interface: Optional[str]
    version: Optional[str]
    uptime: Optional[str]


# ==================== Helper Functions ====================

def generate_rule_string(rule: RuleBase, sid: int) -> str:
    """Generate Snort rule string from components"""
    options = [f'msg:"{rule.msg}"']
    
    if rule.content:
        options.append(f'content:"{rule.content}"')
    if rule.classtype:
        options.append(f'classtype:{rule.classtype}')
    
    options.append(f'sid:{sid}')
    options.append(f'priority:{rule.priority}')
    
    if rule.reference:
        options.append(f'reference:{rule.reference}')
    
    options.append('rev:1')
    
    rule_str = f"{rule.action} {rule.protocol} {rule.source_ip} {rule.source_port} {rule.direction} {rule.dest_ip} {rule.dest_port} ({'; '.join(options)};)"
    return rule_str


def parse_rule_string(rule_str: str) -> dict:
    """Parse a Snort rule string into components"""
    try:
        # Basic regex to extract rule components
        pattern = r'(\w+)\s+(\w+)\s+([\d\.\/any]+)\s+([\d:any]+)\s+(<?->?)\s+([\d\.\/any]+)\s+([\d:any]+)\s+\((.*)\)'
        match = re.match(pattern, rule_str.strip())
        
        if not match:
            raise ValueError("Invalid rule format")
        
        action, protocol, src_ip, src_port, direction, dst_ip, dst_port, options_str = match.groups()
        
        # Parse options
        options = {}
        for opt in options_str.split(';'):
            opt = opt.strip()
            if ':' in opt:
                key, value = opt.split(':', 1)
                options[key.strip()] = value.strip().strip('"')
        
        return {
            "action": action,
            "protocol": protocol,
            "source_ip": src_ip,
            "source_port": src_port,
            "direction": direction,
            "dest_ip": dst_ip,
            "dest_port": dst_port,
            "msg": options.get("msg", ""),
            "sid": int(options.get("sid", 0)),
            "priority": int(options.get("priority", 3)),
            "classtype": options.get("classtype"),
            "content": options.get("content"),
            "reference": options.get("reference"),
        }
    except Exception as e:
        raise ValueError(f"Failed to parse rule: {str(e)}")


def check_snort_status() -> dict:
    """Check if Snort is running"""
    try:
        result = subprocess.run(
            ["pgrep", "-f", "snort"],
            capture_output=True,
            text=True
        )
        running = result.returncode == 0
        
        version = None
        try:
            ver_result = subprocess.run(
                ["snort", "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if ver_result.returncode == 0:
                version = ver_result.stdout.split('\n')[0]
        except:
            pass
        
        return {
            "running": running,
            "mode": "ids",  # Would need to check actual config
            "interface": "eth0",  # Would need to check actual config
            "version": version,
            "uptime": None
        }
    except Exception as e:
        return {
            "running": False,
            "mode": "unknown",
            "interface": None,
            "version": None,
            "uptime": None
        }


# ==================== API Endpoints ====================

@router.get("/status", response_model=SnortStatus)
async def get_snort_status():
    """Get Snort service status"""
    status = check_snort_status()
    return status


@router.get("/stats", response_model=SnortStats)
async def get_snort_stats(db: Session = Depends(get_db)):
    """Get Snort statistics"""
    from sqlalchemy import func
    from datetime import date
    
    total_rules = db.query(SnortRule).count()
    enabled_rules = db.query(SnortRule).filter(SnortRule.enabled == True).count()
    custom_rules = db.query(SnortRule).filter(SnortRule.custom == True).count()
    
    total_alerts = db.query(SnortAlert).count()
    unack_alerts = db.query(SnortAlert).filter(SnortAlert.acknowledged == False).count()
    
    today = datetime.combine(date.today(), datetime.min.time())
    alerts_today = db.query(SnortAlert).filter(SnortAlert.timestamp >= today).count()
    
    critical_alerts = db.query(SnortAlert).filter(SnortAlert.severity == "critical").count()
    high_alerts = db.query(SnortAlert).filter(SnortAlert.severity == "high").count()
    medium_alerts = db.query(SnortAlert).filter(SnortAlert.severity == "medium").count()
    low_alerts = db.query(SnortAlert).filter(SnortAlert.severity == "low").count()
    
    return SnortStats(
        total_rules=total_rules,
        enabled_rules=enabled_rules,
        custom_rules=custom_rules,
        total_alerts=total_alerts,
        unacknowledged_alerts=unack_alerts,
        alerts_today=alerts_today,
        critical_alerts=critical_alerts,
        high_alerts=high_alerts,
        medium_alerts=medium_alerts,
        low_alerts=low_alerts
    )


# ==================== Rules Management ====================

@router.get("/rules", response_model=List[RuleResponse])
async def get_rules(
    enabled: Optional[bool] = None,
    custom: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get Snort rules with optional filtering"""
    query = db.query(SnortRule)
    
    if enabled is not None:
        query = query.filter(SnortRule.enabled == enabled)
    if custom is not None:
        query = query.filter(SnortRule.custom == custom)
    
    rules = query.offset(skip).limit(limit).all()
    return rules


@router.get("/rules/{rule_id}", response_model=RuleResponse)
async def get_rule(rule_id: int, db: Session = Depends(get_db)):
    """Get a specific rule by ID"""
    rule = db.query(SnortRule).filter(SnortRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.post("/rules", response_model=RuleResponse)
async def create_rule(rule: RuleCreate, db: Session = Depends(get_db)):
    """Create a new Snort rule"""
    # Check if SID already exists
    existing = db.query(SnortRule).filter(SnortRule.sid == rule.sid).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Rule with SID {rule.sid} already exists")
    
    # Generate rule string
    raw_rule = generate_rule_string(rule, rule.sid)
    
    db_rule = SnortRule(
        sid=rule.sid,
        action=rule.action,
        protocol=rule.protocol,
        source_ip=rule.source_ip,
        source_port=rule.source_port,
        direction=rule.direction,
        dest_ip=rule.dest_ip,
        dest_port=rule.dest_port,
        msg=rule.msg,
        content=rule.content,
        classtype=rule.classtype,
        priority=rule.priority,
        reference=rule.reference,
        enabled=rule.enabled,
        custom=True,
        raw_rule=raw_rule
    )
    
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.patch("/rules/{rule_id}", response_model=RuleResponse)
async def update_rule(rule_id: int, rule_update: RuleUpdate, db: Session = Depends(get_db)):
    """Update an existing rule"""
    db_rule = db.query(SnortRule).filter(SnortRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    update_data = rule_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_rule, field, value)
    
    db_rule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete a rule"""
    db_rule = db.query(SnortRule).filter(SnortRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    if not db_rule.custom:
        raise HTTPException(status_code=400, detail="Cannot delete built-in rules")
    
    db.delete(db_rule)
    db.commit()
    return {"message": "Rule deleted successfully"}


@router.post("/rules/import")
async def import_rules(rules_text: str, db: Session = Depends(get_db)):
    """Import rules from text (bulk import)"""
    imported = 0
    errors = []
    
    for line in rules_text.split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        
        try:
            parsed = parse_rule_string(line)
            
            # Check if SID exists
            existing = db.query(SnortRule).filter(SnortRule.sid == parsed['sid']).first()
            if existing:
                continue
            
            db_rule = SnortRule(
                sid=parsed['sid'],
                action=parsed['action'],
                protocol=parsed['protocol'],
                source_ip=parsed['source_ip'],
                source_port=parsed['source_port'],
                direction=parsed['direction'],
                dest_ip=parsed['dest_ip'],
                dest_port=parsed['dest_port'],
                msg=parsed['msg'],
                content=parsed.get('content'),
                classtype=parsed.get('classtype'),
                priority=parsed['priority'],
                reference=parsed.get('reference'),
                enabled=True,
                custom=False,
                raw_rule=line
            )
            db.add(db_rule)
            imported += 1
        except Exception as e:
            errors.append(f"Line: {line[:50]}... Error: {str(e)}")
    
    db.commit()
    return {
        "imported": imported,
        "errors": errors
    }


# ==================== Alerts Management ====================

@router.get("/alerts", response_model=List[AlertResponse])
async def get_alerts(
    acknowledged: Optional[bool] = None,
    severity: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get Snort alerts with optional filtering"""
    query = db.query(SnortAlert).order_by(SnortAlert.timestamp.desc())
    
    if acknowledged is not None:
        query = query.filter(SnortAlert.acknowledged == acknowledged)
    if severity:
        query = query.filter(SnortAlert.severity == severity)
    
    alerts = query.offset(skip).limit(limit).all()
    return alerts


@router.patch("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    """Acknowledge an alert"""
    alert = db.query(SnortAlert).filter(SnortAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.acknowledged = True
    db.commit()
    return {"message": "Alert acknowledged"}


@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    """Delete an alert"""
    alert = db.query(SnortAlert).filter(SnortAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    db.delete(alert)
    db.commit()
    return {"message": "Alert deleted"}


@router.post("/alerts/clear")
async def clear_alerts(acknowledged_only: bool = True, db: Session = Depends(get_db)):
    """Clear alerts (acknowledged only by default)"""
    query = db.query(SnortAlert)
    if acknowledged_only:
        query = query.filter(SnortAlert.acknowledged == True)
    
    count = query.delete()
    db.commit()
    return {"message": f"Cleared {count} alerts"}


# ==================== Control Endpoints ====================

@router.post("/control/start")
async def start_snort():
    """Start Snort service"""
    try:
        subprocess.run(["sudo", "systemctl", "start", "snort"], check=True)
        return {"message": "Snort started successfully"}
    except subprocess.CalledProcessError:
        raise HTTPException(status_code=500, detail="Failed to start Snort")


@router.post("/control/stop")
async def stop_snort():
    """Stop Snort service"""
    try:
        subprocess.run(["sudo", "systemctl", "stop", "snort"], check=True)
        return {"message": "Snort stopped successfully"}
    except subprocess.CalledProcessError:
        raise HTTPException(status_code=500, detail="Failed to stop Snort")


@router.post("/control/restart")
async def restart_snort():
    """Restart Snort service"""
    try:
        subprocess.run(["sudo", "systemctl", "restart", "snort"], check=True)
        return {"message": "Snort restarted successfully"}
    except subprocess.CalledProcessError:
        raise HTTPException(status_code=500, detail="Failed to restart Snort")


@router.post("/control/reload-rules")
async def reload_rules():
    """Reload Snort rules without restarting"""
    try:
        # Send SIGHUP to Snort to reload rules
        subprocess.run(["sudo", "pkill", "-SIGHUP", "snort"], check=True)
        return {"message": "Rules reloaded successfully"}
    except subprocess.CalledProcessError:
        raise HTTPException(status_code=500, detail="Failed to reload rules")