import os
from pydub import AudioSegment
import imageio_ffmpeg
import math
import logging
from backend.app.core.database import SessionLocal
from backend.app.models.models import Settings

# O PULO DO GATO: Injeta o FFMPEG diretamente no Pydub para rodar no Render!
AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()

logger = logging.getLogger(__name__)

class AudioProcessingService:
    def __init__(self):
        self.temp_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_audio")
        os.makedirs(self.temp_dir, exist_ok=True) # Garante que a pasta existe
        
    def _get_chunk_duration_ms(self) -> int:
        db = SessionLocal()
        try:
            settings = db.query(Settings).filter(Settings.id == 1).first()
            minutes = settings.chunk_duration_minutes if settings else 2
            return minutes * 60 * 1000 
        except Exception as e:
            return 2 * 60 * 1000
        finally:
            db.close()

    def split_audio(self, file_path: str) -> list:
        logger.info(f"🎧 Iniciando fatiamento do áudio: {file_path}")
        chunk_paths = []
        try:
            audio = AudioSegment.from_file(file_path)
            chunk_length_ms = self._get_chunk_duration_ms()
            total_duration_ms = len(audio)
            
            num_chunks = math.ceil(total_duration_ms / chunk_length_ms)
            logger.info(f"✂️ O áudio será dividido em {num_chunks} fatias.")
            
            base_name = os.path.basename(file_path).split('.')[0]
            
            for i in range(num_chunks):
                start_time = i * chunk_length_ms
                end_time = min((i + 1) * chunk_length_ms, total_duration_ms)
                chunk = audio[start_time:end_time]
                chunk_file_path = os.path.join(self.temp_dir, f"{base_name}_chunk_{i}.mp3")
                chunk.export(chunk_file_path, format="mp3")
                chunk_paths.append(chunk_file_path)
                
            logger.info("✅ Fatiamento concluído com sucesso!")
            return chunk_paths
        except Exception as e:
            logger.error(f"❌ Erro ao fatiar o áudio: {e}")
            raise RuntimeError(f"Erro no processamento de áudio: {e}")

    def cleanup_temp_files(self, file_paths: list):
        for path in file_paths:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception as e:
                logger.error(f"⚠️ Erro ao tentar deletar {path}: {e}")
