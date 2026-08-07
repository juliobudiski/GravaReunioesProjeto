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
  
  // NOVO: A FILA DE ARQUIVOS DO CELULAR
  const [selectedFiles, setSelectedFiles] = useState([]);

  const mediaRecorderRef = useRef(null);
  const wakeLockRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const unlockIntervalRef = useRef(null);
  const currentMeetingIdRef = useRef(null);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const requestWakeLock = async () => { try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch (err) {} };
  const releaseWakeLock = () => { if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; } };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const handleBeforeUnload = (e) => { if (isRecording) { e.preventDefault(); e.returnValue = ''; return ''; } };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRecording]);

  useEffect(() => {
    const checkRecovery = async () => {
      const orphanId = await checkForOrphanBackups();
      if (orphanId) setOrphanFound(orphanId);
    };
    checkRecovery();
  }, []);

  const handleRecover = async () => {
    const toastId = toast.loading("Resgatando áudio...");
    try { await finalizeLiveBackup(orphanFound); toast.success("Resgatado!", { id: toastId }); setOrphanFound(null); navigate('/history'); } 
    catch (err) { toast.error("Falha.", { id: toastId }); }
  };
  const handleDiscardOrphan = async () => { await finalizeLiveBackup(orphanFound); setOrphanFound(null); toast.success("Descartado."); };

  // --- LÓGICA DO CARRINHO DE ÁUDIOS ---
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Adiciona os arquivos novos na lista que já existe na tela
    setSelectedFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = ""; 
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Botão Verde: ENVIAR FILA
  const handleSendFila = async () => {
    if (selectedFiles.length === 0) return;

    if (isOnline) {
      setStatusMsg(`⏳ Enviando ${selectedFiles.length} arquivo(s)...`);
      const toastId = toast.loading(`Upload de ${selectedFiles.length} áudio(s)...`);
      try {
        await uploadAudio(selectedFiles, template);
        toast.success(`Arquivos enviados!`, { id: toastId });
        setSelectedFiles([]);
        navigate('/history');
      } catch (error) {
        toast.error("Servidor indisponível. Salvando no aparelho...", { id: toastId });
        await saveOfflineMeeting(selectedFiles, template, `${selectedFiles.length} Arquivos Upload`);
        setSelectedFiles([]);
        navigate('/history');
      }
    } else {
      setStatusMsg("📡 Offline: Salvando localmente...");
      await saveOfflineMeeting(selectedFiles, template, `${selectedFiles.length} Arquivos Upload`);
      toast.success("Salvo no aparelho!");
      setSelectedFiles([]);
      navigate('/history');
    }
  };

  // --- GRAVAÇÃO AO VIVO (IGUAL) ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      currentMeetingIdRef.current = `live_${Date.now()}`;
      await startLiveBackup(currentMeetingIdRef.current, template);
      mediaRecorderRef.current.ondataavailable = async (e) => { if (e.data.size > 0) await saveLiveChunk(currentMeetingIdRef.current, e.data); };
      mediaRecorderRef.current.onstop = async () => {
        setStatusMsg("⏳ Processando...");
        const finalBlob = await finalizeLiveBackup(currentMeetingIdRef.current);
        currentMeetingIdRef.current = null;
        if (finalBlob) {
          if (isOnline) {
            const toastId = toast.loading("Enviando gravação...");
            try { await uploadAudio(finalBlob, template); toast.success("Enviado!", { id: toastId }); navigate('/history'); } 
            catch (error) { toast.error("Erro no envio. Áudio salvo!", { id: toastId }); await saveOfflineMeeting(finalBlob, template, "Gravado Localmente"); navigate('/history'); }
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
    } catch (error) { toast.error("Permissão de microfone negada!"); }
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

      {/* A FILA DE ARQUIVOS (APARECE SE TIVER SELECIONADO ALGO) */}
      {selectedFiles.length > 0 && (
        <div className="absolute -top-32 w-full bg-blue-50 border border-blue-200 p-4 rounded-2xl shadow-lg z-20 max-h-48 overflow-y-auto">
          <h3 className="text-xs font-bold text-blue-800 uppercase mb-2">Fila de Áudios ({selectedFiles.length})</h3>
          <div className="flex flex-col gap-2 mb-3">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border text-xs text-gray-700">
                <span className="truncate w-3/4">{file.name}</span>
                <button onClick={() => handleRemoveFile(idx)} className="text-red-500"><X size={14}/></button>
              </div>
            ))}
          </div>
          <button onClick={handleSendFila} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md">
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
        <div className="flex-1 flex justify-end">
          <input type="file" accept="audio/*,video/*" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
          <button onClick={() => fileInputRef.current.click()} disabled={isRecording} className="w-14 h-14 rounded-full flex items-center justify-center border disabled:opacity-50" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            <UploadCloud className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-none">
          {!isOnline ? (
            <div className="flex flex-col items-center p-4 bg-red-50 text-red-600 rounded-2xl"><WifiOff size={32} /></div>
          ) : !isRecording ? (
            <button onClick={startRecording} className="w-24 h-24 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg"><Mic className="w-10 h-10" /></button>
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
