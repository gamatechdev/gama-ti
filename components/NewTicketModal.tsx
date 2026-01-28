import React from 'react';
import { Chamado } from '../types';
import { Bell, Check, X, Clock, User } from 'lucide-react';

interface NewTicketModalProps {
  ticket: Chamado | null;
  onDismiss: () => void;
  onAccept: (id: number) => void;
  isProcessing: boolean;
}

export const NewTicketModal: React.FC<NewTicketModalProps> = ({ ticket, onDismiss, onAccept, isProcessing }) => {
  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full animate-pulse">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg tracking-wide">Novo Chamado Recebido</h2>
          </div>
          <button onClick={onDismiss} disabled={isProcessing} className="text-white/70 hover:text-white transition-colors disabled:opacity-50">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
            {ticket.titulo || 'Sem título'}
          </h3>
          
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6">
            <p className="text-slate-300 text-sm leading-relaxed max-h-32 overflow-y-auto">
              {ticket.descricao || 'Nenhuma descrição fornecida.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <User className="w-4 h-4 text-indigo-400" />
              <span className="truncate">{ticket.solicitante || 'Anônimo'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Agora</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
             <button 
              onClick={onDismiss}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl font-semibold transition-colors"
            >
              Ignorar
            </button>
            <button 
              onClick={() => onAccept(ticket.id)}
              disabled={isProcessing}
              className="flex-[2] px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {isProcessing ? (
                <span>Processando...</span>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Aceitar Chamado
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};