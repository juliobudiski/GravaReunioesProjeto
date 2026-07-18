import os
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

    def start_background_processing(self, meeting_id: str, original_file_path: str, template: str):
        """Inicia a Thread de background para não travar o celular (US15)."""
        thread = threading.Thread(
            target=self._process_meeting,
            args=(meeting_id, original_file_path, template)
        )
        thread.start()
        logger.info(f"🚀 Thread de background iniciada para a reunião {meeting_id}")

    def _process_meeting(self, meeting_id: str, original_file_path: str, template: str):
        """O processamento real, longo e pesado (Fatiar -> IA -> Salvar -> Limpar)."""
        db = SessionLocal()
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        chunk_paths = []
        
        try:
            # 1. Fatiamento (Chunks)
            logger.info("Etapa 1: Fatiando o áudio...")
            chunk_paths = self.audio_service.split_audio(original_file_path)
            
            # 2. Transcrição (Fallback pedaço por pedaço)
            logger.info("Etapa 2: Transcrevendo as fatias...")
            full_transcript_parts = []
            
            for chunk_path in chunk_paths:
                transcript_part = self.llm_orchestrator.transcribe_audio(chunk_path)
                full_transcript_parts.append(transcript_part)
                
            # Junta tudo num texto único separando por quebras de linha
            full_transcript = "\n\n".join(full_transcript_parts)
            
            # 3. Geração de Ata (Resumo, Tarefas, Título)
            logger.info("Etapa 3: Gerando Ata (Resumo/Tarefas/Título)...")
            # Adicionamos a ordem de gerar um título no template enviado
            enhanced_template = f"{template}. Além disso, sugira um Título Curto (max 5 palavras) na primeira linha."
            
            summary_dict = self.llm_orchestrator.generate_summary(full_transcript, enhanced_template)
            raw_output = summary_dict.get("raw_output", "")
            
            # Divide o output (Assume que a IA botou o título na 1ª linha e o resto embaixo)
            lines = raw_output.split('\n')
            title = lines[0].replace("Título:", "").replace("*", "").strip() if lines else "Reunião Sem Título"
            content = "\n".join(lines[1:]).strip()

            # 4. Atualiza o Banco de Dados (Sucesso)
            meeting.title = title
            meeting.full_transcript = full_transcript
            meeting.summary = content
            meeting.status = "completed"
            
            db.commit()
            logger.info(f"✅ Reunião {meeting_id} processada e salva com sucesso!")
            
        except Exception as e:
            # Em caso de erro em qualquer etapa, marca o status no banco para o frontend saber
            logger.error(f"❌ Erro crítico no processamento da reunião {meeting_id}: {e}")
            meeting.status = "error"
            meeting.summary = f"Erro no processamento: {str(e)}"
            db.commit()
            
        finally:
            # 5. Limpeza (Deleta a cópia original e todas as fatias!)
            logger.info("Etapa 5: Limpeza de disco...")
            all_files_to_delete = [original_file_path] + chunk_paths
            self.audio_service.cleanup_temp_files(all_files_to_delete)
            db.close()
