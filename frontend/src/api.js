import localforage from 'localforage';
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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

export const regenerateMeeting = async (id, template) => {
  const response = await fetch(`${API_URL}/meetings/${id}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template }),
  });
  if (!response.ok) throw new Error("Falha ao regenerar ata");
  return response.json();
};

// A FUNÇÃO QUE FALTAVA (US25)
export const fetchAvailableModels = async (provider) => {
  const response = await fetch(`${API_URL}/models?provider=${provider}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Falha ao buscar modelos");
  }
  return response.json();
};


export const chatWithMeeting = async (id, question) => {
  const response = await fetch(`${API_URL}/meetings/${id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error("Falha ao enviar pergunta");
  return response.json();
};

// ==========================================
// MÓDULO OFFLINE (IndexedDB)
// ==========================================

// Salva a gravação localmente se falhar ou não tiver internet
export const saveOfflineMeeting = async (audioBlob, template, title = "Gravado Offline") => {
  const meetingId = `local_${Date.now()}`;
  const payload = {
    id: meetingId,
    audioBlob,
    template,
    title,
    created_at: new Date().toISOString(),
    status: 'pending_sync' // Status que diz "falta enviar"
  };
  
  // Salva no IndexedDB (Suporta arquivos grandes)
  await localforage.setItem(meetingId, payload);
  return meetingId;
};

// Puxa todas as gravações que estão presas no celular
export const getOfflineMeetings = async () => {
  const keys = await localforage.keys();
  const offlineMeetings = [];
  
  for (const key of keys) {
    if (key.startsWith('local_')) {
      const data = await localforage.getItem(key);
      offlineMeetings.push(data);
    }
  }
  return offlineMeetings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

// Tenta enviar o arquivo preso e, se der certo, deleta do celular!
export const syncOfflineMeeting = async (id) => {
  const data = await localforage.getItem(id);
  if (!data) throw new Error("Ata não encontrada no celular");

  // Tenta o envio real
  await uploadAudio(data.audioBlob, data.template);
  
  // Limpeza de disco do celular!
  await localforage.removeItem(id);
  return true;
};

export const deleteOfflineMeeting = async (id) => {
  await localforage.removeItem(id);
};
