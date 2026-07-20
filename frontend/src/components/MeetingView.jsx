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
  const [isCopied, setIsCopied] = useState(false);
  // Controles de UX
  const [activeTab, setActiveTab] = useState('summary'); // summary ou transcript
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  
  // Estados do Chat (US19)
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef(null);

  // Faz o scroll descer sozinho no chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

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
      toast.error("Erro ao falar com a IA");
      setChatMessages(prev => [...prev, { role: 'bot', text: "❌ Desculpe, não consegui processar a resposta." }]);
    } finally {
      setIsChatting(false);
    }
  };

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

  const handleEditClick = () => {
    setEditContent(activeTab === 'summary' ? meeting.summary : meeting.full_transcript);
    setIsEditing(true);
  };

  const handleSaveClick = async () => {
    try {
      const payload = activeTab === 'summary' 
        ? { summary: editContent } 
        : { full_transcript: editContent };
        
      await updateMeeting(id, payload);
      
      // Atualiza o estado local para mostrar a mudança na hora
      setMeeting({
        ...meeting,
        [activeTab === 'summary' ? 'summary' : 'full_transcript']: editContent
      });
      setIsEditing(false);
    } catch (error) {
      alert("Erro ao salvar!");
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando ata...</div>;
  if (!meeting) return <div className="p-8 text-center text-red-500">Ata não encontrada!</div>;
  // Função para Copiar para Área de Transferência
  const handleCopy = () => {
    const textToCopy = activeTab === 'summary' ? meeting.summary : meeting.full_transcript;
    if (!textToCopy) {
      toast.error("Nada para copiar!");
      return;
    }
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast.success("Copiado!");
        setIsCopied(true);
        // O Ícone volta ao normal depois de 2 segundos!
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(() => toast.error("Falha ao copiar."));
  };

  // Função para Baixar como Arquivo TXT
  const handleDownload = () => {
    const textToDownload = activeTab === 'summary' ? meeting.summary : meeting.full_transcript;
    if (!textToDownload) return;
    
    // Cria um arquivo virtual na memória do navegador
    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Cria um link falso, clica nele e deleta (truque de HTML)
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title || 'Ata_Synapse'}_${activeTab}.txt`;
    a.click();
    
    URL.revokeObjectURL(url);
    toast.success("Download iniciado!");
  };

  return (
    <div className="bg-white min-h-screen pb-24">
      {/* Header Fixo */}
      <div className="bg-blue-600 text-white p-4 pt-8 sticky top-0 z-20 shadow-md">
        <button onClick={() => navigate('/history')} className="flex items-center gap-2 font-semibold active:scale-95">
          <ArrowLeft size={20} /> Voltar
        </button>
        <h1 className="text-2xl font-bold mt-4 leading-tight truncate">{meeting.title || "Sem Título"}</h1>
        <div className="flex items-center gap-2 text-blue-100 text-sm mt-2">
          <Clock size={14} /> {new Date(meeting.created_at).toLocaleString('pt-BR')}
        </div>
      </div>

      {/* Sistema de Abas (Tabs) */}
      <div className="flex border-b border-gray-200 sticky top-[112px] bg-white z-10">
        <button 
          onClick={() => { setActiveTab('summary'); setIsEditing(false); }}
          className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'summary' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
        >
          Resumo e Tarefas
        </button>
        <button 
          onClick={() => { setActiveTab('transcript'); setIsEditing(false); }}
          className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'transcript' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
        >
          Transcrição Completa
        </button>
      </div>

      {/* Área de Conteúdo */}
      <div className="p-4 max-w-2xl mx-auto">
        
        {/* Barra de Ferramentas (Editar / Salvar / Exportar) */}
        <div className="flex justify-between items-center mb-4 overflow-x-auto pb-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex-shrink-0 mr-4">
            {activeTab === 'summary' ? 'Análise da IA' : 'Áudio Original'}
          </span>
          
          {!isEditing ? (
            <div className="flex gap-2 flex-shrink-0">
              
              {/* BOTÃO DE COPIAR COM MICRO-INTERAÇÃO */}
              <button 
                onClick={handleCopy} 
                className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition-colors ${isCopied ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`} 
                title="Copiar Texto"
              >
                {isCopied ? <Check size={16} className="animate-pulse" /> : <Copy size={16} />}
              </button>
              <button onClick={handleDownload} className="flex items-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors mr-2" title="Baixar Arquivo">
                <Download size={16} /> 
              </button>
              
              {/* BOTÃO DO CHAT */}
              <button onClick={() => setShowChat(true)} className="flex items-center gap-1 text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors font-semibold mr-2">
                <MessageSquare size={16} /> Chat
              </button>
              
              <button onClick={() => setShowRegenerateModal(true)} className="flex items-center gap-1 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                <Wand2 size={16} /> Regenerar 
              </button>
              <button onClick={handleEditClick} className="flex items-center gap-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                <Edit3 size={16} /> Editar
              </button>
            </div>
          ) : (          
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)} className="flex items-center gap-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors">
                <X size={16} /> Cancelar
              </button>
              <button onClick={handleSaveClick} className="flex items-center gap-1 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                <Save size={16} /> Salvar
              </button>
            </div>
          )}
        </div>

        {/* Renderização do Texto ou Caixa de Edição */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 shadow-inner min-h-[50vh]">
          {isEditing ? (
            <textarea 
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-[60vh] bg-transparent outline-none resize-none font-mono text-sm text-gray-800 leading-relaxed"
              autoFocus
            />
          ) : (
            <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
              {activeTab === 'summary' ? (
                meeting.summary ? <ReactMarkdown>{meeting.summary}</ReactMarkdown> : <p className="italic text-gray-400">Nenhum resumo disponível.</p>
              ) : (
                meeting.full_transcript ? (
                  <div className="whitespace-pre-wrap font-serif">{meeting.full_transcript}</div>
                ) : <p className="italic text-gray-400">Nenhuma transcrição disponível.</p>
              )}
            </div>
          )}
        </div>
      </div>
      {/* MODAL DO CHAT CONTEXTUAL (US19) */}
      {showChat && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50 transition-opacity">
          <div className="bg-white w-full max-w-md h-full sm:h-[80vh] sm:mt-auto sm:rounded-t-3xl shadow-2xl flex flex-col animate-slide-up" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
            
            {/* Header do Chat */}
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 text-indigo-600">
                <MessageSquare size={20} />
                <h3 className="font-bold">Chat com a Reunião</h3>
              </div>
              <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-red-500">
                <X size={24} />
              </button>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-sm mt-10 opacity-60">
                  <Bot size={40} className="mx-auto mb-2 opacity-50" />
                  <p>Pergunte qualquer coisa sobre esta ata!</p>
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'bot' && <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600"><Bot size={18} /></div>}
                  <div className={`p-3 rounded-2xl max-w-[80%] text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`} style={msg.role === 'bot' ? { backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' } : {}}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white"><User size={18} /></div>}
                </div>
              ))}
              {isChatting && (
                <div className="flex gap-3 justify-start animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600"><Bot size={18} /></div>
                  <div className="p-3 rounded-2xl bg-gray-100 rounded-tl-none text-sm text-gray-500" style={{ backgroundColor: 'var(--bg-primary)' }}>Pensando...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input de Pergunta */}
            <div className="p-4 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
              <input 
                type="text" 
                placeholder="Ex: O que foi decidido sobre o projeto?" 
                value={currentQuestion}
                onChange={(e) => setCurrentQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                className="flex-1 rounded-xl px-4 py-3 outline-none text-sm border focus:border-indigo-500 transition-colors"
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
              />
              <button 
                onClick={handleSendChat} 
                disabled={isChatting || !currentQuestion.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white w-12 h-12 flex items-center justify-center rounded-xl transition-all active:scale-95"
              >
                <Send size={18} />
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
