import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { getSettings, saveSettings } from '../api';

export default function Settings() {
  const [chunkDuration, setChunkDuration] = useState(2);
  const [keys, setKeys] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setChunkDuration(data.chunk_duration_minutes || 2);
      setKeys(data.keys || []);
    } catch (error) {
      setStatus("Erro ao carregar configurações.");
    }
  };

  const handleAddKey = () => {
    setKeys([...keys, { provider: "openai", key: "", priority: keys.length + 1 }]);
  };

  const handleRemoveKey = (index) => {
    const newKeys = [...keys];
    newKeys.splice(index, 1);
    // Reajusta a prioridade
    newKeys.forEach((k, i) => k.priority = i + 1);
    setKeys(newKeys);
  };

  const handleKeyChange = (index, field, value) => {
    const newKeys = [...keys];
    newKeys[index][field] = value;
    setKeys(newKeys);
  };

  const handleSave = async () => {
    setStatus("Salvando...");
    try {
      await saveSettings({ chunk_duration_minutes: parseInt(chunkDuration), keys });
      setStatus("✅ Configurações salvas com sucesso!");
      setTimeout(() => setStatus(""), 3000);
    } catch (error) {
      setStatus("❌ Erro ao salvar configurações.");
    }
  };

  return (
    <div className="p-6 pb-24 max-w-md mx-auto w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Configurações de IA</h2>
      
      {/* Chunk Size */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Tamanho do Corte de Áudio (minutos)</label>
        <p className="text-xs text-gray-500 mb-3">Recomendado: 2 a 5 minutos</p>
        <input 
          type="number" min="1" max="10"
          value={chunkDuration}
          onChange={(e) => setChunkDuration(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Lista Dinâmica de Chaves */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div className="flex justify-between items-center mb-4">
          <label className="text-sm font-semibold text-gray-700">Chaves de API (Fallback)</label>
          <button onClick={handleAddKey} className="text-blue-600 bg-blue-50 p-2 rounded-full hover:bg-blue-100">
            <Plus size={20} />
          </button>
        </div>

        {keys.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma chave cadastrada.</p>
        )}

        {keys.map((k, index) => (
          <div key={index} className="flex flex-col gap-2 mb-4 pb-4 border-b border-gray-100 last:border-0">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Prioridade {k.priority}</span>
              <button onClick={() => handleRemoveKey(index)} className="text-red-400 hover:text-red-600">
                <Trash2 size={18} />
              </button>
            </div>
            
            <div className="flex gap-2">
              <select 
                value={k.provider} 
                onChange={(e) => handleKeyChange(index, "provider", e.target.value)}
                className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
              
              <input 
                type="password" placeholder="sk-..."
                value={k.key} 
                onChange={(e) => handleKeyChange(index, "key", e.target.value)}
                className="w-2/3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Botão de Salvar */}
      <button 
        onClick={handleSave}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg transition-transform active:scale-95"
      >
        <Save size={20} />
        Salvar Alterações
      </button>

      {status && <p className="mt-4 text-center text-sm font-medium text-blue-600">{status}</p>}
    </div>
  );
}
