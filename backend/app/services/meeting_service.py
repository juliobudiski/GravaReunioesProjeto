import os
import json
import threading
import logging
from backend.app.core.database import SessionLocal
from backend.app.models.models import Meeting
from backend.app.services.llm_orchestrator import LLMOrchestrator
from backend.app.services.audio_service import AudioProcessingService

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
        except Exception as e:
            logger.error(f"Erro ao salvar log no banco: {e}")
        finally:
            db.close()

    def start_background_processing(self, meeting_id: str, file_paths: list, template: str, user_id: str):
        thread = threading.Thread(target=self._process_meeting, args=(meeting_id, file_paths, template, user_id))
        thread.start()

    def _process_meeting(self, meeting_id: str, file_paths: list, template: str, user_id: str):
        orchestrator = LLMOrchestrator(user_id)
        audio_service = AudioProcessingService()
        status_to_save = "error"
        summary_to_save = ""
        title_to_save = "Reunião Sem Título"
        full_transcript = ""
        chunk_paths = []
        
        try:
            # 1. Avisa na tela que começou a fatiar
            self._log_db(meeting_id, 5, f"✂️ Iniciando fatiamento inteligente... Isso pode levar 1 minuto.")
            
            for path in file_paths:
                chunks = audio_service.split_audio(path)
                chunk_paths.extend(chunks)
                
            self._log_db(meeting_id, 10, f"✅ Fatiamento concluído! O áudio virou {len(chunk_paths)} pedaços leves.")
            
            # 2. Transcreve pedaço por pedaço
            full_transcript_parts = []
            for i, chunk_path in enumerate(chunk_paths):
                self._log_db(meeting_id, 10 + int((i/len(chunk_paths))*70), f"🤖 IA Ouvindo fatia {i+1} de {len(chunk_paths)}...")
                txt = orchestrator.transcribe_audio(chunk_path)
                full_transcript_parts.append(txt)
            
            full_transcript = "\n\n--- PRÓXIMA PARTE DO ÁUDIO ---\n\n".join(full_transcript_parts)
            
            # 3. Gera o Resumo Final
            self._log_db(meeting_id, 80, "🧠 Todos os áudios lidos! Gerando Ata Final...")
            enhanced_template = f"{template}. Sugira um Título Curto na primeira linha."
            summary_dict = orchestrator.generate_summary(full_transcript, enhanced_template)
            
            raw_output = summary_dict.get("raw_output", "")
            lines = raw_output.split('\n')
            title_to_save = lines[0].replace("Título:", "").replace("*", "").strip() if lines else "Reunião Sem Título"
            summary_to_save = "\n".join(lines[1:]).strip()

            self._log_db(meeting_id, 100, "✅ Finalizado com sucesso!")
            status_to_save = "completed"
            
        except Exception as e:
            error_msg = f"❌ Erro Crítico: {str(e)}"
            self._log_db(meeting_id, 0, error_msg)
            summary_to_save = error_msg
            
        finally:
            db = SessionLocal()
            try:
                meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
                if meeting:
                    if status_to_save == "completed":
                        meeting.title = title_to_save
                        meeting.full_transcript = full_transcript
                        meeting.summary = summary_to_save
                        meeting.status = "completed"
                        meeting.progress = 100
                    else:
                        meeting.status = "error"
                        meeting.summary = summary_to_save
                    db.commit()
            finally:
                db.close()

            self._log_db(meeting_id, 100, "Limpando HD do servidor...")
            if status_to_save == "completed":
                # Deleta tudo (originais e fatias)
                for path in file_paths + chunk_paths:
                    if os.path.exists(path):
                        os.remove(path)
            else:
                # Se deu erro, apaga só as fatias pro HD não explodir (guarda o WEBM pro botão Retry funcionar)
                for path in chunk_paths:
                    if os.path.exists(path):
                        os.remove(path)
