import google.generativeai as genai
import logging
from backend.app.adapters.llm_interface import ILLMAdapter

logger = logging.getLogger(__name__)

class GeminiAdapter(ILLMAdapter):
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        
        # A CASCATA DE MODELOS (Ideia do Usuário)
        # O código tentará de cima para baixo.
        self.model_cascade = [
            'gemini-flash-latest',                  # O mais recente e seguro
            'gemini-2.5-flash',                     # Novo modelo rápido
            'gemini-2.5-flash-native-audio-latest', # Específico para áudio
            'gemini-2.0-flash',                     # Fallback de segurança
            'gemini-1.5-flash'                      # Legado
        ]

    def _try_models(self, prompt_parts):
        """Função privada que executa a Cascata de Modelos."""
        last_error = None
        for model_name in self.model_cascade:
            try:
                logger.info(f"      -> Tentando sub-modelo Gemini: {model_name}")
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt_parts)
                return response.text
            except Exception as e:
                logger.warning(f"      -> ⚠️ Falha no sub-modelo {model_name}: {e}")
                last_error = e
        
        # Se esgotar a lista toda...
        raise RuntimeError(f"Todos os modelos da cascata Gemini falharam. Último erro: {last_error}")

    def transcribe(self, audio_file_path: str) -> str:
        try:
            # Envia o arquivo de áudio para o Google
            audio_file = genai.upload_file(path=audio_file_path)
            
            # Monta o prompt multimodal (Texto + Arquivo de Áudio)
            prompt = ["Por favor, transcreva o áudio a seguir exatamente como foi falado.", audio_file]
            
            return self._try_models(prompt)
        except Exception as e:
            raise RuntimeError(f"Gemini Transcribe Error: {str(e)}")

    def generate_summary(self, text: str, template: str) -> dict:
        try:
            prompt = [f"Você é um especialista em atas. Contexto: {template}.\n\nCrie um resumo e lista de tarefas (Action Items) para a transcrição abaixo:\n\n{text}"]
            
            result_text = self._try_models(prompt)
            return {"raw_output": result_text}
        except Exception as e:
            raise RuntimeError(f"Gemini LLM Error: {str(e)}")
