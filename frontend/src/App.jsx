import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Mic, Settings as SettingsIcon, History, ChevronRight, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast'; // Notificações flutuantes!
import AudioRecorder from './components/AudioRecorder';
import Settings from './components/Settings';
import MeetingView from './components/MeetingView';
import { getMeetings, deleteMeeting, getOfflineMeetings, syncOfflineMeeting, deleteOfflineMeeting } from './api';

// A TELA DE HISTÓRICO COM ATUALIZAÇÃO EM TEMPO REAL (POLLING)
function HistoryScreen() {
  const [meetings, setMeetings] = useState([]);
  const [offlineMeetings, setOfflineMeetings] = useState([]); // NOVO ESTADO
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const data = await getMeetings();
      setMeetings(data);
      
      // Carrega os arquivos presos no celular
      const localData = await getOfflineMeetings();
      setOfflineMeetings(localData);
    } catch (error) {
      console.error("Erro", error);
    } finally {
      setLoading(false);
    }
  };
    const handleTrash = async (e, id) => {
    e.stopPropagation(); // Evita que o clique na lixeira abra a página da Ata
    if(window.confirm("Apagar esta ata permanentemente?")) {
      try {
        await deleteMeeting(id);
        toast.success("Ata apagada!");
        loadData(); // Recarrega a lista
      } catch (err) {
        toast.error("Erro ao apagar");
      }
    }
  };
  const handleSync = async (e, localId) => {
    e.stopPropagation();
    if (!navigator.onLine) {
      toast.error("Você precisa estar conectado à internet!");
      return;
    }
    
    const toastId = toast.loading("Enviando áudio gigante para a nuvem...");
    try {
      await syncOfflineMeeting(localId);
      toast.success("Sincronizado com sucesso! IA trabalhando...", { id: toastId });
      loadData(); // Atualiza a tela
    } catch (error) {
      toast.error("Falha ao sincronizar.", { id: toastId });
    }
  };

  useEffect(() => {
    // Carrega a primeira vez imediatamente
    loadData();

    // Configura o Polling: Pergunta ao servidor a cada 3 segundos
    const interval = setInterval(() => {
      loadData();
    }, 3000);

    // QA: Limpa o intervalo se o usuário mudar de tela para não travar o celular
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 pt-8 pb-24 max-w-md mx-auto h-full">
      <h2 className="text-3xl font-extrabold text-gray-800 mb-6">Minhas Atas</h2>
      
      {loading && meetings.length === 0 ? (
        <p className="text-center text-gray-500 mt-10 flex items-center justify-center gap-2">
          <Loader2 className="animate-spin" size={20} /> Carregando...
        </p>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20 opacity-50">
          <History className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-gray-500">Nenhuma reunião gravada ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
                    {/* MÓDULO OFFLINE (Os arquivos presos) */}
          {offlineMeetings.map((m) => (
            <div key={m.id} className="p-4 rounded-2xl shadow-sm border-2 border-orange-200 bg-orange-50 cursor-default">
              <div className="flex justify-between items-center mb-2">
                <div className="overflow-hidden pr-4 w-full">
                  <h3 className="font-bold text-gray-800 text-lg">Pendente: {m.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-orange-600 font-bold uppercase border border-orange-400 px-2 rounded-full">
                      Salvo Apenas no Celular
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={(e) => handleSync(e, m.id)} className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg transition-transform active:scale-95">
                  <UploadCloud size={18} /> Enviar Agora
                </button>
                <button onClick={async (e) => { e.stopPropagation(); await deleteOfflineMeeting(m.id); loadData(); }} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
          {meetings.map((m) => (
            <div 
              key={m.id} 
              onClick={() => m.status === 'completed' ? navigate(`/meeting/${m.id}`) : null}
              // O className cuida dos preenchimentos (p-4), bordas, sombras e cursor
              className={`p-4 rounded-2xl shadow-sm border transition-all ${
                m.status === 'processing' 
                  ? 'cursor-default' 
                  : m.status === 'error'
                  ? 'cursor-not-allowed'
                  : 'cursor-pointer hover:shadow-md active:scale-[0.98]'
              }`}
              // O style cuida exclusivamente das cores (lendo o tema ou forçando vermelho/azul)
              style={{
                backgroundColor: m.status === 'processing' ? '#eff6ff' : (m.status === 'error' ? '#fef2f2' : 'var(--bg-card)'),
                borderColor: m.status === 'processing' ? '#bfdbfe' : (m.status === 'error' ? '#fecaca' : 'var(--border)'),
                color: 'var(--text-primary)'
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="overflow-hidden pr-4 w-full">
                  <h3 className="font-bold text-gray-800 text-lg truncate">
                    {m.status === 'processing' ? 'Processando Áudio...' : m.title || "Sem Título"}
                  </h3>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 font-medium">
                      {new Date(m.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    
                    {m.status === 'processing' && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> {m.progress}%
                      </span>
                    )}
                    {m.status === 'error' && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase">Falhou</span>
                    )}
                  </div>
                </div>
                  <div className="flex gap-2">
                      <button onClick={(e) => handleTrash(e, m.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={20}/></button>
                      {m.status === 'completed' && <ChevronRight className="text-gray-300 w-6 h-6 flex-shrink-0 mt-2" />}
                  </div>
              </div>

              {/* BARRA DE PROGRESSO E LOGS (Visível apenas se não estiver completada) */}
              {m.status !== 'completed' && (
                <div className="mt-4 border-t border-blue-100 pt-3">
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-blue-200/50 rounded-full h-1.5 mb-3 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-500 ease-out ${m.status === 'error' ? 'bg-red-500' : 'bg-blue-600'}`} 
                      style={{ width: `${m.progress}%` }}
                    ></div>
                  </div>

                  {/* Terminal de Logs (Accordion Nativo) */}
                  <details className="text-sm group">
                    <summary className="text-blue-600 cursor-pointer font-medium hover:text-blue-800 flex items-center outline-none list-none">
                      <span className="group-open:hidden">▶ Ver logs do sistema</span>
                      <span className="hidden group-open:inline">▼ Ocultar logs</span>
                    </summary>
                    <div className="mt-2 bg-gray-900 text-green-400 p-3 rounded-lg text-[11px] font-mono h-32 overflow-y-auto shadow-inner flex flex-col gap-1">
                      {m.step_logs && m.step_logs.length > 0 ? (
                        m.step_logs.map((log, idx) => (
                          <div key={idx} className="border-b border-gray-800 pb-1">
                            <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-500 animate-pulse">Aguardando servidor...</div>
                      )}
                    </div>
                  </details>
                  
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// O Menu Inferior (Bottom Navigation)
function BottomNav() {
  const location = useLocation();
  if (location.pathname.startsWith('/meeting/')) return null;
  const isActive = (path) => location.pathname === path ? "text-blue-600" : "text-gray-400 hover:text-gray-600";

  return (
    <div className="fixed bottom-0 w-full border-t pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-40 transition-colors" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        <Link to="/history" className={`flex flex-col items-center gap-1 w-20 transition-colors ${isActive('/history')}`}>
          <History size={24} />
          <span className="text-[10px] font-semibold tracking-wide">Histórico</span>
        </Link>
        <Link to="/" className="relative -top-5 flex flex-col items-center justify-center w-16 h-16 rounded-full bg-blue-600 shadow-lg text-white hover:bg-blue-700 transition-transform active:scale-95">
          <Mic size={28} />
        </Link>
        <Link to="/settings" className={`flex flex-col items-center gap-1 w-20 transition-colors ${isActive('/settings')}`}>
          <SettingsIcon size={24} />
          <span className="text-[10px] font-semibold tracking-wide">Ajustes</span>
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* O Toaster é o gerenciador de notificações no topo da tela */}
      <Toaster position="top-center" reverseOrder={false} />
      
      <div className="min-h-screen font-sans selection:bg-blue-200 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div className="h-full">
          <Routes>
            <Route path="/" element={<div className="pt-10 flex flex-col items-center justify-center min-h-[80vh]"><AudioRecorder /></div>} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/history" element={<HistoryScreen />} />
            <Route path="/meeting/:id" element={<MeetingView />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
