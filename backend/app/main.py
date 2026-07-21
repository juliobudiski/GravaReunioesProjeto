import os
import firebase_admin
from firebase_admin import credentials
from flask import Flask, jsonify
from flask_cors import CORS
from backend.app.core.database import Base, engine
from backend.app.api.routes import api_bp

def create_app():
    app = Flask(__name__)
    CORS(app)

    # 1. Cria as tabelas do PostgreSQL
    Base.metadata.create_all(bind=engine)

    # 2. Inicializa o Firebase Admin SDK
    try:
        cred_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "firebase-admin.json")
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase inicializado via Arquivo Local!")
        else:
            import json
            # Lê o textão gigante do Render e transforma num dicionário
            cert_json = json.loads(os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))
            cred = credentials.Certificate(cert_json)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase inicializado via Nuvem (JSON Env Var)!")
            
    except ValueError:
        print("⚡ Firebase já inicializado.")
    except Exception as e:
        print(f"❌ ERRO FIREBASE: {e}")

    # 3. Registra as Rotas
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "Servidor Flask (SaaS) Operacional", "version": "2.0"}), 200

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
