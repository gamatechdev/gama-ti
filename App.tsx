import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Chamado, UserSession } from './types';
import { TicketCard } from './components/TicketCard';
import { NewTicketModal } from './components/NewTicketModal';
import { TicketChatModal } from './components/TicketChatModal';
import { TicketDetailsModal } from './components/TicketDetailsModal';
import { CreateTicketModal } from './components/CreateTicketModal';
import { Login } from './components/Login';
import { MobileTicketList } from './components/local/MobileTicketList';
import { playNotificationSound } from './utils/sound';
import {
  Users,
  Search,
  Filter,
  ChevronDown,
  MoreVertical,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Inbox,
  Layers,
  LogOut,
  List,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FilterX,
  MessageSquare,
  Plus,
  X
} from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useScreenWidth } from './utils/useScreenWidth';
import { Sidebar } from './components/features/Sidebar';
import { CategoriesManager } from './components/features/CategoriesManager';
import { FiltersModal, MultiFilters } from './components/local/FiltersModal';

const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tickets, setTickets] = useState<Chamado[]>([]);
  const [newTicket, setNewTicket] = useState<Chamado | null>(null);
  const [activeChatTicket, setActiveChatTicket] = useState<Chamado | null>(null);
  const [detailsTicket, setDetailsTicket] = useState<Chamado | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [slas, setSlas] = useState<any[]>([]);

  // Estados para Busca e Filtros
  const [searchDesc, setSearchDesc] = useState('');
  const [selectedSolicitante, setSelectedSolicitante] = useState<string | null>(null);
  const [selectedResponsavel, setSelectedResponsavel] = useState<string | null>(null);
  const [showSolicitanteDropdown, setShowSolicitanteDropdown] = useState(false);
  const [showResponsavelDropdown, setShowResponsavelDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mainTab, setMainTab] = useState('dashboard');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [userImgMap, setUserImgMap] = useState<Record<string, string>>({});

  // Estados para Filtros Avançados (Multi-seleção)
  const [multiFilters, setMultiFilters] = useState<MultiFilters>({
    solicitantes: [],
    responsaveis: [],
    status: [],
    prioridades: [],
  });
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  const [showMobileQueue, setShowMobileQueue] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'queue' | 'myTickets'>('queue');

  const [loadingTickets, setLoadingTickets] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const screenWidth = useScreenWidth();
  const audioEnabled = useRef(false);

  // Solicita permissão para notificações desktop
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(console.warn);
    }
  }, []);

  // --- Auth & Profile Logic ---
  useEffect(() => {
    let mounted = true;

    // Função separada que carrega o usuário de forma OTIMISTA (sem travar a tela)
    const setupUserOptimistically = async (session: any) => {
      // 1. CARREGAMENTO IMEDIATO: Libera o sistema usando os dados básicos da sessão
      if (mounted) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Técnico',
          email: session.user.email,
          // O avatar fica undefined temporariamente até o DB responder
        });
        setAuthLoading(false); // <- ISSO AQUI ACABA COM A DEMORA! O sistema abre na hora.
        audioEnabled.current = true;
      }

      // 2. Busca a foto e o nome de usuário em segundo plano (não bloqueia a renderização)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('user_id, username, img_url, role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        // 3. Quando o DB responder, atualiza o perfil silenciosamente
        if (data && mounted) {
          setUser(prev => prev ? {
            ...prev,
            db_id: data.user_id,                   // Adiciona o ID sequencial do banco
            name: data.username || prev.name, // Substitui pelo nome real se existir
            avatar: data.img_url,             // Adiciona a foto de perfil
            role_id: data.role,            // Adiciona o ID da role
          } : null);
        }
      } catch (err) {
        console.warn("[AUTH DEBUG] Erro não-fatal ao buscar detalhes do perfil:", err);
      }
    };

    const initializeAuth = async () => {
      try {
        console.log("[AUTH DEBUG] Executando getSession inicial...");
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session?.user) {
          await setupUserOptimistically(session);
        } else {
          if (mounted) {
            setUser(null);
            setAuthLoading(false);
          }
        }
      } catch (err) {
        console.error("[AUTH DEBUG] Corrupção de sessão. Iniciando limpeza profunda...", err);
        // O "Wipe Agressivo" que destrói os cookies também (resolve o bug de travar no login)
        localStorage.clear();
        sessionStorage.clear();
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });

        await supabase.auth.signOut().catch(() => { });

        if (mounted) {
          setUser(null);
          setAuthLoading(false);
        }
      }
    };

    initializeAuth();

    // Listener de tempo real mais inteligente
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AUTH DEBUG] onAuthStateChange Evento: ${event}`);
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        // Usa a sessão que o próprio evento entregou em vez de buscar de novo!
        setupUserOptimistically(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setTickets([]);
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // --- SLAs Data ---
  useEffect(() => {
    const fetchSLAs = async () => {
      try {
        const { data, error } = await supabase.from('sla').select('*');
        if (!error && data) setSlas(data);
      } catch (err) {
        console.error('Error fetching SLAs:', err);
      }
    };
    fetchSLAs();
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
          const insertedTicket = payload.new as Chamado;

          setTickets((prev) => [insertedTicket, ...prev]);
          setNewTicket(insertedTicket);

          if (audioEnabled.current) {
            playNotificationSound();

            // Disparar notificação desktop
            if ("Notification" in window && Notification.permission === "granted") {
              const notification = new Notification(`Novo chamado: #${insertedTicket.id}`, {
                body: `${insertedTicket.solicitante || 'Usuário'}: ${insertedTicket.titulo || 'Sem título'}`,
                icon: '/vite.svg'
              });

              notification.onclick = () => {
                window.focus();
                setDetailsTicket(insertedTicket);
              };
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chamados' },
        (payload) => {
          const updatedTicket = payload.new as Chamado;

          setTickets((prev) =>
            prev.map(t => t.id === updatedTicket.id ? updatedTicket : t)
          );

          // Fecha o modal se o chamado foi aceito por outra pessoa
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
  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear(); // Wipe all state aggressively to kill ghost sessions
    sessionStorage.clear();
  };

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
        handleLogout(); // O handleLogout modificado limpa cache
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleFinalizeTicket = async (id: number) => {
    setProcessingId(id);

    // 1. Optimistic Update
    const previousTickets = [...tickets];
    const now = new Date().toISOString();
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'Concluído', conclued_at: now } : t));

    try {
      // 2. Perform DB Update
      await checkSession();
      const { error } = await supabase
        .from('chamados')
        .update({ status: 'Concluído', conclued_at: now })
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

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(tickets.map(t => t.status || 'Novo'))).sort();
  }, [tickets]);

  const uniquePrioridades = useMemo(() => {
    return Array.from(new Set(tickets.map(t => slas.find(s => Number(s.id) === Number(t.sla_id))?.status || '-'))).filter(p => p !== '-').sort();
  }, [tickets, slas]);

  // Busca imagens de perfil para todos os usuários únicos nos filtros
  // Usa um ref para rastrear quais nomes já foram buscados e evitar re-buscas desnecessárias
  const fetchedNamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Obtém todos os nomes ainda não buscados
    const allNames = Array.from(new Set([...uniqueSolicitantes, ...uniqueResponsaveis]));
    const newNames = allNames.filter(n => !fetchedNamesRef.current.has(n));

    // Só faz a requisição se houver nomes novos
    if (newNames.length === 0) return;

    const fetchUserImages = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, img_url, role')
          .in('username', newNames);

        if (!error && data) {
          // Marca os nomes como já buscados
          newNames.forEach(n => fetchedNamesRef.current.add(n));

          // Atualiza o mapa de imagens apenas com os dados novos
          setUserImgMap(prev => {
            const updated = { ...prev };
            data.forEach(u => {
              if (u.img_url) updated[u.username] = u.img_url;
            });
            return updated;
          });
        }
      } catch (err) {
        console.warn("Erro ao buscar imagens dos filtros:", err);
      }
    };

    fetchUserImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueSolicitantes.join(','), uniqueResponsaveis.join(',')]);

  // Filtra os chamados com base no termo de busca e filtros selecionados
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // Busca global básica (Título/Descrição)
      const matchDesc = !searchDesc || (t.descricao?.toLowerCase().includes(searchDesc.toLowerCase()) || t.titulo?.toLowerCase().includes(searchDesc.toLowerCase()));

      // Filtros Multi-seleção (Modal)
      const matchSolicitante = multiFilters.solicitantes.length === 0 || multiFilters.solicitantes.includes(t.solicitante || '');
      const matchResponsavel = multiFilters.responsaveis.length === 0 || multiFilters.responsaveis.includes(t.responsavel || '');
      const matchStatus = multiFilters.status.length === 0 || multiFilters.status.includes(t.status || 'Novo');

      const ticketSlaName = slas.find(s => Number(s.id) === Number(t.sla_id))?.status || '';
      const matchPrioridade = multiFilters.prioridades.length === 0 || multiFilters.prioridades.includes(ticketSlaName);

      // Filtro Data
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

      return matchDesc && matchSolicitante && matchResponsavel && matchStatus && matchPrioridade && matchDate;
    });
  }, [tickets, searchDesc, multiFilters, dateStart, dateEnd, slas]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Carregando sistema...</span>
      </div>
    );
  }

  if (!user) return <Login />;

  const toggleMultiFilter = (category: keyof MultiFilters, value: string) => {
    setMultiFilters(prev => {
      const current = prev[category];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [category]: next };
    });
  };

  const clearAllFilters = () => {
    setSearchDesc('');
    setMultiFilters({
      solicitantes: [],
      responsaveis: [],
      status: [],
      prioridades: [],
    });
    setDateStart('');
    setDateEnd('');
  };

  const isAnyFilterActive = searchDesc || multiFilters.solicitantes.length > 0 || multiFilters.responsaveis.length > 0 || multiFilters.status.length > 0 || multiFilters.prioridades.length > 0 || dateStart || dateEnd;

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

      {showCreateModal && user && (
        <CreateTicketModal
          user={user}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            // Recarrega os chamados ou apenas deixa o realtime agir
            // fetchTickets() seria bom se não estivesse dentro de um useEffect
            // Mas o realtime deve cuidar disso.
          }}
        />
      )}

      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-1.5 rounded-lg overflow-hidden">
            <img src="/gama.png" alt="Gama T.I Logo" className="w-7 h-7 object-contain" />
          </div>
          <h1 className="font-bold text-lg text-slate-100 tracking-wide">
            Gama <span className="text-indigo-400">T.I</span>
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
          <div className="h-8 w-px bg-slate-800 mx-2 hidden md:block"></div>
          <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-400 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowMobileQueue(true)}
            className="md:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700 bg-slate-800/50"
            title="Ver Fila de Chamados"
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-0">

        {/* Sidebar Esquerda */}
        <div className="hidden md:flex">
          <Sidebar
            user={user}
            activeTab={mainTab}
            onTabChange={setMainTab}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>

        {/* Área de Conteúdo Principal */}
        {mainTab === 'categories' ? (
          <CategoriesManager />
        ) : (
          /* Dashboard Area (Center/Left) */
          <main className="flex-1 overflow-y-auto bg-slate-950 p-8 flex flex-col">
          <div className="max-w-6xl w-full mx-auto space-y-8 flex-1 flex flex-col min-h-[500px]">

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
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

              {(user?.role_id === 6 || user?.role_id === 7) && (
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                  </div>
                  <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">Fechados por mim</span>
                  <span className="text-4xl font-bold text-emerald-400 mt-2">{stats.myClosed}</span>
                  <span className="text-xs text-emerald-600 mt-2">Produtividade pessoal</span>
                </div>
              )}
            </div>
            <div className="md:hidden">
              <MobileTicketList
                tickets={filteredTickets}
                onTicketClick={(t) => setDetailsTicket(t)}
                onChatClick={(t) => setActiveChatTicket(t)}
                searchValue={searchDesc}
                onSearchChange={setSearchDesc}
              />
            </div>
            {/* Detailed Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex-1 flex flex-col min-h-0">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-500" />
                  <h2 className="font-semibold text-lg text-white">Todos os Últimos Chamados</h2>
                </div>

                {/* Botão Abrir Chamado */}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                  title="Abrir Novo Chamado"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Abrir Chamado</span>
                </button>
              </div>
              {/* Visualização Mobile em Cards (Visível apenas até breakpoint MD) */}
              {/* Barra de Pesquisa e Filtros */}
              <div className="p-6 bg-slate-900/30 border-b border-slate-800 flex flex-col md:flex-row gap-4 items-end shrink-0">
                {/* Campo de Pesquisa */}
                <div className="flex-1 w-full relative group">
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
                  {/* Botão de Filtros (Abre o Modal) */}
                  <div className="relative">
                    <button
                      onClick={() => setShowFiltersModal(true)}
                      className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${(multiFilters.solicitantes.length > 0 || multiFilters.responsaveis.length > 0 || multiFilters.status.length > 0 || multiFilters.prioridades.length > 0)
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      title="Abrir Filtros"
                    >
                      <List className="w-5 h-5" />
                      {(multiFilters.solicitantes.length + multiFilters.responsaveis.length + multiFilters.status.length + multiFilters.prioridades.length) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold border border-slate-900">
                          {multiFilters.solicitantes.length + multiFilters.responsaveis.length + multiFilters.status.length + multiFilters.prioridades.length}
                        </span>
                      )}
                      <span className="text-xs font-bold hidden sm:inline">Filtros</span>
                    </button>
                  </div>

                  {/* Filtro Data */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowDateDropdown(!showDateDropdown);
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
                  {(searchDesc || multiFilters.solicitantes.length > 0 || multiFilters.responsaveis.length > 0 || multiFilters.status.length > 0 || multiFilters.prioridades.length > 0 || dateStart || dateEnd) && (
                    <button
                      onClick={clearAllFilters}
                      className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                      title="Limpar Filtros"
                    >
                      <FilterX className="w-5 h-5" />
                    </button>
                  )}
                </div>

              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                {/* Visualização Desktop em Tabela (Visível de MD pra cima) */}
                <table className="hidden md:table w-full text-left border-collapse relative">
                  <thead className="sticky top-0 z-10 bg-slate-950">
                    <tr className="bg-slate-950/90 text-slate-400 text-xs uppercase font-semibold backdrop-blur-sm">
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Título</th>
                      <th className="px-6 py-4">Solicitante</th>
                      <th className="px-6 py-4">Responsável</th>
                      <th className="px-6 py-4 whitespace-nowrap">Solicitado em</th>
                      <th className="px-6 py-4 whitespace-nowrap">Resolvido em</th>
                      <th className="px-6 py-4">Prioridade</th>
                      <th className="px-6 py-4">Status</th>
                      {(user?.role_id === 6 || user?.role_id === 7 || user?.db_id) && (
                        <th className="px-6 py-4">Ação</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 h-16">
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
                          <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                            {t.created_at ? format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                          </td>
                          <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                            {t.conclued_at ? format(new Date(t.conclued_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${slas.find(s => Number(s.id) === Number(t.sla_id))?.status === 'Alta'
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : slas.find(s => Number(s.id) === Number(t.sla_id))?.status === 'Média'
                                ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                : slas.find(s => Number(s.id) === Number(t.sla_id))?.status === 'Baixa'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}>
                              {slas.find(s => Number(s.id) === Number(t.sla_id))?.status || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold border whitespace-nowrap inline-flex items-center justify-center ${t.status === 'Concluído' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                              t.status === 'Em andamento' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                              }`}>
                              {t.status || 'Novo'}
                            </span>
                          </td>
                          {(t.solicitante_id === user?.db_id || user?.role_id === 6 || user?.role_id === 7) && (
                            <td className="px-6 py-4">
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdownId(openDropdownId === t.id ? null : t.id);
                                  }}
                                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                {openDropdownId === t.id && (
                                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                    <div className="py-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveChatTicket(t);
                                          setOpenDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                      >
                                        <MessageSquare className="w-4 h-4 text-indigo-400" />
                                        Abrir Chat
                                      </button>

                                      {(user?.role_id === 6 || user?.role_id === 7) && (
                                        <>
                                          <div className="h-px bg-slate-700 my-1" />
                                          {t.status !== 'Concluído' ? (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleFinalizeTicket(t.id);
                                                setOpenDropdownId(null);
                                              }}
                                              className="w-full text-left px-4 py-2 text-sm text-emerald-400 hover:bg-slate-700 flex items-center gap-2"
                                            >
                                              <CheckCircle2 className="w-4 h-4" />
                                              Finalizar Chamado
                                            </button>
                                          ) : (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAcceptTicket(t.id);
                                                setOpenDropdownId(null);
                                              }}
                                              className="w-full text-left px-4 py-2 text-sm text-indigo-400 hover:bg-slate-700 flex items-center gap-2"
                                            >
                                              <Loader2 className="w-4 h-4" />
                                              Reabrir Chamado
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      )}

        {/* Overlay do Mobile */}
        {showMobileQueue && (
          <div
            className="md:hidden absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setShowMobileQueue(false)}
          />
        )}

        {/* Right Sidebar - Queue (Maintained) */}
        <aside className={`
          absolute md:relative top-0 right-0 h-full w-[85%] max-w-[340px] md:max-w-none md:w-[400px] 
          shrink-0 flex flex-col border-l border-slate-800 bg-slate-950 md:bg-slate-900/50 
          transition-transform duration-300 z-50
          ${showMobileQueue ? 'translate-x-0 shadow-2xl' : 'translate-x-full md:translate-x-0'}
        `}>
          <div className="p-2 border-b border-slate-800 bg-slate-900 sticky top-0 z-10 flex flex-col gap-2 shrink-0">
            <div className="flex justify-between items-center px-2 py-1">
              <h2 className="font-semibold text-slate-200 text-sm">Central de Chamados</h2>
              <button
                onClick={() => setShowMobileQueue(false)}
                className="md:hidden p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-red-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveSidebarTab('queue')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeSidebarTab === 'queue'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                Fila ({tickets.length})
              </button>
              <button
                onClick={() => setActiveSidebarTab('myTickets')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeSidebarTab === 'myTickets'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                Meus Chamados ({tickets.filter(t => t.solicitante_id === user?.db_id).length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {loadingTickets ? (
              <div className="flex items-center justify-center h-32 text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Carregando...</span>
              </div>
            ) : (activeSidebarTab === 'queue' ? tickets : tickets.filter(t => t.solicitante_id === user?.db_id)).length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                {activeSidebarTab === 'queue' ? 'Nenhum chamado registrado.' : 'Você não possui chamados em andamento ou finalizados.'}
              </div>
            ) : (
              (activeSidebarTab === 'queue'
                ? tickets
                : tickets.filter(t => t.solicitante_id === user?.db_id && (t.status === 'Em andamento' || t.status === 'Concluído' || t.status === 'Novo'))
              ).map((ticket) => (
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

      <FiltersModal
        isOpen={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        filters={multiFilters}
        onToggleFilter={toggleMultiFilter}
        onClear={clearAllFilters}
        uniqueValues={{
          solicitantes: uniqueSolicitantes,
          responsaveis: uniqueResponsaveis,
          statuses: uniqueStatuses,
          prioridades: uniquePrioridades
        }}
      />
    </div>
  );
};

export default App;