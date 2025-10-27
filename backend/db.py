from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = "sqlite:///./network.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Device(Base):
    __tablename__ = "devices"
    id = Column(Integer, primary_key=True, index=True)
    mac = Column(String, unique=True, index=True)
    ip = Column(String)
    hostname = Column(String)
    role = Column(String, default="Others")  # Admin, Volunteer, Others
    last_seen = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="active")  # active, blocked, kicked
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="admin")  # admin, viewer
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    message = Column(Text)
    level = Column(String)  # info, warning, danger
    timestamp = Column(DateTime, default=datetime.utcnow)
    read = Column(Boolean, default=False)

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    device_id = Column(Integer)
    active = Column(Boolean, default=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

class FirewallLog(Base):
    __tablename__ = "firewall_logs"
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String)  # block, unblock, kick
    target_ip = Column(String)
    admin = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    success = Column(Boolean, default=True)
    details = Column(Text)

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Create default admin user if none exists
    db = SessionLocal()
    try:
        from auth import get_password_hash
        admin_exists = db.query(User).filter(User.username == "admin").first()
        if not admin_exists:
            default_admin = User(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                last_login=datetime.utcnow()
            )
            db.add(default_admin)
            db.commit()
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()