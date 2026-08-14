import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Lock, Unlock, UploadCloud, AlertTriangle, WifiOff, X, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  uploadAudio, 
  saveOfflineMeeting, 
  startLiveBackup, 
  saveLiveChunk, 
  finalizeLiveBackup, 
  checkForOrphanBackups 
} from '../api';

export default function AudioRecorder() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [template, setTemplate] = useState("Padrão (Resumo e Tarefas)");
  
  const [orphanFound, setOrphanFound] = useState(null);
  const [micError, setMicError] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [selectedFiles, setSelectedFiles] = useState([]);

  const mediaRecorderRef = useRef(null);
  const wakeLockRef = useRef(null);
  const timerRef = useRef(null);
  const unlockIntervalRef = useRef(null);
  const currentMeetingIdRef = useRef(null);
  const fileInputRef = useRef(null);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- IGNORADOS OS DETALHES DE LOCK/WAKELOCK PARA BREVIDADE ---
  const requestWakeLock = async () => { try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch (err) {} };
  const releaseWakeLock = () => { if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; } };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const checkRecovery = async () => {
      const orphanId = await checkForOrphanBackups();
      if (orphanId) setOrphanFound(orphanId);
    };
    checkRecovery();
  }, []);

  const handleRecover = async () => { /* ... */ };
  const handleDiscardOrphan = async () => { /* ... */ };


  // ==========================================
  // O SISTEMA RASTREÁVEL (DEBUG MODE)
  // ==========================================
  
  

  const handleFileSelect = (e) => {
    console.log("👉 [DEBUG 3] Janela fechada. Evento 'onChange' do input disparado!");
    
    try {
      const filesObj = e.target.files;
      console.log("👉 [DEBUG 4] O que o SO devolveu? ->", filesObj);

      if (!filesObj || filesObj.length === 0) {
        console.warn("⚠️ [DEBUG 5] O objeto files está vazio. O usuário cancelou a janela ou o SO bloqueou o arquivo.");
        return;
      }

      console.log(`👉 [DEBUG 6] Encontrados ${filesObj.length} arquivo(s). Formatando para o React...`);
      const newFilesArray = Array.from(filesObj);
      
      console.log("👉 [DEBUG 7] Inspeção do Arquivo [0]:", newFilesArray[0].name, "| Tamanho:", newFilesArray[0].size, "| Tipo:", newFilesArray[0].type);
      
      toast.success(`${newFilesArray.length} arquivo(s) processado(s) pelo navegador.`);
      setSelectedFiles(prevFiles => [...prevFiles, ...newFilesArray]);
      
      console.log("✅ [DEBUG 8] Arquivos enviados com sucesso para a Fila do React!");

    } catch (err) {
      console.error("❌ [DEBUG ERRO CRÍTICO] Falha no processamento do arquivo:", err);
      toast.error("Erro interno ao ler arquivo.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
        console.log("🧹 [DEBUG 9] Input de arquivos limpo.");
      }
    }
  };



  const handleRemoveFile = (indexToRemove) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleSendFila = async () => {
    if (selectedFiles.length === 0) return;

    if (isOnline) {
      setStatusMsg(`⏳ Enviando ${selectedFiles.length} arquivo(s)...`);
      const toastId = toast.loading(`Fazendo upload de ${selectedFiles.length} áudio(s)...`);
      try {
        await uploadAudio(selectedFiles, template);
        toast.success(`Arquivos enviados para a IA!`, { id: toastId });
        setSelectedFiles([]);
        navigate('/history');
      } catch (error) {
        toast.error("Erro no servidor. Salvando no aparelho...", { id: toastId });
        await saveOfflineMeeting(selectedFiles, template, `${selectedFiles.length} Arquivos Upload`);
        setSelectedFiles([]);
        navigate('/history');
      }
    } else {
      setStatusMsg("📡 Offline: Salvando localmente...");
      await saveOfflineMeeting(selectedFiles, template, `${selectedFiles.length} Arquivos Upload`);
      toast.success("Salvos no aparelho com sucesso!");
      setSelectedFiles([]);
      navigate('/history');
    }
  };

  // ==========================================
  // GRAVAÇÃO AO VIVO
  // ==========================================
  const startRecording = async () => {
    try {
      setMicError(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      currentMeetingIdRef.current = `live_${Date.now()}`;
      await startLiveBackup(currentMeetingIdRef.current, template);
      
      mediaRecorderRef.current.ondataavailable = async (e) => { 
        if (e.data.size > 0) await saveLiveChunk(currentMeetingIdRef.current, e.data); 
      };
      
      mediaRecorderRef.current.onstop = async () => {
        setStatusMsg("⏳ Processando...");
        const finalBlob = await finalizeLiveBackup(currentMeetingIdRef.current);
        currentMeetingIdRef.current = null;
        if (finalBlob) {
          if (isOnline) {
            const toastId = toast.loading("Enviando gravação...");
            try { await uploadAudio(finalBlob, template); toast.success("Enviado!", { id: toastId }); navigate('/history'); } 
            catch (error) { toast.error("Erro no envio. Salvo localmente!", { id: toastId }); await saveOfflineMeeting(finalBlob, template, "Gravado Localmente"); navigate('/history'); }
          } else {
            toast.success("Offline: Salvo no celular!");
            await saveOfflineMeeting(finalBlob, template, "Gravado Offline");
            navigate('/history');
          }
        }
      };
      
      mediaRecorderRef.current.start(1000);
      setIsRecording(true); setIsLocked(true); setStatusMsg("Gravando...");
      await requestWakeLock();
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch (error) { 
      setMicError(true); 
      toast.error("Permissão de microfone negada!"); 
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop()); }
    clearInterval(timerRef.current); setIsRecording(false); setIsLocked(false); releaseWakeLock();
  };

  const handlePointerDown = () => {
    setUnlockProgress(0);
    unlockIntervalRef.current = setInterval(() => {
      setUnlockProgress(prev => { if (prev >= 100) { clearInterval(unlockIntervalRef.current); setIsLocked(false); return 100; } return prev + 5; });
    }, 50);
  };
  const handlePointerUp = () => { clearInterval(unlockIntervalRef.current); if (unlockProgress < 100) setUnlockProgress(0); };
  useEffect(() => { return () => { clearInterval(timerRef.current); clearInterval(unlockIntervalRef.current); }; }, []);

  // ==========================================
  // RENDERIZAÇÃO
  // ==========================================

  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50 text-white select-none">
        <Lock className="w-12 h-12 text-red-500 mb-4 animate-pulse" />
        <h2 className="text-5xl font-mono font-light mb-2">{formatTime(recordingTime)}</h2>
        <div className="flex flex-col items-center justify-center mt-16">
          <button onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} className="relative w-32 h-32 rounded-full flex items-center justify-center border-4 border-gray-700 bg-gray-800 touch-none">
            <div className="absolute bottom-0 w-full bg-green-500/30" style={{ height: `${unlockProgress}%` }}></div>
            <Unlock className={`w-10 h-10 z-10 ${unlockProgress > 50 ? 'text-green-400' : 'text-gray-400'}`} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl shadow-xl w-full max-w-sm border relative transition-colors" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
    
      
      {orphanFound && (
        <div className="absolute -top-24 w-full bg-red-50 border border-red-200 p-4 rounded-2xl shadow-lg z-20">
          <div className="flex items-center gap-2 text-red-600 font-bold mb-2"><AlertTriangle size={18} /> Aba Fechada!</div>
          <div className="flex gap-2">
            <button onClick={handleRecover} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-bold">Resgatar</button>
            <button onClick={handleDiscardOrphan} className="flex-1 bg-red-200 text-red-700 py-2 rounded-lg text-xs font-bold">Descartar</button>
          </div>
        </div>
      )}

      {/* A FILA DE ARQUIVOS (CARRINHO VISÍVEL) */}
      {selectedFiles.length > 0 && (
        <div className="absolute -top-32 w-full border p-4 rounded-2xl shadow-xl z-20 max-h-48 overflow-y-auto" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--accent)' }}>
          <h3 className="text-xs font-bold uppercase mb-2 flex items-center justify-between" style={{ color: 'var(--accent)' }}>
            Fila de Áudios ({selectedFiles.length})
            <button onClick={() => setSelectedFiles([])} className="text-red-500 hover:text-red-700">Limpar</button>
          </h3>
          <div className="flex flex-col gap-2 mb-3">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 rounded border text-xs" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
                <span className="truncate w-3/4">{file.name}</span>
                <button onClick={() => handleRemoveFile(idx)} className="text-red-500"><X size={14}/></button>
              </div>
            ))}
          </div>
          <button onClick={handleSendFila} className="w-full text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95" style={{ backgroundColor: 'var(--accent)' }}>
            <Send size={18} /> ENVIAR TUDO
          </button>
        </div>
      )}

      <div className="w-full mb-6">
        <label className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>Foco da IA</label>
        <select value={template} onChange={(e) => setTemplate(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none border" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
          <option value="Padrão (Resumo e Tarefas)">Padrão (Resumo e Tarefas)</option>
          <option value="Brainstorming (Lista de Ideias e Insights)">Brainstorming (Lista de Ideias e Insights)</option>
          <option value="Entrevista (Perguntas e Respostas)">Entrevista (Perguntas e Respostas)</option>
        </select>
      </div>

      <div className="text-6xl font-mono mb-8 font-light tracking-tighter">{formatTime(recordingTime)}</div>

      <div className="flex items-center justify-center gap-6 w-full">
        
        {/* BOTÃO DA NUVEM (INFALÍVEL - NATIVO COM LABEL PARA O FIREFOX) */}
        <div className="flex-1 flex justify-end">
          <label 
            className="w-14 h-14 rounded-full flex items-center justify-center border transition-transform hover:scale-105 shadow-sm cursor-pointer" 
            style={{ 
              backgroundColor: 'var(--bg-primary)', 
              borderColor: 'var(--border)', 
              color: 'var(--text-secondary)',
              opacity: isRecording ? 0.5 : 1,
              pointerEvents: isRecording ? 'none' : 'auto'
            }}
            title="Adicionar Áudio à Fila"
          >
            <UploadCloud className="w-6 h-6" />
            <input 
              type="file" 
              multiple={true} 
              className="hidden" 
              // O input perdeu o ref e continua com o onChange limpo:
              onChange={handleFileSelect} 
            />
          </label>
        </div>


        {/* GRAVAR / PARAR E ERROS */}
        <div className="flex-none">
          {!isOnline ? (
            <div className="flex flex-col items-center p-4 bg-red-50 text-red-600 rounded-2xl"><WifiOff size={32} /></div>
          ) : micError ? (
            <div className="flex flex-col items-center p-2 bg-yellow-50 text-yellow-600 rounded-2xl cursor-pointer" onClick={() => { setMicError(false); startRecording(); }}>
              <AlertTriangle size={24} className="mb-1 animate-pulse" />
              <span className="text-[10px] font-bold text-center">Permitir Mic</span>
            </div>
          ) : !isRecording ? (
            <button onClick={startRecording} className="w-24 h-24 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95" style={{ backgroundColor: 'var(--accent)' }}><Mic className="w-10 h-10" /></button>
          ) : (
            <button onClick={stopRecording} className="w-24 h-24 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg animate-pulse"><Square className="w-8 h-8 fill-current" /></button>
          )}
        </div>
        <div className="flex-1"></div>
      </div>
      
      <div className="mt-8 h-6 text-sm font-medium animate-pulse" style={{ color: 'var(--accent)' }}>{statusMsg}</div>
    </div>
  );
}
