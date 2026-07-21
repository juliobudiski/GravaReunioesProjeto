from backend.app.core.database import engine
from sqlalchemy import text

def upgrade():
    print("⏳ Atualizando Banco para Multi-Tenant (SaaS)...")
    with engine.connect() as conn:
        try:
            # 1. Cria a tabela de usuários
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR PRIMARY KEY,
                    email VARCHAR NOT NULL,
                    name VARCHAR,
                    plan_tier VARCHAR DEFAULT 'free',
                    terms_accepted_at TIMESTAMP,
                    allow_data_training BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            
            # 2. Adiciona o Dono na tabela de reuniões
            conn.execute(text("ALTER TABLE meetings ADD COLUMN user_id VARCHAR;"))
            
            # 3. Adiciona o Dono na tabela de chaves de API
            conn.execute(text("ALTER TABLE api_keys ADD COLUMN user_id VARCHAR;"))
            
            conn.commit()
            print("✅ Tabela de Usuários e colunas de donos (user_id) adicionadas!")
        except Exception as e:
            print("⚠️ Aviso (Pode já existir):", e)

if __name__ == "__main__":
    upgrade()
