from flask import Blueprint, request, jsonify
from backend.app.core.database import SessionLocal
from backend.app.models.models import Settings, APIKey
import json
# Cria um agrupamento de rotas chamado "api"
api_bp = Blueprint("api", __name__)

@api_bp.route("/settings", methods=["GET"])
def get_settings():
    db = SessionLocal()
    try:
        # Como é Single-User, buscamos sempre o ID 1
        settings = db.query(Settings).filter(Settings.id == 1).first()
        
        # Se for o primeiro acesso, retorna valores padrão
        if not settings:
            return jsonify({"chunk_duration_minutes": 2, "keys": []}), 200
        
        # Monta a lista de chaves
        keys = [{"provider": k.provider, "key": k.api_key, "priority": k.priority} for k in settings.api_keys]
        
        return jsonify({
            "chunk_duration_minutes": settings.chunk_duration_minutes,
            "keys": keys
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@api_bp.route("/settings", methods=["POST"])
def update_settings():
    db = SessionLocal()
    try:
        data = request.json
        
        # Busca a configuração ou cria uma nova
        settings = db.query(Settings).filter(Settings.id == 1).first()
        if not settings:
            settings = Settings(id=1, chunk_duration_minutes=data.get("chunk_duration_minutes", 2))
            db.add(settings)
        else:
            settings.chunk_duration_minutes = data.get("chunk_duration_minutes", settings.chunk_duration_minutes)
        
        # US22: Deleta chaves antigas e insere a nova lista (Substituição Completa)
        db.query(APIKey).filter(APIKey.settings_id == 1).delete()
        
        raw_keys = data.get("keys", [])
        for k in raw_keys:
            # Regra QA: Ignora chaves vazias e espaços em branco
            if k.get("key") and str(k.get("key")).strip() != "":
                new_key = APIKey(
                    settings_id=1,
                    provider=k.get("provider"),
                    api_key=str(k.get("key")).strip(),
                    priority=k.get("priority", 1)
                )
                db.add(new_key)
        
        # Confirma a transação no banco de dados
        db.commit()
        return jsonify({"message": "Configurações salvas com sucesso!"}), 200
        
    except Exception as e:
        db.rollback() # Se der erro, desfaz tudo para não quebrar o banco
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

import os
from werkzeug.utils import secure_filename
from backend.app.models.models import Meeting
from backend.app.services.meeting_service import MeetingService

# Instancia o Maestro
meeting_service = MeetingService()

# Pasta onde salvaremos o áudio original antes de processar
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_audio")

@api_bp.route("/meetings", methods=["POST"])
def upload_meeting():
    db = SessionLocal()
    try:
        # Pega o arquivo e o template (ex: Padrão, Brainstorming) do Formulário
        if 'audio_file' not in request.files:
            return jsonify({"error": "Nenhum arquivo de áudio enviado"}), 400
            
        file = request.files['audio_file']
        template = request.form.get("template", "Padrão (Resumo e Tarefas)")
        
        if file.filename == '':
            return jsonify({"error": "Nome de arquivo vazio"}), 400
            
        # Salva o arquivo original com segurança
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        # Cria a reunião no Banco de Dados (Status: processing)
        new_meeting = Meeting(template_used=template)
        db.add(new_meeting)
        db.commit()
        db.refresh(new_meeting)
        
        # Manda processar em Background e libera o celular imediatamente!
        meeting_service.start_background_processing(new_meeting.id, file_path, template)
        
        return jsonify({
            "message": "Upload concluído. Processamento em andamento.",
            "meeting_id": new_meeting.id
        }), 202
        
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@api_bp.route("/meetings", methods=["GET"])
def get_all_meetings():
    db = SessionLocal()
    try:
        meetings = db.query(Meeting).order_by(Meeting.created_at.desc()).all()
        result = []
        for m in meetings:
            # Transforma a string do banco de volta numa lista para o Frontend
            logs_array = []
            if m.step_logs:
                try:
                    logs_array = json.loads(m.step_logs)
                except:
                    logs_array = []

            result.append({
                "id": m.id,
                "title": m.title,
                "status": m.status,
                "created_at": m.created_at.isoformat(),
                "summary": m.summary,
                "full_transcript": m.full_transcript,
                "progress": m.progress,      # NOVO
                "step_logs": logs_array      # NOVO
            })
        return jsonify(result), 200
    finally:
        db.close()
        
        
@api_bp.route("/meetings/<meeting_id>", methods=["PUT"])
def update_meeting(meeting_id):
    """US05: Atualiza o texto editado pelo usuário."""
    db = SessionLocal()
    try:
        data = request.json
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        
        if not meeting:
            return jsonify({"error": "Reunião não encontrada"}), 404
            
        if "summary" in data:
            meeting.summary = data["summary"]
        if "full_transcript" in data:
            meeting.full_transcript = data["full_transcript"]
            
        db.commit()
        return jsonify({"message": "Ata atualizada com sucesso"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()        
        
@api_bp.route("/meetings/<meeting_id>", methods=["DELETE"])
def delete_meeting(meeting_id):
    """US21: Exclusão do Histórico."""
    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            return jsonify({"error": "Ata não encontrada"}), 404
            
        db.delete(meeting)
        db.commit()
        return jsonify({"message": "Ata excluída com sucesso"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()        
