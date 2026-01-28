import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Chamado, ChatMessage, UserSession } from '../types';
import { X, Send, MessageSquare, Loader2, User, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

interface TicketChatModalProps {
  ticket: Chamado;
  currentUser: UserSession;
  onClose: () => void;
}

export const TicketChatModal: React.FC<TicketChatModalProps> = ({ ticket, currentUser, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    // 1. Fetch initial history
    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('chat_chamados')
        .select('*')
        .eq('chamado_id', ticket.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching chat:', error);
      } else {
        setMessages(data || []);
      }
      setLoading(false);
      scrollToBottom();
    };

    fetchMessages();

    // 2. Subscribe to new messages
    const channel = supabase
      .channel(`chat_chamados:${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_chamados',
          filter: `chamado_id=eq.${ticket.id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          
          setMessages((prev) => {
            // A. Strict deduplication by ID
            if (prev.some(m => m.id === newMsg.id)) return prev;

            // B. Soft deduplication for Optimistic Updates
            // If we have a message in 'SENDING' status that looks just like this incoming one,
            // we assume the incoming one IS the sent one, and we replace it to get the real ID.
            const pendingIndex = prev.findIndex(m => 
               m.status === 'SENDING' && 
               m.text_msg === newMsg.text_msg && 
               m.sent_by === newMsg.sent_by
            );

            if (pendingIndex !== -1) {
              const updated = [...prev];
              updated[pendingIndex] = newMsg; // Replace temp with real
              return updated;
            }

            return [...prev, newMsg];
          });
          
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msgText = newMessage;
    setNewMessage(''); // Clear input immediately
    setSending(true);

    // Optimistic Update: Create a temporary message to show immediately
    const tempId = Date.now(); 
    const optimisticMsg: ChatMessage = {
      id: tempId, // Temporary ID
      chamado_id: ticket.id,
      text_msg: msgText,
      sent_by: currentUser.id,
      status: 'SENDING',
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      // Send to DB
      const { data, error } = await supabase
        .from('chat_chamados')
        .insert({
          chamado_id: ticket.id,
          text_msg: msgText,
          sent_by: currentUser.id,
          status: 'SENT'
        })
        .select()
        .single();

      if (error) throw error;

      // Update the optimistic message with the real ID from DB response
      // Only necessary if Realtime didn't already update it (race condition handled)
      setMessages((prev) => 
        prev.map(msg => {
          if (msg.id === tempId) return data;
          return msg;
        })
      );

    } catch (err) {
      console.error('Error sending message:', err);
      // Mark as error in UI
      setMessages((prev) => 
        prev.map(msg => msg.id === tempId ? { ...msg, status: 'ERROR' } : msg)
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl h-[600px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-lg">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm md:text-base line-clamp-1">
                Chat: {ticket.titulo || 'Chamado sem título'}
              </h2>
              <span className="text-xs text-slate-400">Solicitante: {ticket.solicitante}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/50 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Carregando conversas...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 opacity-50">
              <MessageSquare className="w-10 h-10" />
              <span className="text-sm">Nenhuma mensagem ainda. Inicie a conversa!</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sent_by === currentUser.id;
              const isError = msg.status === 'ERROR';
              
              return (
                <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm relative shadow-sm break-words ${
                      isMe 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                    } ${isError ? 'bg-red-500/20 border-red-500' : ''}`}>
                      {msg.text_msg}
                      
                      {isError && (
                        <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-red-500">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 px-1 flex items-center gap-1">
                      {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      {isMe && ' • Você'}
                      {msg.status === 'SENDING' && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                      {isError && <span className="text-red-400"> • Falha ao enviar</span>}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} className="h-1" />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-3">
             <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-slate-500"
                disabled={sending}
             />
             <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center"
             >
                <Send className="w-5 h-5" />
             </button>
          </form>
        </div>
      </div>
    </div>
  );
};