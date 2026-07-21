import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Mic, Settings as SettingsIcon, History, ChevronRight, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast'; // Notificações flutuantes!
import AudioRecorder from './components/AudioRecorder';
import Login from './components/Login';
import Settings from './components/Settings';
import MeetingView from './components/MeetingView';
import { getMeetings, deleteMeeting, getOfflineMeetings, syncOfflineMeeting, deleteOfflineMeeting } from './api';


// O GUARDA-COSTAS DAS TELAS: Só renderiza se tiver o token do Google salvo
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('auth_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

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
    <div className="p-4 pt-8 pb-24 max-w-md mx-auto h-full transition-colors" style={{ color: 'var(--text-primary)' }}>
      <h2 className="text-3xl font-extrabold mb-6">Minhas Atas</h2>
      
      {loading && meetings.length === 0 ? (
        <p className="text-center mt-10 flex items-center justify-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Loader2 className="animate-spin" size={20} /> Carregando...
        </p>
      ) : meetings.length === 0 && offlineMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20 opacity-50">
          <History className="w-16 h-16 mb-4" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Nenhuma reunião gravada ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          
          {/* MÓDULO OFFLINE (Os arquivos presos) */}
          {offlineMeetings.map((m) => (
            <div key={m.id} className="p-4 rounded-2xl shadow-sm border-2 cursor-default transition-colors glass-effect"
                 style={{ backgroundColor: 'var(--bg-card)', borderColor: '#f97316', color: 'var(--text-primary)' }}>
              <div className="flex justify-between items-center mb-2">
                <div className="overflow-hidden pr-4 w-full">
                  <h3 className="font-bold text-lg truncate">Pendente: {m.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f9731633', color: '#ea580c' }}>
                      Salvo Localmente
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={(e) => handleSync(e, m.id)} className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-2 rounded-lg transition-transform active:scale-95 border-none" style={{ backgroundColor: '#f97316' }}>
                  <UploadCloud size={18} /> Enviar Agora
                </button>
                <button onClick={async (e) => { e.stopPropagation(); await deleteOfflineMeeting(m.id); loadData(); }} className="p-2 rounded-lg transition-colors" style={{ backgroundColor: '#ef444422', color: '#ef4444' }}>
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}

          {/* AS REUNIÕES NORMAIS DO FLASK */}
          {meetings.map((m) => (
            <div 
              key={m.id} 
              onClick={() => m.status === 'completed' ? navigate(`/meeting/${m.id}`) : null}
              className={`p-4 rounded-2xl shadow-sm border transition-all glass-effect ${
                m.status === 'processing' ? 'cursor-default' : 
                m.status === 'error' ? 'cursor-not-allowed' : 
                'cursor-pointer hover:shadow-md active:scale-[0.98]'
              }`}
              // A CORREÇÃO DE CORE AQUI: Fundo sempre do tema, borda muda por status!
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: m.status === 'processing' ? 'var(--accent)' : (m.status === 'error' ? '#ef4444' : 'var(--border)'),
                color: 'var(--text-primary)'
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="overflow-hidden pr-4 w-full">
                  <h3 className="font-bold text-lg truncate">
                    {m.status === 'processing' ? 'Processando Áudio...' : m.title || "Sem Título"}
                  </h3>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(m.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    
                    {/* Badge de Status Coerente */}
                    {m.status === 'processing' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                        <Loader2 className="w-3 h-3 animate-spin" /> Em andamento
                      </span>
                    )}
                    {m.status === 'error' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ backgroundColor: '#ef444422', color: '#ef4444' }}>Falhou</span>
                    )}
                  </div>
                </div>
                
                {/* Lixeira e Seta Coerentes com o Tema */}
                <div className="flex gap-2 items-center">
                  <button onClick={(e) => handleTrash(e, m.id)} className="p-2 transition-colors z-10" style={{ color: '#ef4444' }}>
                    <Trash2 size={18}/>
                  </button>
                  {m.status === 'completed' && <ChevronRight className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />}
                </div>
              </div>

              {/* BARRA DE PROGRESSO E LOGS (Só mostra se não completou e não deu erro) */}
              {m.status === 'processing' && (
                <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="w-full rounded-full h-1.5 mb-3 overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                    <div className="h-1.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${m.progress}%`, backgroundColor: 'var(--accent)' }}></div>
                  </div>

                  <details className="text-sm group">
                    <summary className="cursor-pointer font-medium flex items-center outline-none list-none" style={{ color: 'var(--accent)' }}>
                      <span className="group-open:hidden">▶ Ver logs do sistema</span>
                      <span className="hidden group-open:inline">▼ Ocultar logs</span>
                    </summary>
                    {/* Terminalzinho interno (sempre dark style) */}
                    <div className="mt-2 bg-[#0f172a] text-green-400 p-3 rounded-lg text-[11px] font-mono h-32 overflow-y-auto shadow-inner flex flex-col gap-1">
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
      <Toaster position="top-center" />
      <div className="min-h-screen font-sans selection:bg-blue-200 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div className="h-full">
          <Routes>
            {/* TELA DE LOGIN ABERTA */}
            <Route path="/login" element={<Login />} />
            
            {/* TELAS PROTEGIDAS */}
            <Route path="/" element={<ProtectedRoute><div className="pt-10 flex flex-col items-center justify-center min-h-[80vh]"><AudioRecorder /></div></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryScreen /></ProtectedRoute>} />
            <Route path="/meeting/:id" element={<ProtectedRoute><MeetingView /></ProtectedRoute>} />
          </Routes>
        </div>
        
        {/* Passa o ProtectedRoute pro Menu também para não vazar */}
        <Routes>
          <Route path="/login" element={null} />
          <Route path="*" element={<ProtectedRoute><BottomNav /></ProtectedRoute>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
