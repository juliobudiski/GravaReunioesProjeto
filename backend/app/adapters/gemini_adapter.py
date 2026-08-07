import google.generativeai as genai
import logging
from backend.app.adapters.llm_interface import ILLMAdapter

logger = logging.getLogger(__name__)

class GeminiAdapter(ILLMAdapter):
    def __init__(self, api_key: str, primary_model: str, cascade_list: list):
        genai.configure(api_key=api_key)
        self.api_key = api_key
        
        self.model_cascade = []
        if primary_model:
            self.model_cascade.append(primary_model)
            
        for m in cascade_list:
            if m not in self.model_cascade:
                self.model_cascade.append(m)
                
        # O PULO DO GATO: Se a lista estiver vazia (usuário não buscou), o Backend busca sozinho!
        if not self.model_cascade:
            logger.info("      -> Cascata vazia. Buscando modelos ativos no Google...")
            try:
                for m in genai.list_models():
                    if 'generateContent' in m.supported_generation_methods:
                        self.model_cascade.append(m.name.replace("models/", ""))
                # Se até a busca falhar (API offline), usamos o hardcoded à prova de falhas
                if not self.model_cascade:
                    self.model_cascade = ['gemini-1.5-flash-latest']
            except Exception as e:
                logger.error(f"Erro ao buscar modelos do Gemini automaticamente: {e}")
                self.model_cascade = ['gemini-1.5-flash-latest']

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
            return self._try_models(["Por favor, transcreva o áudio a seguir exatamente como foi falado.", audio_file])
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
            prompt = [f"Responda à pergunta baseando-se APENAS no contexto. Se não souber, diga.\n\nContexto:\n{context}\n\nPergunta: {question}"]
            return self._try_models(prompt)
        except Exception as e:
            raise RuntimeError(f"Gemini Chat Error: {str(e)}")
