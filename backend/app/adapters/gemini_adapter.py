import google.generativeai as genai
import logging
import time

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
                
        if not self.model_cascade:
            logger.info("      -> Cascata vazia. Usando padrão...")
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
                # FREIO DE MÃO: Pausa 3 segundos para o Google não nos dar banimento (Erro 429)
                time.sleep(3)
        raise RuntimeError(f"Todos os modelos da cascata Gemini falharam. Erro: {last_error}")

    def transcribe(self, audio_file_path: str) -> str:
        try:
            logger.info("      -> Fazendo upload do áudio para o Google Gemini...")
            audio_file = genai.upload_file(path=audio_file_path)
            
            logger.info("      -> Aguardando o Google preparar o áudio internamente...")
            while True:
                file_info = genai.get_file(audio_file.name)
                if file_info.state.name == 'ACTIVE':
                    logger.info("      -> Áudio pronto! Iniciando transcrição...")
                    break
                elif file_info.state.name == 'FAILED':
                    raise RuntimeError("O Google falhou ao processar o arquivo de áudio.")
                time.sleep(2)

            # FILTRO INTELIGENTE: Só tenta transcrever com modelos que sabemos que suportam áudio
            audio_models = [m for m in self.model_cascade if 'gemini-1.5' in m or 'gemini-2' in m]
            if not audio_models:
                audio_models = ['gemini-1.5-flash'] # Salva-vidas padrão
            
            last_error = None
            for model_name in audio_models:
                try:
                    logger.info(f"      -> Tentando ouvir o áudio com: {model_name}")
                    model = genai.GenerativeModel(model_name)
                    response = model.generate_content(["Por favor, transcreva o áudio a seguir exatamente como foi falado.", audio_file])
                    return response.text
                except Exception as e:
                    logger.warning(f"      -> ⚠️ Falha no {model_name}: {e}")
                    last_error = e
                    # FREIO DE MÃO PARA ÁUDIO
                    time.sleep(3)
                    
            raise RuntimeError(f"Nenhum modelo conseguiu ouvir o áudio. Erro: {last_error}")
            
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
