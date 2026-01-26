import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Chamado, UserSession } from './types';
import { TicketCard } from './components/TicketCard';
import { NewTicketAlert } from './components/NewTicketAlert';
import { Login } from './components/Login';
import { playNotificationSound } from './utils/sound';
import { LayoutDashboard, LogOut, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [tickets, setTickets] = useState<Chamado[]>([]);
  const [newTicket, setNewTicket] = useState<Chamado | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Sound enablement tracking (browsers block auto audio)
  const audioEnabled = useRef(false);
  // Track if user data is fully loaded to prevent redundant loading screens
  const userLoadedRef = useRef(false);

  // Auth Handling
  useEffect(() => {
    let mounted = true;
    console.log("[App] Component Mounted");

    const fetchUserProfile = async (userId: string, email?: string) => {
      console.log(`[Profile] Fetching profile for user_id: ${userId}`);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('username, img_url') 
          .eq('user_id', userId)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.warn("[Profile] Error fetching details:", error.message);
          setUser({ name: email?.split('@')[0] || 'Técnico' });
        } else if (data) {
          console.log("[Profile] User profile found:", data.username);
          setUser({ 
            name: data.username, 
            avatar: data.img_url 
          });
        } else {
          console.warn("[Profile] No profile row found in 'users' table");
          setUser({ name: email?.split('@')[0] || 'Técnico' });
        }
        userLoadedRef.current = true;
      } catch (e) {
        console.error("[Profile] Exception during fetch:", e);
        if (mounted) setUser({ name: email?.split('@')[0] || 'Técnico' });
        userLoadedRef.current = true;
      }
    };

    const initAuth = async () => {
      console.log("[Auth] Initializing session check...");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && mounted) {
          console.log("[Auth] Existing session found");
          await fetchUserProfile(session.user.id, session.user.email);
          audioEnabled.current = true;
        } else {
          console.log("[Auth] No active session found");
        }
      } catch (error) {
        console.error("[Auth] Init error:", error);
      } finally {
        if (mounted) {
          setAuthLoading(false);
          console.log("[Auth] Initial loading phase complete");
        }
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth Event] ${event}`);
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        // Prevent showing "Loading system..." if we already have the user loaded.
        // This prevents UI freezing if SIGNED_IN fires multiple times (e.g. token refresh)
        const shouldShowLoading = !userLoadedRef.current;
        
        if (shouldShowLoading) {
          console.log("[Auth] New sign-in detected, showing loader");
          setAuthLoading(true);
        } else {
          console.log("[Auth] Session update (background)");
        }

        try {
          await fetchUserProfile(session.user.id, session.user.email);
          audioEnabled.current = true;
        } finally {
          if (mounted && shouldShowLoading) {
            setAuthLoading(false);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log("[Auth] User signed out");
        setUser(null);
        setTickets([]);
        userLoadedRef.current = false;
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Data Fetching & Subscriptions
  useEffect(() => {
    if (!user) return;

    console.log("[Tickets] Setting up tickets fetch and subscriptions");

    const fetchTickets = async () => {
      setLoadingTickets(true);
      const { data, error } = await supabase
        .from('chamados')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Tickets] Error fetching history:', error);
      } else {
        console.log(`[Tickets] Fetched ${data?.length || 0} tickets`);
        setTickets(data || []);
      }
      setLoadingTickets(false);
    };

    fetchTickets();

    const channel = supabase
      .channel('public:chamados')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chamados' },
        (payload) => {
          console.log("[Realtime] INSERT event received:", payload);
          const insertedTicket = payload.new as Chamado;
          
          setTickets((prev) => [insertedTicket, ...prev]);
          setNewTicket(insertedTicket);
          
          if (audioEnabled.current) {
            console.log("[Sound] Playing notification sound");
            playNotificationSound();
          } else {
             console.log("[Sound] Skipped (audio not enabled yet)");
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chamados' },
        (payload) => {
          console.log("[Realtime] UPDATE event received:", payload);
          const updatedTicket = payload.new as Chamado;
          setTickets((prev) => 
            prev.map(t => t.id === updatedTicket.id ? updatedTicket : t)
          );
          
          // If the updated ticket is the one currently in the "New Ticket" alert,
          // and it now has a responsible person, clear the alert.
          setNewTicket(current => {
             if (current && current.id === updatedTicket.id && updatedTicket.responsavel) {
                console.log("[Realtime] Clearing alert for ticket ID", updatedTicket.id);
                return null;
             }
             return current;
          });
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status: ${status}`);
      });

    return () => {
      console.log("[Realtime] Cleaning up subscription");
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleLogout = async () => {
    console.log("[Auth] Manual logout requested");
    await supabase.auth.signOut();
  };

  const handleAcceptTicket = async (id: number) => {
    if (!user) return;
    console.log(`[Action] Accepting ticket ${id}`);
    setProcessingId(id);

    try {
      const { error } = await supabase
        .from('chamados')
        .update({ 
          responsavel: user.name,
          status: 'Em andamento'
        })
        .eq('id', id);

      if (error) throw error;
      console.log(`[Action] Ticket ${id} accepted successfully`);
      
      if (newTicket && newTicket.id === id) {
        setNewTicket(null);
      }

    } catch (err) {
      console.error("[Action] Error accepting ticket:", err);
      alert("Erro ao aceitar chamado. Tente novamente.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleFinalizeTicket = async (id: number) => {
    if (!user) return;
    console.log(`[Action] Finalizing ticket ${id}`);
    setProcessingId(id);

    try {
      const { error } = await supabase
        .from('chamados')
        .update({ 
          status: 'Concluído'
        })
        .eq('id', id);

      if (error) throw error;
      console.log(`[Action] Ticket ${id} finalized successfully`);
    } catch (err) {
      console.error("[Action] Error finalizing ticket:", err);
      alert("Erro ao finalizar chamado. Tente novamente.");
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Carregando sistema...</span>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-10">
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
              <img 
                src={user.avatar} 
                alt={user.name} 
                className="w-10 h-10 rounded-full border-2 border-slate-700 object-cover bg-slate-800"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold border-2 border-slate-700">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="h-8 w-px bg-slate-800 mx-2"></div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-400 transition-colors"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left/Center Area - Major Alerts - Takes remaining width */}
        <main className="flex-1 border-r border-slate-800 bg-slate-950 relative flex flex-col min-w-0">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          <NewTicketAlert 
            ticket={newTicket} 
            onDismiss={() => setNewTicket(null)}
            onAccept={handleAcceptTicket}
            isProcessing={processingId === (newTicket?.id ?? -1)}
          />
        </main>

        {/* Right Area - Ticket History/List - Fixed Width for Proportion Stability */}
        <aside className="w-[400px] shrink-0 bg-slate-900/50 flex flex-col border-l border-slate-800">
          <div className="p-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10 flex justify-between items-center h-16 shrink-0">
            <h2 className="font-semibold text-slate-200">Fila de Chamados</h2>
            <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs">
              {tickets.length} total
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
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