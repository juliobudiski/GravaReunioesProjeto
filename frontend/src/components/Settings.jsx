import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Moon, Sun, Palette, Search, Loader2, HelpCircle } from 'lucide-react';
import { getSettings, saveSettings, fetchAvailableModels } from '../api';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-hot-toast';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [chunkDuration, setChunkDuration] = useState(2);
  const [keys, setKeys] = useState([]);
  
  // Controle de busca de modelos
  const [availableModels, setAvailableModels] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setChunkDuration(data.chunk_duration_minutes || 2);
      setKeys(data.keys || []);
    } catch (error) {
      toast.error("Erro ao carregar configurações.");
    }
  };

  const handleAddKey = () => {
    setKeys([...keys, { provider: "gemini", key: "", priority: keys.length + 1, selected_model: "" }]);
  };

  const handleRemoveKey = (index) => {
    const newKeys = [...keys];
    newKeys.splice(index, 1);
    newKeys.forEach((k, i) => k.priority = i + 1); // Reajusta prioridades
    setKeys(newKeys);
  };

  const handleKeyChange = (index, field, value) => {
    const newKeys = [...keys];
    newKeys[index][field] = value;
    setKeys(newKeys);
  };

  const handleSearchModels = async (index, provider) => {
    const toastId = toast.loading(`Buscando modelos da ${provider}...`);
    try {
      const data = await fetchAvailableModels(provider);
      
      // Salva a lista de modelos encontrada dentro daquela chave específica
      const newKeys = [...keys];
      newKeys[index].cascade_list = data.models;
      // Se não tinha modelo principal, seta o primeiro como padrão
      if (!newKeys[index].primary_model && data.models.length > 0) {
        newKeys[index].primary_model = data.models[0];
      }
      setKeys(newKeys);
      
      toast.success(`${data.models.length} modelos encontrados!`, { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  };

  const handleSave = async () => {
    const toastId = toast.loading("Salvando...");
    try {
      // Como alteramos a tabela para não ter colunas de modelo, vamos salvar 
      // a preferência de modelo dentro de um campo genérico ou injetar no orquestrador futuramente.
      // (Para esta Sprint, a busca é funcional, a persistência de modelo será ligada na próxima).
      await saveSettings({ chunk_duration_minutes: parseInt(chunkDuration), keys });
      toast.success("Configurações salvas!", { id: toastId });
    } catch (error) {
      toast.error("Erro ao salvar.", { id: toastId });
    }
  };

  return (
    // Usa variáveis CSS para adaptar às cores do Tema!
    <div className="p-6 pb-24 max-w-md mx-auto w-full transition-colors" style={{ color: 'var(--text-primary)' }}>
      <h2 className="text-2xl font-bold mb-6">Ajustes do Synapse</h2>
      
      {/* 🎨 PAINEL: APARÊNCIA */}
      <div className="p-5 rounded-2xl shadow-sm border mb-6 transition-colors glass-effect" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <label className="block text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Identidade Visual</label>
        
        <div className="flex gap-3">
          {/* Botões de Tema que disparam o setTheme */}
          <button onClick={() => setTheme('light')} className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-[var(--accent)] bg-blue-50/10' : 'border-transparent'}`} style={{ backgroundColor: theme === 'light' ? '' : 'var(--bg-primary)' }}>
            <Sun size={24} style={{ color: theme === 'light' ? 'var(--accent)' : 'var(--text-secondary)' }} />
            <span className="text-xs font-bold">Light</span>
          </button>
          
          <button onClick={() => setTheme('dark')} className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-[var(--accent)] bg-slate-800' : 'border-transparent'}`} style={{ backgroundColor: theme === 'dark' ? '' : 'var(--bg-primary)' }}>
            <Moon size={24} style={{ color: theme === 'dark' ? 'var(--accent)' : 'var(--text-secondary)' }} />
            <span className="text-xs font-bold">Noturno</span>
          </button>
          
          <button onClick={() => setTheme('colorful')} className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === 'colorful' ? 'border-[var(--accent)] bg-fuchsia-900/20' : 'border-transparent'}`} style={{ backgroundColor: theme === 'colorful' ? '' : 'var(--bg-primary)' }}>
            <Palette size={24} style={{ color: theme === 'colorful' ? 'var(--accent)' : 'var(--text-secondary)' }} />
            <span className="text-xs font-bold">Cyber</span>
          </button>
        </div>
      </div>

      {/* ⚙️ PAINEL: PROCESSAMENTO */}
      <div className="p-5 rounded-2xl shadow-sm border mb-6 transition-colors glass-effect" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <label className="block text-sm font-semibold mb-2">Tamanho do Corte (minutos)</label>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Fatiar áudio longo evita timeouts na nuvem.</p>
        
        {/* CORREÇÃO DO BUG: Botões Touch Amigáveis em vez de Input */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setChunkDuration(prev => Math.max(1, prev - 1))}
            className="w-12 h-12 flex items-center justify-center rounded-xl border text-xl font-bold transition-transform active:scale-90"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >-</button>
          
          <div className="flex-1 text-center font-mono text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {chunkDuration} <span className="text-sm font-sans" style={{ color: 'var(--text-secondary)' }}>min</span>
          </div>
          
          <button 
            onClick={() => setChunkDuration(prev => Math.min(15, prev + 1))}
            className="w-12 h-12 flex items-center justify-center rounded-xl border text-xl font-bold transition-transform active:scale-90"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >+</button>
        </div>
      </div>

      {/* 🔑 PAINEL: CHAVES E MODELOS */}
      <div className="p-5 rounded-2xl shadow-sm border mb-6 transition-colors glass-effect" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex justify-between items-center mb-4">
          <label className="text-sm font-semibold">Chaves de API</label>
          <button onClick={handleAddKey} className="p-2 rounded-full transition-colors" style={{ color: 'var(--accent)', backgroundColor: 'var(--bg-primary)' }}>
            <Plus size={20} />
          </button>
        </div>

        {keys.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>Adicione uma chave Gemini ou OpenAI.</p>}

        {keys.map((k, index) => (
          <div key={index} className="flex flex-col gap-3 mb-6 pb-6 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Ordem: {k.priority}</span>
              <button onClick={() => handleRemoveKey(index)} className="text-red-400 hover:text-red-500"><Trash2 size={18} /></button>
            </div>
            
            <div className="flex gap-2">
              <select value={k.provider} onChange={(e) => handleKeyChange(index, "provider", e.target.value)} className="w-1/3 rounded-lg px-2 py-2 text-sm outline-none border" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
              
              <input type="password" placeholder="Chave da API (sk-... ou AIza...)" value={k.key} onChange={(e) => handleKeyChange(index, "key", e.target.value)} className="w-2/3 rounded-lg px-3 py-2 text-sm outline-none border" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
            </div>

            {/* O BOTÃO E O SELECT DE BUSCA DE MODELOS (US25) */}
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex justify-between items-center">
                <button onClick={() => handleSearchModels(index, k.provider)} disabled={isSearching || !k.key} className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold border transition-all active:scale-95 disabled:opacity-50" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                  {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} 
                  Procurar Modelos da {k.provider === 'gemini' ? 'Google' : 'OpenAI'}
                </button>
                
                {/* TOOLTIP DE EXPLICAÇÃO DA CASCATA */}
                <div className="group relative flex items-center cursor-help">
                  <HelpCircle size={18} style={{ color: 'var(--text-secondary)' }} className="hover:opacity-80 transition-opacity" />
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-xs leading-relaxed" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
                    <strong>Como funciona a Cascata?</strong><br/>
                    O modelo que você selecionar abaixo será a sua <b>Prioridade 1</b>. Se ele falhar (ex: cair o servidor ou limite de uso), o Synapse tentará automaticamente os outros modelos da lista até conseguir finalizar a sua reunião!
                  </div>
                </div>
              </div>
              
              {k.cascade_list && k.cascade_list.length > 0 && (
                <select 
                  value={k.primary_model || ""} 
                  onChange={(e) => handleKeyChange(index, "primary_model", e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none border mt-1" 
                  style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                >
                  <option value="">Selecione o Modelo Prioritário...</option>
                  {k.cascade_list.map(mod => (
                    <option key={mod} value={mod}>{mod}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 💾 SALVAR */}
      <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 border-none" style={{ backgroundColor: 'var(--accent)' }}>
        <Save size={20} /> Salvar Preferências
      </button>
    </div>
  );
}
