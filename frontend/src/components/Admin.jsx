import React, { useState, useEffect } from 'react';
import { ShieldAlert, Users, FileAudio, BarChart3, Loader2, KeyRound, Database, Crown } from 'lucide-react';
import { getAdminStats } from '../api';

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getAdminStats();
        setStats(data);
      } catch (err) { setError("Acesso restrito."); } 
      finally { setLoading(false); }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}><Loader2 className="animate-spin mx-auto w-8 h-8"/></div>;
  if (error) return <div className="p-8 text-center text-red-500 font-bold">{error}</div>;

  return (
    <div className="p-4 pt-8 pb-24 max-w-md mx-auto h-full transition-colors" style={{ color: 'var(--text-primary)' }}>
      <h2 className="text-3xl font-black tracking-tight mb-2">Painel do CEO</h2>
      <p className="text-sm font-medium mb-8" style={{ color: 'var(--text-secondary)' }}>Controle de Voo do Synapse AI.</p>

      {/* MÉTRICAS DE USUÁRIOS E RECEITA */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-5 rounded-3xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-blue-100 text-blue-600">
            <Users size={20}/>
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Usuários Totais</p>
          <p className="text-4xl font-black mt-1">{stats.total_users}</p>
        </div>

        <div className="p-5 rounded-3xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-yellow-100 text-yellow-600">
            <Crown size={20}/>
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Assinantes Pro</p>
          <p className="text-4xl font-black mt-1">{stats.premium_users}</p>
        </div>
      </div>

      {/* MÉTRICAS DE SISTEMA */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-5 rounded-3xl border shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Database size={18} className="text-purple-500 mb-2" />
          <p className="text-2xl font-bold">{stats.data_donors}</p>
          <p className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-secondary)' }}>Doadores de Dados (IA)</p>
        </div>

        <div className="p-5 rounded-3xl border shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <KeyRound size={18} className="text-orange-500 mb-2" />
          <p className="text-2xl font-bold">{stats.total_api_keys}</p>
          <p className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-secondary)' }}>Chaves Ativas</p>
          
          <div className="mt-2 text-[10px] font-mono opacity-70">
            {stats.keys_breakdown.map(k => <span key={k.provider} className="block">{k.provider}: {k.count}</span>)}
          </div>
        </div>
      </div>

      {/* MÉTRICAS DE USO DE IA (RANKING) */}
      <div className="p-5 rounded-3xl border shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold flex items-center gap-2"><BarChart3 size={18} style={{ color: 'var(--accent)' }}/> O que as pessoas geram?</h3>
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-bold">{stats.active_meetings} Atas salvas</span>
        </div>
        
        {stats.templates_ranking.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum dado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {stats.templates_ranking.map((t, idx) => (
              <div key={idx} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs font-medium truncate pr-4" style={{ color: 'var(--text-secondary)' }}>{t.template}</span>
                <span className="font-bold text-sm bg-gray-100 px-2 py-1 rounded-lg" style={{ color: 'var(--bg-primary)' }}>{t.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
