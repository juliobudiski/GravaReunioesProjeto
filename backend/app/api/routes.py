import os
import json
from functools import wraps
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from firebase_admin import auth
import google.generativeai as genai
import openai

from backend.app.core.database import SessionLocal
from backend.app.models.models import Settings, APIKey, Meeting, User
from backend.app.services.meeting_service import MeetingService
from backend.app.services.llm_orchestrator import LLMOrchestrator

api_bp = Blueprint("api", __name__)
meeting_service = MeetingService()
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_audio")

# ==========================================
# MIDDLEWARE DE SEGURANÇA (FIREBASE AUTH)
# ==========================================
def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Acesso Negado: Token não fornecido"}), 401
        
        token = auth_header.split(" ")[1]
        try:
            # Valida o token com o Firebase
            decoded_token = auth.verify_id_token(token)
            request.user_id = decoded_token["uid"]
            request.user_email = decoded_token.get("email", "")
            
            # Checa se o usuário existe no nosso DB, senão cria (First Login)
            db = SessionLocal()
            if not db.query(User).filter(User.id == request.user_id).first():
                new_user = User(id=request.user_id, email=request.user_email)
                db.add(new_user)
                db.commit()
            db.close()
            
        except Exception as e:
            return jsonify({"error": f"Acesso Negado: Token Inválido. {str(e)}"}), 401
        return f(*args, **kwargs)
    return decorated_function

# ==========================================
# ROTAS: CONFIGURAÇÕES E CHAVES
# ==========================================

@api_bp.route("/settings", methods=["GET"])
@require_auth
def get_settings():
    db = SessionLocal()
    try:
        settings = db.query(Settings).filter(Settings.id == 1).first()
        keys_db = db.query(APIKey).filter(APIKey.user_id == request.user_id).order_by(APIKey.priority).all()
        
        chunk = settings.chunk_duration_minutes if settings else 2
        keys = [{
            "provider": k.provider, 
            "key": k.api_key, 
            "priority": k.priority,
            "primary_model": k.primary_model,
            "cascade_list": json.loads(k.cascade_list) if k.cascade_list else []
        } for k in keys_db]
        
        return jsonify({"chunk_duration_minutes": chunk, "keys": keys}), 200
    finally:
        db.close()

@api_bp.route("/settings", methods=["POST"])
@require_auth
def update_settings():
    db = SessionLocal()
    try:
        data = request.json
        settings = db.query(Settings).filter(Settings.id == 1).first()
        if not settings:
            settings = Settings(id=1, chunk_duration_minutes=data.get("chunk_duration_minutes", 2))
            db.add(settings)
        else:
            settings.chunk_duration_minutes = data.get("chunk_duration_minutes", settings.chunk_duration_minutes)
        
        db.query(APIKey).filter(APIKey.user_id == request.user_id).delete()
        
        for k in data.get("keys", []):
            if k.get("key") and str(k.get("key")).strip() != "":
                new_key = APIKey(
                    settings_id=1,
                    user_id=request.user_id,
                    provider=k.get("provider"),
                    api_key=str(k.get("key")).strip(),
                    priority=k.get("priority", 1),
                    primary_model=k.get("primary_model"),
                    cascade_list=json.dumps(k.get("cascade_list", []))
                )
                db.add(new_key)
        db.commit()
        return jsonify({"message": "Configurações salvas!"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@api_bp.route("/models", methods=["GET"])
@require_auth
def get_available_models():
    """US25: Lista os modelos, checando a chave DO USUÁRIO LOGADO."""
    provider = request.args.get("provider", "gemini")
    db = SessionLocal()
    try:
        key_record = db.query(APIKey).filter(APIKey.user_id == request.user_id, APIKey.provider == provider).first()
        if not key_record or not key_record.api_key:
            return jsonify({"error": f"Nenhuma chave cadastrada para {provider}"}), 404
            
        models_list = []
        if provider == "gemini":
            genai.configure(api_key=key_record.api_key)
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    models_list.append(m.name.replace("models/", ""))
                    
        elif provider == "openai":
            client = openai.OpenAI(api_key=key_record.api_key)
            response = client.models.list()
            for m in response.data:
                if m.id.startswith("gpt") or m.id.startswith("o1") or m.id.startswith("o3"):
                    models_list.append(m.id)
            models_list.sort(reverse=True)
            
        return jsonify({"models": models_list}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

# ==========================================
# ROTAS: GRAVAÇÃO E GERENCIAMENTO DE ATAS
# ==========================================

@api_bp.route("/meetings", methods=["POST"])
@require_auth
def upload_meeting():
    db = SessionLocal()
    try:
        if 'audio_file' not in request.files: 
            return jsonify({"error": "Nenhum arquivo"}), 400
        
        file = request.files['audio_file']
        template = request.form.get("template", "Padrão")
        
        # 1. Primeiro cria a reunião no banco para garantir que temos o ID
        new_meeting = Meeting(user_id=request.user_id, template_used=template)
        db.add(new_meeting)
        db.commit()
        db.refresh(new_meeting)
        
        # 2. Agora usa o ID recém-criado para nomear o arquivo
        filename = f"{new_meeting.id}.webm"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        # 3. Chama o Maestro para trabalhar em background
        meeting_service.start_background_processing(new_meeting.id, file_path, template, request.user_id)
        
        return jsonify({"message": "Upload concluído", "meeting_id": new_meeting.id}), 202
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@api_bp.route("/meetings", methods=["GET"])
@require_auth
def get_all_meetings():
    db = SessionLocal()
    try:
        meetings = db.query(Meeting).filter(Meeting.user_id == request.user_id).order_by(Meeting.created_at.desc()).all()
        result = []
        for m in meetings:
            result.append({
                "id": m.id, "title": m.title, "status": m.status,
                "created_at": m.created_at.isoformat(), "summary": m.summary,
                "full_transcript": m.full_transcript, "progress": m.progress,
                "step_logs": json.loads(m.step_logs) if m.step_logs else []
            })
        return jsonify(result), 200
    finally:
        db.close()

@api_bp.route("/meetings/<meeting_id>", methods=["PUT", "DELETE"])
@require_auth
def manage_meeting(meeting_id):
    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == request.user_id).first()
        if not meeting: 
            return jsonify({"error": "Ata não encontrada ou acesso negado"}), 404
        
        if request.method == "DELETE":
            db.delete(meeting)
            db.commit()
            return jsonify({"message": "Ata excluída"}), 200
            
        elif request.method == "PUT":
            data = request.json
            if "summary" in data: meeting.summary = data["summary"]
            if "full_transcript" in data: meeting.full_transcript = data["full_transcript"]
            db.commit()
            return jsonify({"message": "Ata atualizada"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@api_bp.route("/meetings/<meeting_id>/regenerate", methods=["POST"])
@require_auth
def regenerate_meeting(meeting_id):
    db = SessionLocal()
    # Orquestrador carrega chaves baseadas no usuário logado
    orchestrator = LLMOrchestrator(request.user_id) 
    try:
        data = request.json
        new_template = data.get("template", "Padrão")
        
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == request.user_id).first()
        if not meeting or not meeting.full_transcript:
            return jsonify({"error": "Ata ou Transcrição não encontrada"}), 404
            
        enhanced_template = f"{new_template}. Sugira um Título Curto na primeira linha."
        summary_dict = orchestrator.generate_summary(meeting.full_transcript, enhanced_template)
        
        raw_output = summary_dict.get("raw_output", "")
        lines = raw_output.split('\n')
        title = lines[0].replace("Título:", "").replace("*", "").strip() if lines else meeting.title
        content = "\n".join(lines[1:]).strip()

        meeting.title = title
        meeting.summary = content
        meeting.template_used = new_template
        db.commit()
        
        return jsonify({"message": "Ata regenerada com sucesso!", "new_title": title, "new_summary": content}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@api_bp.route("/meetings/<meeting_id>/chat", methods=["POST"])
@require_auth
def chat_meeting(meeting_id):
    db = SessionLocal()
    orchestrator = LLMOrchestrator(request.user_id)
    try:
        data = request.json
        question = data.get("question")
        
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == request.user_id).first()
        if not meeting or not meeting.full_transcript:
            return jsonify({"error": "Transcrição não encontrada"}), 404
            
        answer = orchestrator.chat_with_meeting(meeting.full_transcript, question)
        return jsonify({"answer": answer}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()
        
        
@api_bp.route("/meetings/<meeting_id>/retry", methods=["POST"])
@require_auth
def retry_meeting(meeting_id):
    """US: Tentar Novamente processar um áudio que falhou."""
    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == request.user_id).first()
        if not meeting or meeting.status != "error":
            return jsonify({"error": "Reunião não encontrada ou não está em estado de erro."}), 404
            
        # Tenta achar o arquivo no disco (assumindo que o nome gerado pelo werkzeug preservou a extensão)
        # Como o ID não tá no nome do arquivo físico no nosso código atual, precisamos de um truque ou padronizar o nome do arquivo.
        # Mas para simplificar a vida do Backend atual, vamos buscar na pasta:
        file_path = os.path.join(UPLOAD_FOLDER, f"{meeting.id}.webm") # DEVEMOS PADRONIZAR O NOME NO UPLOAD!
        
        if not os.path.exists(file_path):
            return jsonify({"error": "O arquivo de áudio original não está mais no servidor. Por favor, faça o upload novamente."}), 404

        # Zera os logs e o status
        meeting.status = "processing"
        meeting.progress = 0
        meeting.step_logs = "[]"
        db.commit()
        
        # Manda pra IA de novo!
        meeting_service.start_background_processing(meeting.id, file_path, meeting.template_used, request.user_id)
        
        return jsonify({"message": "Processamento reiniciado!"}), 202
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()        
