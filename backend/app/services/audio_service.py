import os
from pydub import AudioSegment
import math
import logging
from backend.app.core.database import SessionLocal
from backend.app.models.models import Settings

logger = logging.getLogger(__name__)

class AudioProcessingService:
    def __init__(self):
        # A pasta temp_audio que criamos no script de setup bash
        self.temp_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_audio")
        
    def _get_chunk_duration_ms(self) -> int:
        """Busca no banco de dados o tamanho do Chunk em minutos e converte para milissegundos."""
        db = SessionLocal()
        try:
            settings = db.query(Settings).filter(Settings.id == 1).first()
            # Se não achar, usa 2 minutos como padrão
            minutes = settings.chunk_duration_minutes if settings else 2
            return minutes * 60 * 1000 # Retorna em milissegundos (pydub usa ms)
        except Exception as e:
            logger.error(f"Erro ao buscar tamanho do chunk: {e}")
            return 2 * 60 * 1000
        finally:
            db.close()

    def split_audio(self, file_path: str) -> list:
        """
        Lê um arquivo de áudio pesado e o divide em vários arquivos menores (Chunks).
        Retorna uma lista com os caminhos absolutos das fatias criadas.
        """
        logger.info(f"🎧 Iniciando fatiamento do áudio: {file_path}")
        chunk_paths = []
        
        try:
            # Carrega o áudio inteiro na memória usando o ffmpeg por baixo dos panos
            audio = AudioSegment.from_file(file_path)
            
            chunk_length_ms = self._get_chunk_duration_ms()
            total_duration_ms = len(audio)
            
            # Calcula quantas fatias vão dar
            num_chunks = math.ceil(total_duration_ms / chunk_length_ms)
            logger.info(f"✂️ O áudio será dividido em {num_chunks} fatias de {chunk_length_ms/60000} minutos.")
            
            # Pega o nome do arquivo original (ex: 'reuniao1.webm') para gerar os nomes das fatias
            base_name = os.path.basename(file_path).split('.')[0]
            
            for i in range(num_chunks):
                start_time = i * chunk_length_ms
                end_time = min((i + 1) * chunk_length_ms, total_duration_ms)
                
                # Realiza o corte do áudio (Fatia I)
                chunk = audio[start_time:end_time]
                
                # Nome do novo arquivo: reuniao1_chunk_0.mp3
                chunk_file_name = f"{base_name}_chunk_{i}.mp3"
                chunk_file_path = os.path.join(self.temp_dir, chunk_file_name)
                
                # Exporta o arquivo para o disco na pasta temp_audio
                chunk.export(chunk_file_path, format="mp3")
                chunk_paths.append(chunk_file_path)
                
            logger.info("✅ Fatiamento concluído com sucesso!")
            return chunk_paths
            
        except Exception as e:
            logger.error(f"❌ Erro ao fatiar o áudio: {e}")
            raise RuntimeError(f"Erro no processamento de áudio: {e}")

    def cleanup_temp_files(self, file_paths: list):
        """
        US09: Exclusão Segura. 
        Apaga os arquivos temporários do disco após o uso para não estourar o servidor.
        """
        for path in file_paths:
            try:
                if os.path.exists(path):
                    os.remove(path)
                    logger.info(f"🗑️ Arquivo temporário deletado: {path}")
            except Exception as e:
                logger.error(f"⚠️ Erro ao tentar deletar {path}: {e}")
