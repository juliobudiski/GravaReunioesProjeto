import React, { useState } from 'react';
import { Network, FileText, X } from 'lucide-react';
import { loginWithGoogle } from '../firebase';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false); // NOVO: Controle do Modal de Termos

  const handleGoogleLogin = async () => {
    if (!agreed) return toast.error("Você precisa aceitar os Termos de Uso.");
    
    setIsLoading(true);
    try {
      const user = await loginWithGoogle();
      const token = await user.getIdToken();
      
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_name', user.displayName || 'Cientista');
      localStorage.setItem('user_photo', user.photoURL || '');
      localStorage.setItem('user_email', user.email || '');
      // Agora o treinamento de dados é atrelado ao aceite obrigatório
      localStorage.setItem('allow_training', 'true'); 
      
      toast.success("Bem-vindo(a) ao Synapse!");
      navigate('/');
    } catch (error) {
      toast.error("Falha ao entrar com Google.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Decoração */}
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-purple-600/20 rounded-full blur-[100px]"></div>

      <div className="max-w-md w-full backdrop-blur-xl border p-8 rounded-3xl shadow-2xl relative z-10" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
        
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Network className="text-white w-10 h-10" />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-center mb-2 tracking-tight">Synapse AI</h1>
        <p className="text-center text-sm font-medium mb-8" style={{ color: 'var(--text-secondary)' }}>O cérebro digital para as suas reuniões.</p>

        {/* Políticas e Termos */}
        <div className="space-y-4 mb-8">
          <label className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors" style={{ borderColor: agreed ? 'var(--accent)' : 'var(--border)', backgroundColor: agreed ? 'rgba(37, 99, 235, 0.05)' : 'transparent' }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 w-5 h-5 accent-blue-600" />
            <span className="text-sm font-medium leading-relaxed">
              Eu li e concordo com os <span onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="text-blue-500 hover:underline">Termos de Serviço e Política de Privacidade</span>, incluindo a anonimização de dados.
            </span>
          </label>
        </div>

        {/* Botão do Google */}
        <button onClick={handleGoogleLogin} disabled={isLoading || !agreed} className="w-full flex items-center justify-center gap-3 font-bold py-4 rounded-xl shadow-md disabled:opacity-50 transition-all active:scale-95 border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)' }}></div>
          ) : (
            <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          )}
          Entrar com o Google
        </button>
      </div>

      {/* MODAL DE TERMOS E CONDIÇÕES LONGOS (EULA) */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="rounded-3xl p-6 w-full max-w-lg h-[85vh] flex flex-col shadow-2xl border transition-colors" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            
            <div className="flex justify-between items-center mb-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-bold text-xl flex items-center gap-2"><FileText size={20} style={{ color: 'var(--accent)' }}/> Termos de Serviço</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Última atualização: Julho de 2026</p>
              </div>
              <button onClick={() => setShowTerms(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors" style={{ color: 'var(--text-secondary)' }}><X size={20}/></button>
            </div>
            
            {/* A CAIXA DE TEXTO ONDE VOCÊ EDITA OS TERMOS */}
            {/* O "overflow-y-auto" permite textos gigantes aqui dentro */}
            <div className="overflow-y-auto flex-1 text-sm space-y-5 p-4 rounded-xl shadow-inner border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              
              <p>Bem-vindo ao Synapse AI. Ao utilizar nossa plataforma, você concorda legalmente com os seguintes termos. Por favor, leia com atenção.</p>
              
              <div>
                <h4 className="font-bold mb-1">1. Objeto e Natureza do Serviço</h4>
                <p className="opacity-80">O Synapse AI fornece ferramentas de transcrição de áudio e geração de resumos baseados em Inteligência Artificial. Nós não garantimos 100% de precisão nos resultados devido à natureza probabilística dos modelos de Linguagem (LLMs).</p>
              </div>

              <div>
                <h4 className="font-bold mb-1">2. Consentimento de Gravação</h4>
                <p className="opacity-80">O usuário compromete-se a utilizar a plataforma exclusivamente para gravar reuniões ou diálogos onde TODOS os participantes tenham concedido consentimento prévio para a captação de voz, isentando o Synapse de qualquer responsabilidade civil ou penal por gravações ilícitas.</p>
              </div>

              <div>
                <h4 className="font-bold mb-1">3. Privacidade e Tratamento de Dados (LGPD)</h4>
                <p className="opacity-80">Os arquivos de áudio originais (WebM/MP3) processados na nuvem são permanentemente destruídos de nossos servidores tão logo a transcrição textual seja concluída com sucesso. Nenhum áudio bruto é retido em nosso banco de dados.</p>
              </div>

              <div>
                <h4 className="font-bold mb-1">4. Anonimização e Melhoria Contínua</h4>
                <p className="opacity-80">No plano Gratuito ("Freemium"), o usuário concede licença irrevogável para que os textos transcritos sejam <strong>anonimizados</strong> (desvinculados do ID de usuário, nome e e-mail) e alocados em um repositório seguro para fins de treinamento e refinamento dos algoritmos proprietários do Synapse AI.</p>
              </div>

              <div>
                <h4 className="font-bold mb-1">5. Limitação de Responsabilidade</h4>
                <p className="opacity-80">O Synapse AI não se responsabiliza por perdas de dados decorrentes de falhas de conexão, expiração de tokens de APIs terceiras (OpenAI/Google), ou danos indiretos causados por "alucinações" ou imprecisões no resumo gerado pela IA. O usuário deve sempre revisar o documento final.</p>
              </div>

            </div>
            
            <div className="mt-4 pt-4 flex justify-end">
              <button onClick={() => { setShowTerms(false); setAgreed(true); }} className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-bold transition-transform active:scale-95 shadow-lg" style={{ backgroundColor: 'var(--accent)' }}>
                Li, Entendi e Concordo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
