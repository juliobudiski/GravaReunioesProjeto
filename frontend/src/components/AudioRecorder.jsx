import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Lock, Unlock, Upload, FileAudio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { uploadAudio, saveOfflineMeeting } from '../api';

export default function AudioRecorder() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [template, setTemplate] = useState("Padrão (Resumo e Tarefas)"); // US03: Foco da IA

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const wakeLockRef = useRef(null);
  const timerRef = useRef(null);
  const unlockIntervalRef = useRef(null);
  const fileInputRef = useRef(null); // Referência para o botão de upload invisível

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch (err) { console.warn("Wake Lock não suportado"); }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
  };

  // --- LÓGICA DE GRAVAÇÃO (MANTIDA) ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Verifica se tem internet no momento da parada
        if (navigator.onLine) {
          setStatusMsg("⏳ Enviando gravação para a IA...");
          const toastId = toast.loading("Fazendo upload...");
          try {
            await uploadAudio(audioBlob, template);
            toast.success("Enviado com sucesso!", { id: toastId });
            navigate('/history');
          } catch (error) {
            // Se o servidor caiu bem na hora (Timeout 500)
            toast.error("Servidor indisponível. Salvando no celular...", { id: toastId });
            await saveOfflineMeeting(audioBlob, template);
            navigate('/history');
          }
        } else {
          // Se o usuário está na rua / sem internet (O Cientista no campo)
          setStatusMsg("📡 Modo Offline: Salvando localmente...");
          await saveOfflineMeeting(audioBlob, template);
          toast.success("Áudio salvo em segurança no celular!");
          navigate('/history');
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsLocked(true);
      setStatusMsg("Gravando...");
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

  // --- LÓGICA DE UPLOAD DE ARQUIVO (US02) ---
    const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Toast de sucesso flutuante (NOVO)
    const toastId = toast.loading(`Enviando ${file.name}...`);
    
    try {
      await uploadAudio(file, template);
      toast.success("Enviado com sucesso!", { id: toastId });
      setTimeout(() => {navigate('/history');}, 2000);
    } catch (error) {
      toast.error("Erro no envio.", { id: toastId });
    }
    e.target.value = ""; 
  };

  // --- LÓGICA DE DESBLOQUEIO ---
  const handlePointerDown = () => {
    setUnlockProgress(0);
    unlockIntervalRef.current = setInterval(() => {
      setUnlockProgress((prev) => {
        if (prev >= 100) {
          clearInterval(unlockIntervalRef.current);
          setIsLocked(false);
          return 100;
        }
        return prev + 5;
      });
    }, 50);
  };

  const handlePointerUp = () => {
    clearInterval(unlockIntervalRef.current);
    if (unlockProgress < 100) setUnlockProgress(0);
  };

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(unlockIntervalRef.current);
    };
  }, []);

  // --- RENDER DA TELA DE BLOQUEIO ---
  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50 text-white select-none">
        <Lock className="w-12 h-12 text-red-500 mb-4 animate-pulse" />
        <h2 className="text-5xl font-mono font-light mb-2">{formatTime(recordingTime)}</h2>
        <p className="text-gray-400 mb-16 font-medium">Gravação em andamento</p>
        
        <div className="flex flex-col items-center justify-center">
          <button
            onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
            className="relative w-32 h-32 rounded-full flex items-center justify-center border-4 border-gray-700 bg-gray-800 focus:outline-none overflow-hidden transition-transform active:scale-95 touch-none"
          >
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
      
      {/* Dropdown de Foco da IA (US03) */}
      <div className="w-full mb-6">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Foco da IA</label>
        <select 
          value={template} 
          onChange={(e) => setTemplate(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Padrão (Resumo e Tarefas)">Padrão (Resumo e Tarefas)</option>
          <option value="Brainstorming (Lista de Ideias e Insights)">Brainstorming (Lista de Ideias)</option>
          <option value="Entrevista (Perguntas e Respostas)">Entrevista (Perguntas e Respostas)</option>
        </select>
      </div>

      <div className="text-6xl font-mono mb-8 font-light text-gray-800 tracking-tighter">
        {formatTime(recordingTime)}
      </div>

      <div className="flex items-center justify-center gap-6">
        {/* Botão de Upload de Arquivo (Invisível o input, clicável o ícone) */}
        <input 
          type="file" 
          accept="audio/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
        />
        
        <button 
          onClick={() => fileInputRef.current.click()}
          className="w-14 h-14 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center transition-transform transform hover:scale-105"
          title="Fazer Upload de Áudio"
        >
          <Upload className="w-6 h-6" />
        </button>

        {/* Botão de Gravar/Parar */}
        {!isRecording ? (
          <button 
            onClick={startRecording}
            className="w-24 h-24 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.3)] transition-transform transform hover:scale-105 active:scale-95"
          >
            <Mic className="w-10 h-10 text-white" />
          </button>
        ) : (
          <button 
            onClick={stopRecording}
            className="w-24 h-24 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.4)] animate-pulse"
          >
            <Square className="w-8 h-8 text-white fill-current" />
          </button>
        )}

        {/* Espaçador fantasma para manter o Mic centralizado (truque de UX) */}
        <div className="w-14"></div>
      </div>

      <div className="mt-8 h-6 text-sm text-blue-600 text-center font-medium animate-pulse">
        {statusMsg}
      </div>
    </div>
  );
}
