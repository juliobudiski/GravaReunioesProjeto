from backend.app.core.database import engine
from sqlalchemy import text

def upgrade():
    print("⏳ Atualizando Tabela de Chaves de API...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE api_keys ADD COLUMN primary_model VARCHAR;"))
            conn.execute(text("ALTER TABLE api_keys ADD COLUMN cascade_list TEXT DEFAULT '[]';"))
            conn.commit()
            print("✅ Colunas de Modelos Inteligentes adicionadas com sucesso!")
        except Exception as e:
            print("⚠️ Aviso:", e)

if __name__ == "__main__":
    upgrade()
