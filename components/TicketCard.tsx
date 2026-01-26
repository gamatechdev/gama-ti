import React from 'react';
import { Chamado } from '../types';
import { Clock, User, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketCardProps {
  ticket: Chamado;
  onAccept: (id: number) => void;
  onFinalize: (id: number) => void;
  currentUser: string;
  isProcessing: boolean;
}

export const TicketCard: React.FC<TicketCardProps> = ({ 
  ticket, 
  onAccept, 
  onFinalize,
  currentUser, 
  isProcessing 
}) => {
  const isAssigned = !!ticket.responsavel;
  const isMine = ticket.responsavel === currentUser;
  const isDone = ticket.status === 'Concluído';

  return (
    <div className={`p-4 mb-3 rounded-lg border transition-all duration-200 ${
      isDone 
        ? 'bg-slate-800/40 border-slate-800 opacity-60 hover:opacity-100' 
        : 'bg-slate-800 border-slate-700 hover:border-slate-600 shadow-sm hover:shadow-md'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className={`font-semibold text-sm md:text-base line-clamp-2 ${isDone ? 'text-slate-400 line-through' : 'text-slate-100'}`}>
          {ticket.titulo || 'Sem título'}
        </h3>
        <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full ${
          ticket.status === 'pendente' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
          ticket.status === 'Em andamento' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
          'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
        }`}>
          {ticket.status || 'Novo'}
        </span>
      </div>
      
      <p className="text-slate-400 text-xs md:text-sm mb-3 line-clamp-3">
        {ticket.descricao || 'Sem descrição'}
      </p>

      <div className="flex flex-col gap-2 mt-2">
        <div className="flex items-center text-xs text-slate-500 gap-2">
          <Clock className="w-3 h-3" />
          <span>
            {ticket.created_at 
              ? formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })
              : 'Data desconhecida'}
          </span>
        </div>
        
        <div className="flex items-center text-xs text-slate-500 gap-2">
          <User className="w-3 h-3" />
          <span className={!ticket.solicitante ? 'italic' : ''}>
             Solicitante: {ticket.solicitante || 'Anônimo'}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-700/50">
        {isAssigned ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Responsável:</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isMine ? 'bg-indigo-500' : 'bg-slate-600'}`} />
                <span className={isMine ? 'text-indigo-400 font-medium' : 'text-slate-400'}>
                  {ticket.responsavel} {isMine ? '(Você)' : ''}
                </span>
              </div>
            </div>

            {isMine && !isDone && (
              <button
                onClick={() => onFinalize(ticket.id)}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 px-3 rounded-md text-xs font-semibold transition-all hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Finalizar Atendimento
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onAccept(ticket.id)}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-400 text-white py-2 px-3 rounded-md text-xs font-semibold transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
          >
            Aceitar Chamado
          </button>
        )}
      </div>
    </div>
  );
};