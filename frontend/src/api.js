const API_URL = "http://localhost:5000/api";

export const uploadAudio = async (audioBlob, template) => {
  const formData = new FormData();
  formData.append("audio_file", audioBlob, "gravacao.webm");
  formData.append("template", template);

  const response = await fetch(`${API_URL}/meetings`, { method: "POST", body: formData });
  if (!response.ok) throw new Error("Falha ao enviar o áudio");
  return response.json();
};

export const getSettings = async () => {
  const response = await fetch(`${API_URL}/settings`);
  if (!response.ok) throw new Error("Falha ao carregar configurações");
  return response.json();
};

export const saveSettings = async (settingsData) => {
  const response = await fetch(`${API_URL}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settingsData),
  });
  if (!response.ok) throw new Error("Falha ao salvar configurações");
  return response.json();
};

export const getMeetings = async () => {
  const response = await fetch(`${API_URL}/meetings`);
  if (!response.ok) throw new Error("Falha ao carregar histórico");
  return response.json();
};

export const updateMeeting = async (id, data) => {
  const response = await fetch(`${API_URL}/meetings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Falha ao salvar edição");
  return response.json();
};

export const deleteMeeting = async (id) => {
  const response = await fetch(`${API_URL}/meetings/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Falha ao excluir ata");
  return response.json();
};


