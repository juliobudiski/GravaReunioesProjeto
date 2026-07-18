from flask import Flask, jsonify
from flask_cors import CORS
from backend.app.core.database import Base, engine
from backend.app.api.routes import api_bp

def create_app():
    app = Flask(__name__)
    
    # Habilita CORS para o Frontend React (Vite) conseguir se comunicar
    CORS(app)

    # Garante que as tabelas existem (segurança extra)
    Base.metadata.create_all(bind=engine)

    # Registra os nossos endpoints com o prefixo /api
    app.register_blueprint(api_bp, url_prefix="/api")

    # Rota básica de teste de saúde do servidor
    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "Servidor Flask Operacional", "version": "1.0.0"}), 200

    return app

if __name__ == "__main__":
    app = create_app()
    # Roda o servidor na porta 5000
    print("🚀 Iniciando Servidor Backend...")
    app.run(host="0.0.0.0", port=5000, debug=True)
