import openai
import logging
from backend.app.adapters.llm_interface import ILLMAdapter

logger = logging.getLogger(__name__)

class OpenAIAdapter(ILLMAdapter):
    def __init__(self, api_key: str, primary_model: str, cascade_list: list):
        self.client = openai.OpenAI(api_key=api_key, timeout=60.0)
        
        self.model_cascade = []
        if primary_model:
            self.model_cascade.append(primary_model)
            
        for m in cascade_list:
            if m not in self.model_cascade:
                self.model_cascade.append(m)
                
        # AUTO-PREENCHIMENTO DE CASCATA
        if not self.model_cascade:
            logger.info("      -> Cascata vazia. Buscando modelos ativos na OpenAI...")
            try:
                response = self.client.models.list()
                for m in response.data:
                    if m.id.startswith("gpt") or m.id.startswith("o1") or m.id.startswith("o3"):
                        self.model_cascade.append(m.id)
                self.model_cascade.sort(reverse=True)
                if not self.model_cascade:
                    self.model_cascade = ['gpt-4o-mini', 'gpt-3.5-turbo']
            except Exception as e:
                logger.error(f"Erro ao buscar modelos da OpenAI automaticamente: {e}")
                self.model_cascade = ['gpt-4o-mini', 'gpt-3.5-turbo']

    def _try_models(self, messages):
        last_error = None
        for model_name in self.model_cascade:
            try:
                logger.info(f"      -> Tentando sub-modelo OpenAI: {model_name}")
                response = self.client.chat.completions.create(
                    model=model_name,
                    messages=messages
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.warning(f"      -> ⚠️ Falha no sub-modelo {model_name}: {e}")
                last_error = e
        raise RuntimeError(f"Todos os modelos da cascata OpenAI falharam. Erro: {last_error}")

    def transcribe(self, audio_file_path: str) -> str:
        try:
            with open(audio_file_path, "rb") as audio_file:
                response = self.client.audio.transcriptions.create(
                    model="whisper-1", 
                    file=audio_file,
                    response_format="text"
                )
            return response
        except Exception as e:
            raise RuntimeError(f"OpenAI Transcribe Error: {str(e)}")

    def generate_summary(self, text: str, template: str) -> dict:
        try:
            messages = [
                {"role": "system", "content": "Você é um assistente especialista em atas."},
                {"role": "user", "content": f"Contexto: {template}.\n\nCrie resumo para:\n\n{text}"}
            ]
            return {"raw_output": self._try_models(messages)}
        except Exception as e:
            raise RuntimeError(f"OpenAI LLM Error: {str(e)}")

    def chat(self, context: str, question: str) -> str:
        try:
            messages = [
                {"role": "system", "content": "Responda à pergunta APENAS com base no contexto. Se não souber, diga."},
                {"role": "user", "content": f"Contexto:\n{context}\n\nPergunta: {question}"}
            ]
            return self._try_models(messages)
        except Exception as e:
            raise RuntimeError(f"OpenAI Chat Error: {str(e)}")
