import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Chamado, UserSession } from './types';
import { TicketCard } from './components/TicketCard';
import { NewTicketModal } from './components/NewTicketModal';
import { TicketChatModal } from './components/TicketChatModal';
import { TicketDetailsModal } from './components/TicketDetailsModal';
import { Login } from './components/Login';
import { playNotificationSound } from './utils/sound';
import { LayoutDashboard, LogOut, Loader2, Inbox, CheckCircle2, AlertCircle, Layers, MessageSquare, Search, User, Monitor, ChevronDown, FilterX, Calendar } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tickets, setTickets] = useState<Chamado[]>([]);
  const [newTicket, setNewTicket] = useState<Chamado | null>(null);
  const [activeChatTicket, setActiveChatTicket] = useState<Chamado | null>(null);
  const [detailsTicket, setDetailsTicket] = useState<Chamado | null>(null);

  // Estados para Busca e Filtros
  const [searchDesc, setSearchDesc] = useState('');
  const [selectedSolicitante, setSelectedSolicitante] = useState<string | null>(null);
  const [selectedResponsavel, setSelectedResponsavel] = useState<string | null>(null);
  const [showSolicitanteDropdown, setShowSolicitanteDropdown] = useState(false);
  const [showResponsavelDropdown, setShowResponsavelDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [userImgMap, setUserImgMap] = useState<Record<string, string>>({});

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

  // --- Filter Logic ---
  // Obtém listas exclusivas de solicitantes e responsáveis dos chamados atuais
  const uniqueSolicitantes = useMemo(() => {
    const names = tickets.map(t => t.solicitante).filter(Boolean) as string[];
    return Array.from(new Set(names)).sort();
  }, [tickets]);

  const uniqueResponsaveis = useMemo(() => {
    const names = tickets.map(t => t.responsavel).filter(Boolean) as string[];
    return Array.from(new Set(names)).sort();
  }, [tickets]);

  // Busca imagens de perfil para todos os usuários únicos nos filtros
  useEffect(() => {
    const fetchUserImages = async () => {
      const allNames = Array.from(new Set([...uniqueSolicitantes, ...uniqueResponsaveis]));
      if (allNames.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('users')
          .select('username, img_url')
          .in('username', allNames);

        if (!error && data) {
          const map: Record<string, string> = {};
          data.forEach(u => {
            if (u.img_url) map[u.username] = u.img_url;
          });
          setUserImgMap(map);
        }
      } catch (err) {
        console.warn("Erro ao buscar imagens dos filtros:", err);
      }
    };

    fetchUserImages();
  }, [uniqueSolicitantes, uniqueResponsaveis]);

  // Filtra os chamados com base no termo de busca e filtros selecionados
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchDesc = !searchDesc || (t.descricao?.toLowerCase().includes(searchDesc.toLowerCase()) || t.titulo?.toLowerCase().includes(searchDesc.toLowerCase()));
      const matchSolicitante = !selectedSolicitante || t.solicitante === selectedSolicitante;
      const matchResponsavel = !selectedResponsavel || t.responsavel === selectedResponsavel;

      // Lógica de Filtro por Data
      let matchDate = true;
      if (t.created_at) {
        const ticketDate = parseISO(t.created_at);
        if (dateStart && dateEnd) {
          matchDate = isWithinInterval(ticketDate, {
            start: startOfDay(parseISO(dateStart)),
            end: endOfDay(parseISO(dateEnd))
          });
        } else if (dateStart) {
          matchDate = ticketDate >= startOfDay(parseISO(dateStart));
        } else if (dateEnd) {
          matchDate = ticketDate <= endOfDay(parseISO(dateEnd));
        }
      }

      return matchDesc && matchSolicitante && matchResponsavel && matchDate;
    });
  }, [tickets, searchDesc, selectedSolicitante, selectedResponsavel, dateStart, dateEnd]);

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

      {detailsTicket && (
        <TicketDetailsModal
          ticket={detailsTicket}
          onClose={() => setDetailsTicket(null)}
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

              {/* Barra de Pesquisa e Filtros */}
              <div className="p-6 bg-slate-900/30 border-b border-slate-800 flex flex-col md:flex-row gap-4 items-end">
                {/* Campo de Pesquisa */}
                <div className="flex-1 w-full relative group">
                  <label htmlFor="searchDesc" className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2 block">
                    Insira a descrição do chamado
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                      id="searchDesc"
                      type="text"
                      value={searchDesc}
                      onChange={(e) => setSearchDesc(e.target.value)}
                      placeholder="Pesquisar por título ou descrição..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="flex gap-3 shrink-0">
                  {/* Filtro Solicitante */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowSolicitanteDropdown(!showSolicitanteDropdown);
                        setShowResponsavelDropdown(false);
                      }}
                      className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${selectedSolicitante ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      title="Filtrar por Solicitante"
                    >
                      <User className="w-5 h-5" />
                      <ChevronDown className={`w-3 h-3 transition-transform ${showSolicitanteDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showSolicitanteDropdown && (
                      <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-2 border-b border-slate-700 bg-slate-800/50">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">Solicitantes</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                          <button
                            onClick={() => {
                              setSelectedSolicitante(null);
                              setShowSolicitanteDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center justify-between"
                          >
                            Todos
                            {!selectedSolicitante && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                          </button>
                          {uniqueSolicitantes.map(name => (
                            <button
                              key={name}
                              onClick={() => {
                                setSelectedSolicitante(name);
                                setShowSolicitanteDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-3 group/item transition-colors"
                            >
                              <div className="flex-1 flex items-center gap-3 overflow-hidden">
                                {userImgMap[name] ? (
                                  <img src={userImgMap[name]} alt={name} className="w-6 h-6 rounded-full object-cover border border-slate-600 shadow-sm" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-600 group-hover/item:border-indigo-500/50 transition-colors">
                                    {name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="truncate">{name}</span>
                              </div>
                              {selectedSolicitante === name && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Filtro Responsável */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowResponsavelDropdown(!showResponsavelDropdown);
                        setShowSolicitanteDropdown(false);
                      }}
                      className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${selectedResponsavel ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      title="Filtrar por Responsável"
                    >
                      <Monitor className="w-5 h-5" />
                      <ChevronDown className={`w-3 h-3 transition-transform ${showResponsavelDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showResponsavelDropdown && (
                      <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-2 border-b border-slate-700 bg-slate-800/50">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">Responsáveis</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                          <button
                            onClick={() => {
                              setSelectedResponsavel(null);
                              setShowResponsavelDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center justify-between"
                          >
                            Todos
                            {!selectedResponsavel && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                          </button>
                          {uniqueResponsaveis.map(name => (
                            <button
                              key={name}
                              onClick={() => {
                                setSelectedResponsavel(name);
                                setShowResponsavelDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-3 group/item transition-colors"
                            >
                              <div className="flex-1 flex items-center gap-3 overflow-hidden">
                                {userImgMap[name] ? (
                                  <img src={userImgMap[name]} alt={name} className="w-6 h-6 rounded-full object-cover border border-slate-600 shadow-sm" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-600 group-hover/item:border-indigo-500/50 transition-colors">
                                    {name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="truncate">{name}</span>
                              </div>
                              {selectedResponsavel === name && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Filtro Data */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowDateDropdown(!showDateDropdown);
                        setShowSolicitanteDropdown(false);
                        setShowResponsavelDropdown(false);
                      }}
                      className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${(dateStart || dateEnd) ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      title="Filtrar por Data"
                    >
                      <Calendar className="w-5 h-5" />
                      <ChevronDown className={`w-3 h-3 transition-transform ${showDateDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showDateDropdown && (
                      <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-3 border-b border-slate-700 bg-slate-800/50">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Filtrar por Data</span>
                        </div>
                        <div className="p-4 space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 uppercase font-medium">Data Inicial</label>
                            <input
                              type="date"
                              value={dateStart}
                              onChange={(e) => setDateStart(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all [color-scheme:dark]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 uppercase font-medium">Data Final</label>
                            <input
                              type="date"
                              value={dateEnd}
                              onChange={(e) => setDateEnd(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all [color-scheme:dark]"
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => {
                                const today = new Date().toISOString().split('T')[0];
                                setDateStart(today);
                                setDateEnd(today);
                              }}
                              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold py-1.5 rounded-md transition-colors"
                            >
                              Hoje
                            </button>
                            <button
                              onClick={() => {
                                setDateStart('');
                                setDateEnd('');
                                setShowDateDropdown(false);
                              }}
                              className="flex-1 bg-slate-700/50 hover:bg-red-500/20 hover:text-red-400 text-slate-400 text-[10px] font-bold py-1.5 rounded-md transition-colors"
                            >
                              Limpar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botão Limpar Filtros (se houver filtros ativos) */}
                  {(searchDesc || selectedSolicitante || selectedResponsavel || dateStart || dateEnd) && (
                    <button
                      onClick={() => {
                        setSearchDesc('');
                        setSelectedSolicitante(null);
                        setSelectedResponsavel(null);
                        setDateStart('');
                        setDateEnd('');
                      }}
                      className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                      title="Limpar Filtros"
                    >
                      <FilterX className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase font-semibold">
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Título</th>
                      <th className="px-6 py-4">Solicitante</th>
                      <th className="px-6 py-4">Responsável</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                          {tickets.length === 0 ? 'Nenhum registro encontrado.' : 'Nenhum chamado corresponde aos filtros aplicados.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map((t) => (
                        <tr
                          key={t.id}
                          // Abre os detalhes ao clicar na linha
                          onClick={() => setDetailsTicket(t)}
                          className="hover:bg-slate-800/50 transition-colors text-sm group cursor-pointer"
                        >
                          <td className="px-6 py-4 text-slate-500 font-mono group-hover:text-indigo-400 transition-colors">#{t.id}</td>
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
                            <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold border ${t.status === 'Concluído' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                              t.status === 'Em andamento' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                              }`}>
                              {t.status || 'Novo'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={(e) => {
                                // Interrompe a propagação para não abrir os detalhes
                                e.stopPropagation();
                                // Abre o chat
                                setActiveChatTicket(t);
                              }}
                              className="p-2 bg-slate-800 rounded-lg hover:bg-indigo-600 hover:text-white text-slate-400 transition-colors"
                              title="Abrir Chat"
                            >
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
                  // Configura para abrir detalhes agora
                  onClick={(t) => setDetailsTicket(t)}
                  // Configura para abrir chat no ícone azul
                  onChatClick={(t) => setActiveChatTicket(t)}
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