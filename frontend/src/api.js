import localforage from 'localforage';
import { auth } from './firebase'; // NOVO IMPORT DO MOTOR DO FIREBASE

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// FUNÇÃO INTELIGENTE QUE ESPERA E RENOVA O TOKEN
const getHeaders = async () => {
  return new Promise((resolve, reject) => {
    // Escuta o estado do Firebase para ter certeza que ele carregou
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe(); // Para de escutar assim que achar a resposta
      if (user) {
        try {
          // Passar 'true' força o Google a gerar um Token fresco se o antigo estiver quase vencendo!
          const token = await user.getIdToken(true); 
          resolve({ "Authorization": `Bearer ${token}` });
        } catch (error) {
          reject(new Error("Erro ao gerar token seguro."));
        }
      } else {
        // Se o Firebase disser que não tem ninguém logado, tenta pegar o velho do localStorage como última salvação
        const fallbackToken = localStorage.getItem('auth_token');
        resolve({ "Authorization": `Bearer ${fallbackToken}` });
      }
    });
  });
};

export const uploadAudio = async (audioBlob, template) => {
  const formData = new FormData();
  formData.append("audio_file", audioBlob, "gravacao.webm");
  formData.append("template", template);

  const headers = await getHeaders(); // Agora é assíncrono (espera o token)
  
  const response = await fetch(`${API_URL}/meetings`, { 
    method: "POST", 
    headers: headers, 
    body: formData 
  });
  if (!response.ok) throw new Error("Falha ao enviar o áudio");
  return response.json();
};

export const getSettings = async () => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/settings`, { headers });
  if (!response.ok) throw new Error("Falha ao carregar configurações");
  return response.json();
};

export const saveSettings = async (settingsData) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(settingsData),
  });
  if (!response.ok) throw new Error("Falha ao salvar configurações");
  return response.json();
};

export const getMeetings = async () => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/meetings`, { headers });
  if (!response.ok) throw new Error("Falha ao carregar histórico");
  return response.json();
};

export const updateMeeting = async (id, data) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/meetings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Falha ao salvar edição");
  return response.json();
};

export const deleteMeeting = async (id) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/meetings/${id}`, { 
    method: "DELETE",
    headers 
  });
  if (!response.ok) throw new Error("Falha ao excluir ata");
  return response.json();
};

export const regenerateMeeting = async (id, template) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/meetings/${id}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ template }),
  });
  if (!response.ok) throw new Error("Falha ao regenerar ata");
  return response.json();
};

export const fetchAvailableModels = async (provider) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/models?provider=${provider}`, { headers });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Falha ao buscar modelos");
  }
  return response.json();
};

export const chatWithMeeting = async (id, question) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/meetings/${id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error("Falha ao enviar pergunta");
  return response.json();
};

// ==========================================
// MÓDULO OFFLINE (IndexedDB)
// ==========================================

export const saveOfflineMeeting = async (audioBlob, template, title = "Gravado Offline") => {
  const meetingId = `local_${Date.now()}`;
  const payload = {
    id: meetingId, audioBlob, template, title, created_at: new Date().toISOString(), status: 'pending_sync'
  };
  await localforage.setItem(meetingId, payload);
  return meetingId;
};

export const getOfflineMeetings = async () => {
  const keys = await localforage.keys();
  const offlineMeetings = [];
  for (const key of keys) {
    if (key.startsWith('local_')) {
      offlineMeetings.push(await localforage.getItem(key));
    }
  }
  return offlineMeetings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

export const syncOfflineMeeting = async (id) => {
  const data = await localforage.getItem(id);
  if (!data) throw new Error("Ata não encontrada no celular");
  await uploadAudio(data.audioBlob, data.template); 
  await localforage.removeItem(id);
  return true;
};

export const deleteOfflineMeeting = async (id) => {
  await localforage.removeItem(id);
};
