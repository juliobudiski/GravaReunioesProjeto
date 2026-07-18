import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, UploadCloud, Lock, Unlock } from 'lucide-react';
import { uploadAudio } from '../api';

export default function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [unlockProgress, setUnlockProgress] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const wakeLockRef = useRef(null);
  const timerRef = useRef(null);
  const unlockIntervalRef = useRef(null);

  // Formata os segundos para 00:00
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn("Wake Lock não suportado");
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // Inicia a gravação
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setStatusMsg("Enviando áudio para o servidor...");
        
        try {
          await uploadAudio(audioBlob, "Padrão");
          setStatusMsg("✅ Reunião enviada para processamento!");
        } catch (error) {
          setStatusMsg("❌ Erro ao enviar. Backend desligado?");
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsLocked(true); // Bloqueia a tela
      setStatusMsg("Gravando...");
      
      await requestWakeLock();

      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

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

  // Lógica do botão: Pressione e Segure para desbloquear
  const handlePointerDown = () => {
    setUnlockProgress(0);
    unlockIntervalRef.current = setInterval(() => {
      setUnlockProgress((prev) => {
        if (prev >= 100) {
          clearInterval(unlockIntervalRef.current);
          setIsLocked(false); // Desbloqueia ao atingir 100%
          return 100;
        }
        return prev + 5; // Enche 5% a cada 50 milissegundos
      });
    }, 50);
  };

  const handlePointerUp = () => {
    clearInterval(unlockIntervalRef.current);
    if (unlockProgress < 100) {
      setUnlockProgress(0); // Se soltar antes do fim, zera o progresso
    }
  };

  // Limpa os cronômetros se o componente for desmontado
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(unlockIntervalRef.current);
    };
  }, []);

  // TELA DE BLOQUEIO (Segure para Desbloquear)
  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50 text-white select-none">
        <Lock className="w-12 h-12 text-red-500 mb-4 animate-pulse" />
        <h2 className="text-5xl font-mono font-light mb-2">{formatTime(recordingTime)}</h2>
        <p className="text-gray-400 mb-16 font-medium">Gravação em andamento</p>
        
        {/* Botão Segure para Desbloquear */}
        <div className="flex flex-col items-center justify-center">
          <button
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="relative w-32 h-32 rounded-full flex items-center justify-center border-4 border-gray-700 bg-gray-800 focus:outline-none overflow-hidden transition-transform active:scale-95 touch-none"
          >
            {/* O Anel de progresso verde crescendo */}
            <div 
              className="absolute bottom-0 w-full bg-green-500/30 transition-all duration-75"
              style={{ height: `${unlockProgress}%` }}
            ></div>
            <Unlock className={`w-10 h-10 z-10 ${unlockProgress > 50 ? 'text-green-400' : 'text-gray-400'}`} />
          </button>
          <p className="mt-6 text-sm text-gray-500 font-bold uppercase tracking-widest">
            Pressione e Segure
          </p>
        </div>
      </div>
    );
  }

  // TELA NORMAL
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-3xl shadow-xl w-full max-w-sm border border-gray-100">
      
      <div className="text-6xl font-mono mb-10 font-light text-gray-800 tracking-tighter">
        {formatTime(recordingTime)}
      </div>

      {!isRecording ? (
        <button 
          onClick={startRecording}
          className="w-28 h-28 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.3)] transition-transform transform hover:scale-105 active:scale-95"
        >
          <Mic className="w-12 h-12 text-white" />
        </button>
      ) : (
        <button 
          onClick={stopRecording}
          className="w-28 h-28 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.4)] animate-pulse"
        >
          <Square className="w-10 h-10 text-white fill-current" />
        </button>
      )}

      <div className="mt-8 h-6 text-sm text-gray-500 text-center font-medium">
        {statusMsg}
      </div>
    </div>
  );
}
