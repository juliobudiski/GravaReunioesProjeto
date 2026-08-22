import os
import json
import threading
import logging
import time # <--- IMPORTAÇÃO PARA O FREIO DE MÃO
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
            self._log_db(meeting_id, 5, f"✂️ Iniciando fatiamento inteligente... Isso pode levar 1 minuto.")
            
            for path in file_paths:
                chunks = audio_service.split_audio(path)
                chunk_paths.extend(chunks)
                
            self._log_db(meeting_id, 10, f"✅ Fatiamento concluído! O áudio virou {len(chunk_paths)} pedaços.")
            
            full_transcript_parts = []
            for i, chunk_path in enumerate(chunk_paths):
                # SISTEMA ANTI-BLOQUEIO DO GOOGLE (Lida com o Limite de 15 pedidos por minuto)
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        self._log_db(meeting_id, 10 + int((i/len(chunk_paths))*70), f"🤖 IA Ouvindo fatia {i+1} de {len(chunk_paths)}...")
                        txt = orchestrator.transcribe_audio(chunk_path)
                        full_transcript_parts.append(txt)
                        break # Se deu certo, sai do loop de tentativas
                    except Exception as e:
                        if attempt < max_retries - 1:
                            self._log_db(meeting_id, 10 + int((i/len(chunk_paths))*70), f"⏳ API ocupada (Anti-Spam). Aguardando 15s para tentar a mesma fatia de novo...")
                            time.sleep(15)
                        else:
                            raise e # Se falhou 3 vezes na mesma fatia, desiste e dá erro crítico
                
                # Freio natural: Espera 5 segundos entre cada fatia para não ultrapassar 12 requests por minuto
                time.sleep(5)
            
            full_transcript = "\n\n--- PRÓXIMA PARTE DO ÁUDIO ---\n\n".join(full_transcript_parts)
            
            self._log_db(meeting_id, 80, "🧠 Todos os áudios lidos! Gerando Ata Final...")
            enhanced_template = f"{template}. Sugira um Título Curto na primeira linha."
            
            # Anti-bloqueio para a geração do resumo final
            try:
                summary_dict = orchestrator.generate_summary(full_transcript, enhanced_template)
            except Exception:
                self._log_db(meeting_id, 85, "⏳ API ocupada. Aguardando 15s para gerar o resumo...")
                time.sleep(15)
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
                for path in file_paths + chunk_paths:
                    if os.path.exists(path):
                        os.remove(path)
            else:
                for path in chunk_paths:
                    if os.path.exists(path):
                        os.remove(path)
