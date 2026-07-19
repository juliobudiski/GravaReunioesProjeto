import os
import json
import threading
import logging
from backend.app.core.database import SessionLocal
from backend.app.models.models import Meeting
from backend.app.services.audio_service import AudioProcessingService
from backend.app.services.llm_orchestrator import LLMOrchestrator

logger = logging.getLogger(__name__)

class MeetingService:
    def __init__(self):
        self.audio_service = AudioProcessingService()
        self.llm_orchestrator = LLMOrchestrator()

    def _log_db(self, meeting_id: str, progress: int, msg: str):
        """Salva o progresso e a mensagem no Banco de Dados para o Frontend ler"""
        logger.info(msg) # Mantém no terminal
        db = SessionLocal()
        try:
            meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
            if meeting:
                meeting.progress = progress
                # Lê os logs antigos, adiciona o novo e salva
                current_logs = json.loads(meeting.step_logs) if meeting.step_logs else []
                current_logs.append(msg)
                meeting.step_logs = json.dumps(current_logs)
                db.commit()
        finally:
            db.close()

    def start_background_processing(self, meeting_id: str, original_file_path: str, template: str):
        thread = threading.Thread(target=self._process_meeting, args=(meeting_id, original_file_path, template))
        thread.start()

    def _process_meeting(self, meeting_id: str, original_file_path: str, template: str):
        db = SessionLocal()
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        chunk_paths = []
        
        try:
            self._log_db(meeting_id, 10, "Etapa 1: Preparando arquivo e ferramentas...")
            
            # 1. Fatiamento (Chunks)
            self._log_db(meeting_id, 25, "Fatiando o áudio para otimização...")
            chunk_paths = self.audio_service.split_audio(original_file_path)
            
            # 2. Transcrição (Fallback)
            self._log_db(meeting_id, 40, f"Transcrevendo {len(chunk_paths)} fatias de áudio...")
            full_transcript_parts = []
            
            for i, chunk_path in enumerate(chunk_paths):
                self._log_db(meeting_id, 40 + (i*10), f"Processando fatia {i+1} de {len(chunk_paths)}...")
                transcript_part = self.llm_orchestrator.transcribe_audio(chunk_path)
                full_transcript_parts.append(transcript_part)
                
            full_transcript = "\n\n".join(full_transcript_parts)
            
            # 3. Geração de Ata
            self._log_db(meeting_id, 80, "Aplicando Inteligência Artificial para gerar Ata...")
            enhanced_template = f"{template}. Além disso, sugira um Título Curto (max 5 palavras) na primeira linha."
            
            summary_dict = self.llm_orchestrator.generate_summary(full_transcript, enhanced_template)
            raw_output = summary_dict.get("raw_output", "")
            
            lines = raw_output.split('\n')
            title = lines[0].replace("Título:", "").replace("*", "").strip() if lines else "Reunião Sem Título"
            content = "\n".join(lines[1:]).strip()

            # 4. Atualiza DB (Sucesso)
            self._log_db(meeting_id, 100, "✅ Finalizado e salvo com sucesso!")
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
            self._log_db(meeting_id, 100, "Limpando arquivos temporários do servidor...")
            all_files_to_delete = [original_file_path] + chunk_paths
            self.audio_service.cleanup_temp_files(all_files_to_delete)
            db.close()
