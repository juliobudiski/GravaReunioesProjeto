import os
import json
import threading
import logging
from backend.app.core.database import SessionLocal
from backend.app.models.models import Meeting
from backend.app.services.llm_orchestrator import LLMOrchestrator

logger = logging.getLogger(__name__)

class MeetingService:
    def _log_db(self, meeting_id: str, progress: int, msg: str):
        logger.info(msg)
        db = SessionLocal()
        try:
            meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
            if meeting:
                meeting.progress = progress
                current_logs = json.loads(meeting.step_logs) if meeting.step_logs else []
                current_logs.append(msg)
                meeting.step_logs = json.dumps(current_logs)
                db.commit()
        finally:
            db.close()

    def start_background_processing(self, meeting_id: str, original_file_path: str, template: str, user_id: str):
        thread = threading.Thread(target=self._process_meeting, args=(meeting_id, original_file_path, template, user_id))
        thread.start()

    def _process_meeting(self, meeting_id: str, original_file_path: str, template: str, user_id: str):
        db = SessionLocal()
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        orchestrator = LLMOrchestrator(user_id)
        
        try:
            self._log_db(meeting_id, 20, "Iniciando processamento (Stream to IA)...")
            
            # 1. Transcreve o arquivo INTEIRO de uma vez
            self._log_db(meeting_id, 50, "Enviando arquivo completo para a Inteligência Artificial...")
            full_transcript = orchestrator.transcribe_audio(original_file_path)
            
            # 2. Resumo
            self._log_db(meeting_id, 80, "Áudio lido! Gerando Ata e Resumo...")
            enhanced_template = f"{template}. Sugira um Título Curto na primeira linha."
            summary_dict = orchestrator.generate_summary(full_transcript, enhanced_template)
            
            raw_output = summary_dict.get("raw_output", "")
            lines = raw_output.split('\n')
            title = lines[0].replace("Título:", "").replace("*", "").strip() if lines else "Reunião Sem Título"
            content = "\n".join(lines[1:]).strip()

            # 3. Sucesso
            self._log_db(meeting_id, 100, "✅ Finalizado com sucesso!")
            meeting.title = title
            meeting.full_transcript = full_transcript
            meeting.summary = content
            meeting.status = "completed"
            meeting.progress = 100
            db.commit()
            
        except Exception as e:
            error_msg = f"❌ Erro Crítico: {str(e)}"
            self._log_db(meeting_id, 0, error_msg)
            meeting.status = "error"
            meeting.summary = error_msg
            db.commit()
            
        finally:
            # LIMPEZA OBRIGATÓRIA DA MEMÓRIA/DISCO
            self._log_db(meeting_id, 100, "Limpando disco do servidor...")
            if meeting.status == "completed" and os.path.exists(original_file_path):
                try:
                    os.remove(original_file_path)
                    logger.info("🗑️ Arquivo de áudio deletado do disco.")
                except Exception as del_e:
                    logger.error(f"Erro ao deletar: {del_e}")
            db.close()
