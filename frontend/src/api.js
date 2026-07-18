// Este arquivo concentra as chamadas para o nosso Backend Flask
const API_URL = "http://localhost:5000/api";

export const uploadAudio = async (audioBlob, template) => {
  const formData = new FormData();
  // Transformando o Blob (memória) num Arquivo para enviar
  formData.append("audio_file", audioBlob, "gravacao.webm");
  formData.append("template", template);

  const response = await fetch(`${API_URL}/meetings`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Falha ao enviar o áudio para o servidor");
  }

  return response.json();
};
