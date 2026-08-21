import os
import subprocess
import glob
import logging
import imageio_ffmpeg
from backend.app.core.database import SessionLocal
from backend.app.models.models import Settings

logger = logging.getLogger(__name__)

class AudioProcessingService:
    def __init__(self):
        self.temp_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_audio")
        os.makedirs(self.temp_dir, exist_ok=True)
        # Pega a "tesoura" real do sistema que instalamos (gasta zero RAM)
        self.ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
    def _get_chunk_duration_sec(self) -> int:
        db = SessionLocal()
        try:
            settings = db.query(Settings).filter(Settings.id == 1).first()
            minutes = settings.chunk_duration_minutes if settings else 2
            return minutes * 60  # Retorna em segundos pro FFMPEG
        except Exception:
            return 120
        finally:
            db.close()

    def split_audio(self, file_path: str) -> list:
        logger.info(f"🎧 Iniciando conversão SUPER LEVE do áudio: {file_path}")
        try:
            chunk_length_sec = self._get_chunk_duration_sec()
            base_name = os.path.basename(file_path).split('.')[0]
            
            # Molde do nome dos arquivos de saída (ex: arquivo_chunk_001.mp3)
            output_pattern = os.path.join(self.temp_dir, f"{base_name}_chunk_%03d.mp3")
            
            # Comando mágico: Lê do disco, corta e converte para MP3 sem usar a memória RAM!
            command = [
                self.ffmpeg_exe,
                "-y",                  # Sobrescrever se já existir
                "-i", file_path,       # Arquivo original bruto
                "-f", "segment",       # Ativa o modo fatiador
                "-segment_time", str(chunk_length_sec), # Tamanho do corte
                "-c:a", "libmp3lame",  # Converter para MP3
                "-b:a", "64k",         # Deixar bem leve (ideal para voz)
                output_pattern
            ]
            
            logger.info("⚙️ Rodando motor de fatiamento no HD...")
            result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            if result.returncode != 0:
                logger.error(f"Erro interno da tesoura: {result.stderr.decode('utf-8')}")
                raise RuntimeError("Falha ao processar áudio direto no sistema.")
            
            # Pega todas as fatias MP3 que ele cuspiu na pasta
            chunk_paths = sorted(glob.glob(os.path.join(self.temp_dir, f"{base_name}_chunk_*.mp3")))
            
            logger.info(f"✅ Sucesso! Gerou {len(chunk_paths)} fatias MP3 levíssimas.")
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
                logger.error(f"⚠️ Erro ao deletar {path}: {e}")
