import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Lock, Unlock, UploadCloud, FileAudio, AlertTriangle } from 'lucide-react';
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

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch (err) {}
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
  };
  
  // REDE DE SEGURANÇA: Previne fechamento acidental da aba/navegador
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isRecording) {
        // O padrão moderno para forçar a janela de confirmação do navegador
        e.preventDefault();
        e.returnValue = ''; // Exigido pelo Chrome
        return ''; // Exigido por navegadores mais antigos
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Limpa o evento quando o componente for destruído
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRecording]); // O evento só muda se o status de gravação mudar

  // CHECAGEM DE RESGATE QUANDO ABRE O APLICATIVO
  useEffect(() => {
    const checkRecovery = async () => {
      const orphanId = await checkForOrphanBackups();
      if (orphanId) setOrphanFound(orphanId);
    };
    checkRecovery();
  }, []);

  const handleRecover = async () => {
    const toastId = toast.loading("Resgatando áudio perdido...");
    try {
      await finalizeLiveBackup(orphanFound);
      toast.success("Áudio resgatado! Vá no Histórico para enviar.", { id: toastId });
      setOrphanFound(null);
      navigate('/history');
    } catch (err) {
      toast.error("Falha ao recuperar.", { id: toastId });
    }
  };

  const handleDiscardOrphan = async () => {
    await finalizeLiveBackup(orphanFound); // Finaliza para apagar
    setOrphanFound(null);
    toast.success("Áudio interrompido descartado.");
  };
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (navigator.onLine) {
      setStatusMsg(`⏳ Enviando ${file.name}...`);
      const toastId = toast.loading("Fazendo upload...");
      try {
        await uploadAudio(file, template);
        toast.success("Enviado com sucesso!", { id: toastId });
        navigate('/history');
      } catch (error) {
        toast.error("Servidor indisponível. Salvando no aparelho...", { id: toastId });
        await saveOfflineMeeting(file, template, file.name);
        navigate('/history');
      }
    } else {
      setStatusMsg("📡 Offline: Salvando localmente...");
      await saveOfflineMeeting(file, template, file.name);
      toast.success("Arquivo salvo em segurança no aparelho!");
      navigate('/history');
    }
    e.target.value = ""; 
  };

  // --- GRAVAÇÃO CAIXA PRETA ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      // Gera o ID da reunião que está começando
      currentMeetingIdRef.current = `live_${Date.now()}`;
      await startLiveBackup(currentMeetingIdRef.current, template);

      // O SEGREDO: Salva um pedaço no disco A CADA 1 SEGUNDO (1000ms)
      mediaRecorderRef.current.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          await saveLiveChunk(currentMeetingIdRef.current, e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        setStatusMsg("⏳ Processando arquivo seguro...");
        const finalBlob = await finalizeLiveBackup(currentMeetingIdRef.current);
        currentMeetingIdRef.current = null;

        if (finalBlob) {
          if (navigator.onLine) {
            const toastId = toast.loading("Enviando gravação...");
            try {
              await uploadAudio(finalBlob, template);
              toast.success("Enviado com sucesso!", { id: toastId });
              navigate('/history');
            } catch (error) {
              toast.error("Erro no envio. Áudio salvo no celular!", { id: toastId });
              navigate('/history');
            }
          } else {
            toast.success("Modo Offline: Áudio salvo no celular!");
            navigate('/history');
          }
        }
      };

      // Começa a gravar fatiando de 1 em 1 segundo
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setIsLocked(true);
      setStatusMsg("Gravando (Backup ao vivo)...");
      await requestWakeLock();

      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch (error) {
      alert("Permissão de microfone negada!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    setIsLocked(false);
    releaseWakeLock();
  };

  // ... (Lógica de Desbloqueio mantida)
  const handlePointerDown = () => {
    setUnlockProgress(0);
    unlockIntervalRef.current = setInterval(() => {
      setUnlockProgress((prev) => {
        if (prev >= 100) { clearInterval(unlockIntervalRef.current); setIsLocked(false); return 100; }
        return prev + 5;
      });
    }, 50);
  };
  const handlePointerUp = () => {
    clearInterval(unlockIntervalRef.current);
    if (unlockProgress < 100) setUnlockProgress(0);
  };
  useEffect(() => {
    return () => { clearInterval(timerRef.current); clearInterval(unlockIntervalRef.current); };
  }, []);

  // --- RENDER DA TELA DE BLOQUEIO ---
  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50 text-white select-none">
        <Lock className="w-12 h-12 text-red-500 mb-4 animate-pulse" />
        <h2 className="text-5xl font-mono font-light mb-2">{formatTime(recordingTime)}</h2>
        <p className="text-gray-400 mb-16 font-medium">Gravando seguro...</p>
        
        <div className="flex flex-col items-center justify-center">
          <button onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} className="relative w-32 h-32 rounded-full flex items-center justify-center border-4 border-gray-700 bg-gray-800 outline-none overflow-hidden transition-transform active:scale-95 touch-none">
            <div className="absolute bottom-0 w-full bg-green-500/30 transition-all duration-75" style={{ height: `${unlockProgress}%` }}></div>
            <Unlock className={`w-10 h-10 z-10 ${unlockProgress > 50 ? 'text-green-400' : 'text-gray-400'}`} />
          </button>
          <p className="mt-6 text-sm text-gray-500 font-bold uppercase tracking-widest">Pressione e Segure</p>
        </div>
      </div>
    );
  }

  // --- RENDER DA TELA NORMAL ---
  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-3xl shadow-xl w-full max-w-sm border relative transition-colors" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
      
      {orphanFound && (
        <div className="absolute -top-24 left-0 w-full bg-red-50 border border-red-200 p-4 rounded-2xl shadow-lg animate-bounce-in">
          <div className="flex items-center gap-2 text-red-600 font-bold mb-2">
            <AlertTriangle size={18} /> Aba Fechada Detectada!
          </div>
          <p className="text-xs text-red-700 mb-3">Encontramos uma gravação que foi interrompida antes de salvar.</p>
          <div className="flex gap-2">
            <button onClick={handleRecover} className="flex-1 bg-red-600 text-white text-xs font-bold py-2 rounded-lg">Resgatar</button>
            <button onClick={handleDiscardOrphan} className="flex-1 bg-red-200 text-red-700 text-xs font-bold py-2 rounded-lg">Descartar</button>
          </div>
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

      <div className="text-6xl font-mono mb-8 font-light tracking-tighter">
        {formatTime(recordingTime)}
      </div>

      <div className="flex items-center justify-center gap-6">
        {/* BOTÃO DE UPLOAD DE ARQUIVO */}
        <input type="file" accept="audio/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
        <button 
          onClick={() => fileInputRef.current.click()} 
          className="w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 border" 
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }} 
          title="Fazer Upload de Áudio"
        >
          <UploadCloud className="w-6 h-6" />
        </button>

        {!isRecording ? (
          <button onClick={startRecording} className="w-24 h-24 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95">
            <Mic className="w-10 h-10 text-white" />
          </button>
        ) : (
          <button onClick={stopRecording} className="w-24 h-24 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
            <Square className="w-8 h-8 text-white fill-current" />
          </button>
        )}

        <div className="w-14 h-14"></div> {/* Espaçador */}
      </div>

      <div className="mt-8 h-6 text-sm font-medium animate-pulse" style={{ color: 'var(--accent)' }}>
        {statusMsg}
      </div>
    </div>
  );
}
