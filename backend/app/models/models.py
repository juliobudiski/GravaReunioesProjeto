import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    chunk_duration_minutes = Column(Integer, default=2) # US23
    
    # Relacionamento 1:N com as chaves (US22)
    api_keys = relationship("APIKey", back_populates="settings", cascade="all, delete-orphan")

class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    settings_id = Column(Integer, ForeignKey("settings.id"))
    provider = Column(String, index=True) # Ex: 'openai' ou 'gemini'
    api_key = Column(String)
    priority = Column(Integer, default=1) # Ordem de Fallback
    
    settings = relationship("Settings", back_populates="api_keys")

class Meeting(Base):
    __tablename__ = "meetings"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    title = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String, default="processing")
    template_used = Column(String, default="padrao")
    
    full_transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    tasks = Column(Text, nullable=True)
    
    # NOVAS COLUNAS (Progresso e Logs em tempo real)
    progress = Column(Integer, default=0)
    step_logs = Column(Text, default="[]")
