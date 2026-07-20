import logging
from backend.app.core.database import SessionLocal
from backend.app.models.models import APIKey, Settings
from backend.app.adapters.openai_adapter import OpenAIAdapter
from backend.app.adapters.gemini_adapter import GeminiAdapter
import json

# Configura o sistema de logs para o terminal do Ubuntu
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class LLMOrchestrator:
    def __init__(self):
        self.adapters = self._load_adapters_from_db()

    def _load_adapters_from_db(self):
        """Busca as chaves no banco de dados, ordena por prioridade e cria a lista de Adapters."""
        db = SessionLocal()
        adapters_list = []
        try:
            # Busca todas as chaves associadas ao id=1, ordenadas por prioridade (1, 2, 3...)
            keys = db.query(APIKey).filter(APIKey.settings_id == 1).order_by(APIKey.priority.asc()).all()
            
            for k in keys:
                # O parse do JSON extrai a lista do banco
                cascade = json.loads(k.cascade_list) if k.cascade_list else []
                
                if k.provider == 'openai':
                    adapters_list.append({
                        'name': f"OpenAI (Priority {k.priority})", 
                        'instance': OpenAIAdapter(k.api_key, k.primary_model, cascade) # CORRIGIDO AQUI
                    })
                elif k.provider == 'gemini':
                    adapters_list.append({
                        'name': f"Gemini (Priority {k.priority})", 
                        'instance': GeminiAdapter(k.api_key, k.primary_model, cascade)
                    })
            
            return adapters_list
        except Exception as e:
            logger.error(f"Erro ao carregar chaves do banco: {e}")
            return []
        finally:
            db.close()

    def transcribe_audio(self, audio_file_path: str) -> str:
        """Tenta transcrever o áudio usando os adapters da lista. Se um falhar, tenta o próximo."""
        if not self.adapters:
            raise ValueError("Nenhuma chave de API configurada no banco de dados!")

        for adapter_info in self.adapters:
            name = adapter_info['name']
            instance = adapter_info['instance']
            
            logger.info(f"⏳ Tentando transcrição via: {name}")
            try:
                # Tenta executar a transcrição
                result = instance.transcribe(audio_file_path)
                logger.info(f"✅ Transcrição bem-sucedida via: {name}")
                return result
            
            except Exception as e:
                # Captura o erro, loga e deixa o loop continuar para a próxima chave!
                logger.warning(f"⚠️ Falha no {name}. Erro: {e}. Tentando o próximo...")

        # Se o loop terminar sem retornar nada, significa que TODAS as chaves falharam
        logger.error("❌ Todas as chaves de API falharam no Fallback.")
        raise RuntimeError("Falha total na transcrição: Todas as APIs esgotadas ou com erro.")

    def generate_summary(self, text: str, template: str) -> dict:
        """Mesma lógica de Fallback, mas para a geração do Resumo."""
        if not self.adapters:
            raise ValueError("Nenhuma chave de API configurada no banco de dados!")

        for adapter_info in self.adapters:
            name = adapter_info['name']
            instance = adapter_info['instance']
            
            logger.info(f"⏳ Tentando geração de Resumo via: {name}")
            try:
                result = instance.generate_summary(text, template)
                logger.info(f"✅ Resumo gerado via: {name}")
                return result
            
            except Exception as e:
                logger.warning(f"⚠️ Falha no {name}. Erro: {e}. Tentando o próximo...")

        raise RuntimeError("Falha total no Resumo: Todas as APIs esgotadas ou com erro.")
        
    def chat_with_meeting(self, context: str, question: str) -> str:
        if not self.adapters:
            raise ValueError("Nenhuma chave de API configurada no banco de dados!")
        for adapter_info in self.adapters:
            try:
                logger.info(f"⏳ Perguntando ao chat via: {adapter_info['name']}")
                return adapter_info['instance'].chat(context, question)
            except Exception as e:
                logger.warning(f"⚠️ Falha no chat via {adapter_info['name']}: {e}")
        raise RuntimeError("Falha total no Chat. Todas as APIs esgotadas.")    
        
