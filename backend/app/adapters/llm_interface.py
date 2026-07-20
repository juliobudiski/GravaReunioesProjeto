from abc import ABC, abstractmethod

class ILLMAdapter(ABC):
    """
    Interface (Contrato) que todos os provedores de IA devem seguir.
    Garante que OpenAI, Gemini ou qualquer outro funcionem exatamente da mesma forma no sistema.
    """
    
    @abstractmethod
    def transcribe(self, audio_file_path: str) -> str:
        """Recebe o caminho de um áudio e devolve o texto transcrito."""
        pass
        
    @abstractmethod
    def generate_summary(self, text: str, template: str) -> dict:
        """Recebe a transcrição e devolve um dicionário com Resumo e Tarefas."""
        pass
    
    @abstractmethod
    def chat(self, context: str, question: str) -> str:
        """Recebe o texto da reunião e uma pergunta, e devolve a resposta da IA."""
        pass    
        
