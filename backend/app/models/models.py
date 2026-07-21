import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

# A Tabela de Usuários do SaaS (NOVO)
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True) # Vai guardar o ID que vem do Firebase
    email = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    plan_tier = Column(String, default="free")
    terms_accepted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    allow_data_training = Column(Boolean, default=False) # A sua ideia de Anonimização
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    chunk_duration_minutes = Column(Integer, default=2)
    api_keys = relationship("APIKey", back_populates="settings", cascade="all, delete-orphan")

class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    settings_id = Column(Integer, ForeignKey("settings.id"))
    user_id = Column(String, index=True) # NOVO: A chave agora tem dono
    provider = Column(String, index=True)
    api_key = Column(String)
    priority = Column(Integer, default=1)
    primary_model = Column(String, nullable=True)
    cascade_list = Column(Text, default="[]")
    
    settings = relationship("Settings", back_populates="api_keys")

class Meeting(Base):
    __tablename__ = "meetings"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String, index=True) # NOVO: A reunião agora tem dono
    title = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String, default="processing")
    template_used = Column(String, default="padrao")
    
    full_transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    tasks = Column(Text, nullable=True)
    
    progress = Column(Integer, default=0)
    step_logs = Column(Text, default="[]")
