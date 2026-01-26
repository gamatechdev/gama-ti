import React, { useEffect } from 'react';
import { Chamado } from '../types';
import { Bell, Check, X } from 'lucide-react';

interface NewTicketAlertProps {
  ticket: Chamado | null;
  onDismiss: () => void;
  onAccept: (id: number) => void;
  isProcessing: boolean;
}

export const NewTicketAlert: React.FC<NewTicketAlertProps> = ({ ticket, onDismiss, onAccept, isProcessing }) => {
  if (!ticket) return (
    <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 p-8 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50">
      <Bell className="w-16 h-16 mb-4 opacity-20" />
      <h2 className="text-2xl font-semibold mb-2 opacity-50">Nenhum chamado novo</h2>
      <p className="text-sm opacity-40">Aguardando novos chamados em tempo real...</p>
    </div>
  );

  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-slate-800 rounded-2xl shadow-2xl border border-indigo-500/30 overflow-hidden animate-pulse-slow">
        {/* Header Indicator */}
        <div className="bg-indigo-600 text-white px-6 py-3 flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          <span className="font-bold tracking-wider uppercase text-sm">Novo Chamado Recebido</span>
        </div>

        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
              {ticket.titulo || 'Chamado sem título'}
            </h1>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <p className="text-slate-300 text-lg leading-relaxed">
                {ticket.descricao || 'Nenhuma descrição fornecida.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-700/30 p-3 rounded border border-slate-700">
              <span className="text-xs uppercase text-slate-400 font-bold block mb-1">Solicitante</span>
              <span className="text-slate-200">{ticket.solicitante || 'Não identificado'}</span>
            </div>
            <div className="bg-slate-700/30 p-3 rounded border border-slate-700">
              <span className="text-xs uppercase text-slate-400 font-bold block mb-1">Data/Hora</span>
              <span className="text-slate-200">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => onAccept(ticket.id)}
              disabled={isProcessing}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-lg text-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Check className="w-6 h-6" />
              Aceitar Agora
            </button>
            <button 
              onClick={onDismiss}
              className="flex-none bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-4 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              Ignorar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};