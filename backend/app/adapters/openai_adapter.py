import openai
from backend.app.adapters.llm_interface import ILLMAdapter

class OpenAIAdapter(ILLMAdapter):
    def __init__(self, api_key: str):
        self.client = openai.OpenAI(api_key=api_key, timeout=60.0) # QA: Timeout de 60s

    def transcribe(self, audio_file_path: str) -> str:
        try:
            with open(audio_file_path, "rb") as audio_file:
                # Usa o modelo Whisper para transcrição
                response = self.client.audio.transcriptions.create(
                    model="whisper-1", 
                    file=audio_file,
                    response_format="text" # Já devolve a string limpa
                )
            return response
        except Exception as e:
            # QA: Em vez de quebrar o servidor, levanta um erro formatado para o Fallback capturar
            raise RuntimeError(f"OpenAI Transcribe Error: {str(e)}")

    def generate_summary(self, text: str, template: str) -> dict:
        try:
            prompt = f"Baseado na transcrição abaixo, crie um resumo e uma lista de tarefas. O contexto da reunião é: {template}.\n\nTranscrição: {text}"
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo", # Ou gpt-4o se preferir no futuro
                messages=[
                    {"role": "system", "content": "Você é um assistente especialista em gerar atas de reuniões precisas."},
                    {"role": "user", "content": prompt}
                ]
            )
            # Para o MVP, retornamos a resposta crua para ser processada depois
            return {"raw_output": response.choices[0].message.content}
        except Exception as e:
            raise RuntimeError(f"OpenAI LLM Error: {str(e)}")
