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

    def start_background_processing(self, meeting_id: str, file_paths: list, template: str, user_id: str):
        thread = threading.Thread(target=self._process_meeting, args=(meeting_id, file_paths, template, user_id))
        thread.start()

    def _process_meeting(self, meeting_id: str, file_paths: list, template: str, user_id: str):
        db = SessionLocal()
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        orchestrator = LLMOrchestrator(user_id)
        
        try:
            self._log_db(meeting_id, 10, f"Iniciando processamento de {len(file_paths)} arquivo(s)...")
            
            full_transcript_parts = []
            
            # 1. Transcreve cada arquivo da lista
            for i, path in enumerate(file_paths):
                self._log_db(meeting_id, 20 + (i*10), f"Transcrevendo arquivo {i+1} de {len(file_paths)}...")
                txt = orchestrator.transcribe_audio(path)
                full_transcript_parts.append(txt)
            
            # Junta tudo colocando uma divisória bonita no texto
            full_transcript = "\n\n--- PRÓXIMA PARTE DO ÁUDIO ---\n\n".join(full_transcript_parts)
            
            # 2. Resumo (A IA vai ler o textão gigante)
            self._log_db(meeting_id, 80, "Todos os áudios lidos! Gerando Ata Única...")
            enhanced_template = f"{template}. Sugira um Título Curto na primeira linha."
            summary_dict = orchestrator.generate_summary(full_transcript, enhanced_template)
            
            raw_output = summary_dict.get("raw_output", "")
            lines = raw_output.split('\n')
            title = lines[0].replace("Título:", "").replace("*", "").strip() if lines else "Reunião Sem Título"
            content = "\n".join(lines[1:]).strip()

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
            self._log_db(meeting_id, 100, "Limpando disco do servidor...")
            if meeting.status == "completed":
                # Deleta TODOS os arquivos da lista
                for path in file_paths:
                    if os.path.exists(path):
                        os.remove(path)
                logger.info("🗑️ Arquivos originais deletados do disco.")
            else:
                self._log_db(meeting_id, 0, "Arquivos originais preservados para o Retry.")
            db.close()
