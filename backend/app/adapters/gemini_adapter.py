import google.generativeai as genai
from backend.app.adapters.llm_interface import ILLMAdapter

class GeminiAdapter(ILLMAdapter):
    def __init__(self, api_key: str):
        # Configura a chave na biblioteca do Google
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def transcribe(self, audio_file_path: str) -> str:
        try:
            # Nota do DEV: O Gemini 1.5 aceita áudio nativamente para prompt!
            audio_file = genai.upload_file(path=audio_file_path)
            
            response = self.model.generate_content([
                "Por favor, transcreva o áudio a seguir exatamente como foi falado.",
                audio_file
            ])
            
            return response.text
        except Exception as e:
            raise RuntimeError(f"Gemini Transcribe Error: {str(e)}")

    def generate_summary(self, text: str, template: str) -> dict:
        try:
            prompt = f"Você é um especialista em atas. Contexto: {template}.\n\nCrie um resumo e lista de tarefas para a transcrição: {text}"
            response = self.model.generate_content(prompt)
            
            return {"raw_output": response.text}
        except Exception as e:
            raise RuntimeError(f"Gemini LLM Error: {str(e)}")
