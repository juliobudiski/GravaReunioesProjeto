import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, FileText, Edit3, Save, X, Wand2, Loader2, Copy, Download, Check, MessageSquare, Send, User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getMeetings, updateMeeting, regenerateMeeting, chatWithMeeting } from '../api';
import { toast } from 'react-hot-toast';

export default function MeetingView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('summary'); 
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // Estados do Regenerar
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [newTemplate, setNewTemplate] = useState("Brainstorming (Lista de Ideias e Insights)");

  // Estados do Chat Contextual
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const data = await getMeetings();
        const found = data.find(m => m.id === id);
        setMeeting(found);
      } catch (error) { console.error("Erro", error); } 
      finally { setLoading(false); }
    };
    fetchMeeting();
  }, [id]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleEditClick = () => {
    setEditContent(activeTab === 'summary' ? meeting.summary : meeting.full_transcript);
    setIsEditing(true);
  };

  const handleSaveClick = async () => {
    try {
      const payload = activeTab === 'summary' ? { summary: editContent } : { full_transcript: editContent };
      await updateMeeting(id, payload);
      setMeeting({ ...meeting, [activeTab === 'summary' ? 'summary' : 'full_transcript']: editContent });
      setIsEditing(false);
      toast.success("Salvo!");
    } catch (error) { toast.error("Erro ao salvar!"); }
  };

  const handleCopy = () => {
    const textToCopy = activeTab === 'summary' ? meeting.summary : meeting.full_transcript;
    if (!textToCopy) return toast.error("Nada para copiar!");
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.success("Copiado!");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const textToDownload = activeTab === 'summary' ? meeting.summary : meeting.full_transcript;
    if (!textToDownload) return;
    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title || 'Ata'}_${activeTab}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    const toastId = toast.loading("A IA está reescrevendo...");
    try {
      const data = await regenerateMeeting(id, newTemplate);
      setMeeting({ ...meeting, title: data.new_title, summary: data.new_summary, template_used: newTemplate });
      toast.success("Ata reescrita!", { id: toastId });
      setShowRegenerateModal(false);
    } catch (error) { toast.error("Erro na comunicação", { id: toastId }); } 
    finally { setIsRegenerating(false); }
  };

  const handleSendChat = async () => {
    if (!currentQuestion.trim()) return;
    const userMsg = { role: 'user', text: currentQuestion };
    setChatMessages(prev => [...prev, userMsg]);
    setCurrentQuestion("");
    setIsChatting(true);
    try {
      const data = await chatWithMeeting(id, userMsg.text);
      setChatMessages(prev => [...prev, { role: 'bot', text: data.answer }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'bot', text: "❌ Desculpe, não consegui processar a resposta." }]);
    } finally {
      setIsChatting(false);
    }
  };

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Carregando ata...</div>;
  if (!meeting) return <div className="p-8 text-center text-red-500">Ata não encontrada!</div>;

  return (
    // Fundo Principal Dinâmico
    <div className="min-h-screen pb-24 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      
      {/* Header Fixo Dinâmico */}
      <div className="p-4 pt-8 sticky top-0 z-20 shadow-sm border-b transition-colors glass-effect" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <button onClick={() => navigate('/history')} className="flex items-center gap-2 font-semibold active:scale-95 transition-transform" style={{ color: 'var(--accent)' }}>
          <ArrowLeft size={20} /> Voltar
        </button>
        <h1 className="text-2xl font-bold mt-4 leading-tight truncate">{meeting.title || "Sem Título"}</h1>
        <div className="flex items-center gap-2 text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          <Clock size={14} /> {new Date(meeting.created_at).toLocaleString('pt-BR')}
        </div>
      </div>

      {/* Sistema de Abas (Tabs) */}
      <div className="flex border-b sticky top-[112px] z-10 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
        <button 
          onClick={() => { setActiveTab('summary'); setIsEditing(false); }}
          className="flex-1 py-4 text-sm font-bold text-center border-b-2 transition-all"
          style={{ borderColor: activeTab === 'summary' ? 'var(--accent)' : 'transparent', color: activeTab === 'summary' ? 'var(--accent)' : 'var(--text-secondary)' }}
        > Resumo e Tarefas </button>
        <button 
          onClick={() => { setActiveTab('transcript'); setIsEditing(false); }}
          className="flex-1 py-4 text-sm font-bold text-center border-b-2 transition-all"
          style={{ borderColor: activeTab === 'transcript' ? 'var(--accent)' : 'transparent', color: activeTab === 'transcript' ? 'var(--accent)' : 'var(--text-secondary)' }}
        > Transcrição </button>
      </div>

      {/* Área de Conteúdo */}
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4 overflow-x-auto pb-2">
          <span className="text-xs font-bold uppercase tracking-wider flex-shrink-0 mr-4" style={{ color: 'var(--text-secondary)' }}>
            {activeTab === 'summary' ? 'Análise da IA' : 'Áudio Original'}
          </span>
          
          {!isEditing ? (
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleCopy} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: 'var(--border)', backgroundColor: isCopied ? '#22c55e22' : 'var(--bg-card)' }}>
                {isCopied ? <Check size={16} className="text-green-500 animate-pulse"/> : <Copy size={16} style={{ color: 'var(--text-primary)' }}/>} 
              </button>
              <button onClick={handleDownload} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border transition-colors mr-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
                <Download size={16} style={{ color: 'var(--text-primary)' }}/> 
              </button>
              
              <button onClick={() => setShowChat(true)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border transition-colors font-semibold" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'transparent' }}>
                <MessageSquare size={16} /> Chat
              </button>
              <button onClick={() => setShowRegenerateModal(true)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border transition-colors font-semibold" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
                <Wand2 size={16} /> Regerar
              </button>
              <button onClick={handleEditClick} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border transition-colors font-semibold" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
                <Edit3 size={16} /> Editar
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: '#ef4444', color: '#ef4444' }}><X size={16} /> Cancelar</button>
              <button onClick={handleSaveClick} className="flex items-center gap-1 text-sm text-white px-3 py-1.5 rounded-lg border-none" style={{ backgroundColor: 'var(--accent)' }}><Save size={16} /> Salvar</button>
            </div>
          )}
        </div>

        {/* Caixa de Texto Dinâmica */}
        <div className="p-4 rounded-2xl border shadow-inner min-h-[50vh] transition-colors" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {isEditing ? (
            <textarea 
              value={editContent} onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-[60vh] bg-transparent outline-none resize-none font-mono text-sm leading-relaxed"
              style={{ color: 'var(--text-primary)' }} autoFocus
            />
          ) : (
            <div className="prose prose-sm max-w-none leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {activeTab === 'summary' ? (
                meeting.summary ? <ReactMarkdown>{meeting.summary}</ReactMarkdown> : <p className="italic opacity-50">Nenhum resumo disponível.</p>
              ) : (
                meeting.full_transcript ? <div className="whitespace-pre-wrap font-serif opacity-90">{meeting.full_transcript}</div> : <p className="italic opacity-50">Nenhuma transcrição disponível.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE REGENERAÇÃO */}
      {showRegenerateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="text-xl font-bold mb-2">Mudança de Foco da IA</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>A IA reescreverá o texto sem ouvir o áudio novamente.</p>
            <select value={newTemplate} onChange={(e) => setNewTemplate(e.target.value)} className="w-full rounded-lg px-3 py-3 text-sm outline-none border mb-6" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              <option value="Padrão (Resumo e Tarefas)">Padrão (Resumo e Tarefas)</option>
              <option value="Brainstorming (Lista de Ideias e Insights)">Brainstorming (Lista de Ideias e Insights)</option>
              <option value="Entrevista (Perguntas e Respostas)">Entrevista (Perguntas e Respostas)</option>
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRegenerateModal(false)} className="px-4 py-2 text-sm font-semibold opacity-70 hover:opacity-100">Cancelar</button>
              <button onClick={handleRegenerate} className="flex items-center gap-2 px-5 py-2 text-sm text-white rounded-lg shadow font-semibold" style={{ backgroundColor: 'var(--accent)' }}>
                {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Reescrever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO CHAT (US19) */}
      {showChat && (
        <div className="fixed inset-0 bg-black/70 flex justify-end z-50">
          <div className="w-full max-w-md h-full sm:h-[80vh] sm:mt-auto sm:rounded-t-3xl shadow-2xl flex flex-col border-t border-l" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--accent)' }}><MessageSquare size={20} /> Chat com a Reunião</div>
              <button onClick={() => setShowChat(false)} className="hover:opacity-70"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {chatMessages.length === 0 && <div className="text-center text-sm mt-10 opacity-50"><Bot size={40} className="mx-auto mb-2" /><p>Pergunte sobre a ata!</p></div>}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'bot' && <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--bg-primary)' }}><Bot size={18} /></div>}
                  <div className={`p-3 rounded-2xl max-w-[80%] text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'text-white rounded-tr-none' : 'rounded-tl-none border'}`} style={msg.role === 'user' ? { backgroundColor: 'var(--accent)' } : { backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  {msg.role === 'user' && <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: 'var(--accent)' }}><User size={18} /></div>}
                </div>
              ))}
              {/* O FEEDBACK VISUAL RECUPERADO AQUI! */}
              {isChatting && (
                <div className="flex gap-3 justify-start animate-pulse">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--bg-primary)' }}><Bot size={18} /></div>
                  <div className="p-3 rounded-2xl border rounded-tl-none text-sm font-medium" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    A IA está pensando...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
              <input type="text" value={currentQuestion} onChange={(e) => setCurrentQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendChat()} className="flex-1 rounded-xl px-4 py-3 outline-none text-sm border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} placeholder="Sua pergunta..." />
              <button onClick={handleSendChat} disabled={isChatting || !currentQuestion.trim()} className="text-white w-12 h-12 flex items-center justify-center rounded-xl disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
