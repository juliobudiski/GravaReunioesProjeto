import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Carrega as variáveis do .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Engine de conexão com o PostgreSQL
engine = create_engine(DATABASE_URL, echo=False)

# Sessão do banco
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para os nossos modelos (tabelas)
Base = declarative_base()

# Função para injetar o banco nas rotas
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
