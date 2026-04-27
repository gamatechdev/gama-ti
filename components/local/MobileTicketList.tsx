import React from 'react';
// Importa o tipo Chamado contendo a definição da estrutura de dados de um ticket no sistema
import { Chamado } from '../../types';
// Importa a função format da biblioteca date-fns para lidar com formatação de datas
import { format } from 'date-fns';
// Importa a localização de idioma ptBR da biblioteca date-fns para datas estarem em português
import { ptBR } from 'date-fns/locale/pt-BR';
// Importa os ícones do Lucide React que serão utilizados para compor o visual dos cards
import { MessageSquare, Calendar, User, Monitor, Hash, CheckCircle2, Search } from 'lucide-react';

// Define a interface com as props aceitas pelo nosso componente MobileTicketList
interface MobileTicketListProps {
  // Lista dos chamados que vamos mapear
  tickets: Chamado[];
  // Callback disparado quando o usuário clica sobre a área geral do card (abre os detalhes)
  onTicketClick: (ticket: Chamado) => void;
  // Callback disparado quando o usuário clica no botão de chat (abre o modal de chat)
  onChatClick: (ticket: Chamado) => void;
  // O valor textual atual correspondente ao filtro sendo procurado
  searchValue: string;
  // A ação despachada subindo para modificar o valor no state principal (no App.tsx)
  onSearchChange: (value: string) => void;
}

// Exporta o componente de função responsável pela visualização mobile em cards
export const MobileTicketList: React.FC<MobileTicketListProps> = ({
  tickets,
  onTicketClick,
  onChatClick,
  searchValue,
  onSearchChange
}) => {
  return (
    <div className="flex flex-col gap-4 mt-2">

      {/* Search */}
      <div className="relative group mx-4 mt-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 transition-colors group-focus-within:text-indigo-400" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Pesquisar chamados..."
          className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
        />
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4">
        {tickets.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm bg-slate-800/40 border border-slate-800 rounded-xl">
            Nenhum chamado corresponde aos filtros aplicados.
          </div>
        ) : (
          tickets.map((t) => (
            <div
              key={t.id}
              onClick={() => onTicketClick(t)}
              className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-col gap-3 relative cursor-pointer hover:border-indigo-500/50 transition-colors"
            >
              {/* Header */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-col">
                  <span className="text-xs text-indigo-400 font-mono font-medium flex items-center gap-1">
                    <Hash className="w-3 h-3" /> {t.id}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-200 mt-1 line-clamp-2">
                    {t.titulo}
                  </h3>
                </div>

                <span
                  className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold border shrink-0 ${t.status === 'Concluído'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : t.status === 'Em andamento'
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                    }`}
                >
                  {t.status || 'Novo'}
                </span>
              </div>

              {/* Divider */}
              <div className="h-px w-full bg-slate-700/50 my-1 border-dashed border-b border-slate-700"></div>

              {/* Info */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> Solicitante:
                  </span>
                  <span className="text-slate-300 font-medium">
                    {t.solicitante || '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Monitor className="w-3.5 h-3.5" /> Responsável:
                  </span>
                  <span className="text-slate-300 font-medium">
                    {t.responsavel || '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Solicitado:
                  </span>
                  <span className="text-slate-400">
                    {t.created_at
                      ? format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', {
                        locale: ptBR
                      })
                      : '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolvido:
                  </span>
                  <span className="text-slate-400">
                    {t.conclued_at
                      ? format(new Date(t.conclued_at), 'dd/MM/yyyy HH:mm', {
                        locale: ptBR
                      })
                      : '-'}
                  </span>
                </div>
              </div>

              {/* Button */}
              <div className="mt-2 flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChatClick(t);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors text-xs font-medium w-full justify-center"
                >
                  <MessageSquare className="w-4 h-4" />
                  Abrir Chat
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
