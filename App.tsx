import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Chamado, UserSession } from './types';
import { TicketCard } from './components/TicketCard';
import { NewTicketModal } from './components/NewTicketModal';
import { TicketChatModal } from './components/TicketChatModal';
import { Login } from './components/Login';
import { playNotificationSound } from './utils/sound';
import { LayoutDashboard, LogOut, Loader2, Inbox, CheckCircle2, AlertCircle, Layers, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [tickets, setTickets] = useState<Chamado[]>([]);
  const [newTicket, setNewTicket] = useState<Chamado | null>(null);
  const [activeChatTicket, setActiveChatTicket] = useState<Chamado | null>(null);
  
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const audioEnabled = useRef(false);

  // --- Auth & Profile Logic ---
  useEffect(() => {
    let mounted = true;

    // Safety timeout: If Supabase hangs, force loading to false after 3s
    const safetyTimeout = setTimeout(() => {
      if (mounted && authLoading) {
        console.warn("Auth check timed out, forcing UI load");
        setAuthLoading(false);
      }
    }, 3000);

    const fetchProfile = async (sessionUser: any) => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('username, img_url') 
          .eq('user_id', sessionUser.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.warn("Error fetching profile:", error);
        }

        return {
          id: sessionUser.id,
          name: data?.username || sessionUser.email?.split('@')[0] || 'Técnico',
          avatar: data?.img_url,
          email: sessionUser.email
        };
      } catch (err) {
        console.error("Profile fetch exception:", err);
        return {
          id: sessionUser.id,
          name: sessionUser.email?.split('@')[0] || 'Técnico',
          email: sessionUser.email
        };
      }
    };

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          const profile = await fetchProfile(session.user);
          if (mounted) {
            setUser(profile);
            audioEnabled.current = true;
          }
        }
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        if (mounted) {
          setAuthLoading(false);
          clearTimeout(safetyTimeout);
        }
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log(`[Auth] Event: ${event}`);

      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user);
        if (mounted) {
          setUser(profile);
          audioEnabled.current = true;
          setAuthLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setTickets([]);
        setAuthLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        // Token refreshed successfully
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  // --- Tickets Data & Realtime ---
  useEffect(() => {
    if (!user) return;

    const fetchTickets = async () => {
      setLoadingTickets(true);
      try {
        const { data, error } = await supabase
          .from('chamados')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data) setTickets(data);
      } catch (err) {
        console.error('Error fetching tickets:', err);
      } finally {
        setLoadingTickets(false);
      }
    };

    fetchTickets();

    const channel = supabase
      .channel('public:chamados')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chamados' },
        (payload) => {
          console.log("New Ticket Inserted:", payload);
          const insertedTicket = payload.new as Chamado;
          
          setTickets((prev) => [insertedTicket, ...prev]);
          setNewTicket(insertedTicket);
          
          if (audioEnabled.current) {
            playNotificationSound();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chamados' },
        (payload) => {
          console.log("Ticket Updated:", payload);
          const updatedTicket = payload.new as Chamado;
          
          setTickets((prev) => 
            prev.map(t => t.id === updatedTicket.id ? updatedTicket : t)
          );
          
          // Close modal if the ticket was taken by someone else or updated
          setNewTicket(current => {
             if (current && current.id === updatedTicket.id && updatedTicket.responsavel) {
                return null;
             }
             return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]); 

  // --- Actions ---
  const handleLogout = () => supabase.auth.signOut();

  // Helper to ensure session is valid before performing actions
  const checkSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    
    // If no session or error, try to refresh explicitly
    if (error || !data.session) {
      console.log("Session stale, attempting refresh...");
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      return refreshData.session;
    }
    return data.session;
  };

  const handleAcceptTicket = async (id: number) => {
    if (!user) return;
    setProcessingId(id);

    // 1. Optimistic Update (Immediate UI feedback)
    const previousTickets = [...tickets]; // Backup for rollback
    const optimisticUpdate = (t: Chamado) => 
      t.id === id ? { ...t, status: 'Em andamento', responsavel: user.name, responsavel_id: user.id } : t;

    setTickets(prev => prev.map(optimisticUpdate));
    setNewTicket(current => (current?.id === id ? null : current)); // Close modal immediately

    try {
      // 2. Perform DB Update
      await checkSession();
      const { error } = await supabase
        .from('chamados')
        .update({ 
          responsavel: user.name,
          responsavel_id: user.id, // Using UUID
          status: 'Em andamento'
        })
        .eq('id', id);

      if (error) throw error;
      
    } catch (err: any) {
      console.error("Error accepting ticket:", err);
      // Rollback UI on error
      setTickets(previousTickets);
      alert("Erro ao aceitar chamado. Verifique sua conexão.");
      
      if (err.message?.includes("Sessão expirada") || err.message?.includes("JWT")) {
        handleLogout();
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleFinalizeTicket = async (id: number) => {
    setProcessingId(id);

    // 1. Optimistic Update
    const previousTickets = [...tickets];
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'Concluído' } : t));

    try {
      // 2. Perform DB Update
      await checkSession();
      const { error } = await supabase
        .from('chamados')
        .update({ status: 'Concluído' })
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error("Error finalizing:", err);
      // Rollback
      setTickets(previousTickets);
      alert("Erro ao finalizar chamado.");

      if (err.message?.includes("Sessão expirada") || err.message?.includes("JWT")) {
        handleLogout();
      }
    } finally {
      setProcessingId(null);
    }
  };

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    if (!tickets.length || !user) return { open: 0, received: 0, closed: 0, myClosed: 0 };
    return {
      open: tickets.filter(t => t.status !== 'Concluído').length,
      received: tickets.length,
      closed: tickets.filter(t => t.status === 'Concluído').length,
      myClosed: tickets.filter(t => t.status === 'Concluído' && (
        t.responsavel_id === user.id || 
        t.responsavel === user.name
      )).length
    };
  }, [tickets, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Carregando sistema...</span>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden text-slate-200 font-sans relative">
      {/* Modals */}
      {newTicket && (
        <NewTicketModal 
          ticket={newTicket}
          onDismiss={() => setNewTicket(null)}
          onAccept={handleAcceptTicket}
          isProcessing={processingId === newTicket.id}
        />
      )}

      {activeChatTicket && user && (
        <TicketChatModal 
          ticket={activeChatTicket}
          currentUser={user}
          onClose={() => setActiveChatTicket(null)}
        />
      )}

      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-lg text-slate-100 tracking-wide">
            IT SERVICE <span className="text-indigo-400">DESK</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-white">{user.name}</span>
              <span className="text-xs text-green-400">Online</span>
            </div>
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full border-2 border-slate-700 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold border-2 border-slate-700">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="h-8 w-px bg-slate-800 mx-2"></div>
          <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-400 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-0">
        
        {/* Dashboard Area (Center/Left) */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
           <div className="max-w-6xl mx-auto space-y-8">
             
             {/* Stats Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <AlertCircle className="w-16 h-16 text-yellow-500" />
                  </div>
                  <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">Abertos</span>
                  <span className="text-4xl font-bold text-white mt-2">{stats.open}</span>
                  <span className="text-xs text-yellow-500 mt-2 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                    Em fila
                  </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Inbox className="w-16 h-16 text-indigo-500" />
                  </div>
                  <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">Recebidos</span>
                  <span className="text-4xl font-bold text-white mt-2">{stats.received}</span>
                  <span className="text-xs text-indigo-400 mt-2">Total geral</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Layers className="w-16 h-16 text-slate-500" />
                  </div>
                  <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">Fechados</span>
                  <span className="text-4xl font-bold text-white mt-2">{stats.closed}</span>
                  <span className="text-xs text-slate-500 mt-2">Concluídos total</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                  </div>
                  <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">Fechados por mim</span>
                  <span className="text-4xl font-bold text-emerald-400 mt-2">{stats.myClosed}</span>
                  <span className="text-xs text-emerald-600 mt-2">Produtividade pessoal</span>
                </div>
             </div>

             {/* Detailed Table */}
             <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
               <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
                 <Layers className="w-5 h-5 text-indigo-500" />
                 <h2 className="font-semibold text-lg text-white">Todos os Últimos Chamados</h2>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase font-semibold">
                       <th className="px-6 py-4">ID</th>
                       <th className="px-6 py-4">Status</th>
                       <th className="px-6 py-4">Título</th>
                       <th className="px-6 py-4">Solicitante</th>
                       <th className="px-6 py-4">Responsável</th>
                       <th className="px-6 py-4">Data</th>
                       <th className="px-6 py-4">Ação</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800">
                     {tickets.length === 0 ? (
                       <tr>
                         <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                           Nenhum registro encontrado.
                         </td>
                       </tr>
                     ) : (
                       tickets.map((t) => (
                         <tr 
                           key={t.id} 
                           onClick={() => setActiveChatTicket(t)}
                           className="hover:bg-slate-800/50 transition-colors text-sm group cursor-pointer"
                         >
                           <td className="px-6 py-4 text-slate-500 font-mono group-hover:text-indigo-400 transition-colors">#{t.id}</td>
                           <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold border ${
                                t.status === 'Concluído' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                t.status === 'Em andamento' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                              }`}>
                                {t.status || 'Novo'}
                              </span>
                           </td>
                           <td className="px-6 py-4 font-medium text-slate-200">{t.titulo}</td>
                           <td className="px-6 py-4 text-slate-400">{t.solicitante || '-'}</td>
                           <td className="px-6 py-4 text-slate-400">
                             {t.responsavel ? (
                               <div className="flex items-center gap-2">
                                 <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                   {t.responsavel.charAt(0).toUpperCase()}
                                 </div>
                                 {t.responsavel}
                               </div>
                             ) : '-'}
                           </td>
                           <td className="px-6 py-4 text-slate-500">
                             {t.created_at ? format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                           </td>
                           <td className="px-6 py-4">
                             <button className="p-2 bg-slate-800 rounded-lg hover:bg-indigo-600 hover:text-white text-slate-400 transition-colors">
                                <MessageSquare className="w-4 h-4" />
                             </button>
                           </td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
             </div>

           </div>
        </main>

        {/* Right Sidebar - Queue (Maintained) */}
        <aside className="w-[400px] shrink-0 bg-slate-900/50 flex flex-col border-l border-slate-800">
          <div className="p-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10 flex justify-between items-center h-16 shrink-0">
            <h2 className="font-semibold text-slate-200">Fila de Chamados</h2>
            <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs">
              {tickets.length} total
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {loadingTickets ? (
              <div className="flex items-center justify-center h-32 text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Carregando...</span>
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                Nenhum chamado registrado.
              </div>
            ) : (
              tickets.map((ticket) => (
                <TicketCard 
                  key={ticket.id} 
                  ticket={ticket} 
                  onClick={setActiveChatTicket}
                  onAccept={handleAcceptTicket}
                  onFinalize={handleFinalizeTicket}
                  currentUser={user.name}
                  isProcessing={processingId === ticket.id}
                />
              ))
            )}
          </div>
        </aside>

      </div>
    </div>
  );
};

export default App;