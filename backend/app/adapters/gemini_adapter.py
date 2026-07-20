import google.generativeai as genai
import logging
from backend.app.adapters.llm_interface import ILLMAdapter

logger = logging.getLogger(__name__)

class GeminiAdapter(ILLMAdapter):
    def __init__(self, api_key: str, primary_model: str, cascade_list: list):
        genai.configure(api_key=api_key)
        
        # A CASCATA INTELIGENTE DINÂMICA
        # Pega o modelo que você escolheu na interface, e junta com o resto que a API achou
        self.model_cascade = []
        if primary_model:
            self.model_cascade.append(primary_model)
            
        for m in cascade_list:
            if m not in self.model_cascade:
                self.model_cascade.append(m)
                
        # Fallback de emergência caso tudo esteja vazio
        if not self.model_cascade:
            self.model_cascade = ['gemini-1.5-flash']

    def _try_models(self, prompt_parts):
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
        raise RuntimeError(f"Todos os modelos da cascata Gemini falharam. Último erro: {last_error}")

    def transcribe(self, audio_file_path: str) -> str:
        try:
            audio_file = genai.upload_file(path=audio_file_path)
            return self._try_models(["Por favor, transcreva o áudio a seguir.", audio_file])
        except Exception as e:
            raise RuntimeError(f"Gemini Transcribe Error: {str(e)}")

    def generate_summary(self, text: str, template: str) -> dict:
        try:
            prompt = [f"Contexto: {template}.\n\nCrie resumo para:\n\n{text}"]
            return {"raw_output": self._try_models(prompt)}
        except Exception as e:
            raise RuntimeError(f"Gemini LLM Error: {str(e)}")
            
    def chat(self, context: str, question: str) -> str:
        try:
            prompt = [f"Responda à pergunta baseando-se APENAS no contexto da reunião fornecida. Se não souber, diga que não foi mencionado.\n\nContexto:\n{context}\n\nPergunta: {question}"]
            return self._try_models(prompt)
        except Exception as e:
            raise RuntimeError(f"Gemini Chat Error: {str(e)}")        
            
