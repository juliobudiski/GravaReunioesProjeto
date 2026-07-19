import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, FileText, Edit3, Save, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getMeetings, updateMeeting } from '../api';

export default function MeetingView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Controles de UX
  const [activeTab, setActiveTab] = useState('summary'); // summary ou transcript
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

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
        
        {/* Barra de Ferramentas (Editar / Salvar) */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {activeTab === 'summary' ? 'Análise da IA' : 'Áudio Original'}
          </span>
          
          {!isEditing ? (
            <button onClick={handleEditClick} className="flex items-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
              <Edit3 size={16} /> Editar Texto
            </button>
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
    </div>
  );
}
