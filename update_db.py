from backend.app.core.database import engine
from sqlalchemy import text

def upgrade():
    print("⏳ Atualizando Banco de Dados...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE meetings ADD COLUMN progress INTEGER DEFAULT 0;"))
            conn.execute(text("ALTER TABLE meetings ADD COLUMN step_logs TEXT DEFAULT '[]';"))
            conn.commit()
            print("✅ Colunas de Progresso e Logs adicionadas com sucesso!")
        except Exception as e:
            print("⚠️ Aviso (Pode já ter sido criado):", e)

if __name__ == "__main__":
    upgrade()
