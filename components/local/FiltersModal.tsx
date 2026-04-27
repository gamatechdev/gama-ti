import React from 'react';
import { X, List, Inbox, AlertCircle, User, Monitor, Check, Calendar, Search } from 'lucide-react';

// Interface que define a estrutura dos filtros ativos
export interface MultiFilters {
  solicitantes: string[];
  responsaveis: string[];
  status: string[];
  prioridades: string[];
}

// Props do componente FiltersModal
interface FiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: MultiFilters;
  onToggleFilter: (category: keyof MultiFilters, value: string) => void;
  onClear: () => void;
  // Listas de valores únicos extraídos da base de dados
  uniqueValues: {
    solicitantes: string[];
    responsaveis: string[];
    statuses: string[];
    prioridades: string[];
  };
}

export function FiltersModal({
  isOpen,
  onClose,
  filters,
  onToggleFilter,
  onClear,
  uniqueValues
}: FiltersModalProps) {
  // Estados locais para busca dentro das listas de usuários
  const [searchSolicitante, setSearchSolicitante] = React.useState('');
  const [searchResponsavel, setSearchResponsavel] = React.useState('');

  if (!isOpen) return null;

  // Filtra as listas baseadas no input de busca local
  const filteredSolicitantes = uniqueValues.solicitantes.filter(name =>
    name.toLowerCase().includes(searchSolicitante.toLowerCase())
  );
  const filteredResponsaveis = uniqueValues.responsaveis.filter(name =>
    name.toLowerCase().includes(searchResponsavel.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay com desfoque */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Container do Modal */}
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200">

        {/* Header do Modal */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
              <List className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Filtrar Chamados</h3>
              <p className="text-xs text-slate-500">Selecione os critérios para refinar sua busca</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Seção: Status */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-l-2 border-indigo-500 pl-2">
                <Inbox className="w-3.5 h-3.5" /> Status
              </div>
              <div className="grid grid-cols-2 gap-2">
                {uniqueValues.statuses.map(val => (
                  <button
                    key={val}
                    onClick={() => onToggleFilter('status', val)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${filters.status.includes(val)
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.status.includes(val) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700'
                      }`}>
                      {filters.status.includes(val) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Seção: Prioridade */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-l-2 border-indigo-500 pl-2">
                <AlertCircle className="w-3.5 h-3.5" /> Prioridade
              </div>
              <div className="grid grid-cols-2 gap-2">
                {uniqueValues.prioridades.map(val => (
                  <button
                    key={val}
                    onClick={() => onToggleFilter('prioridades', val)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${filters.prioridades.includes(val)
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.prioridades.includes(val) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700'
                      }`}>
                      {filters.prioridades.includes(val) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid: Solicitantes e Responsáveis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            {/* Coluna: Solicitantes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-l-2 border-indigo-500 pl-2">
                  <User className="w-3.5 h-3.5" /> Solicitantes
                </div>
                <span className="text-[10px] text-slate-600 font-medium bg-slate-950 px-1.5 py-0.5 rounded">
                  {filteredSolicitantes.length}
                </span>
              </div>

              {/* Campo de Busca Interno */}
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  value={searchSolicitante}
                  onChange={(e) => setSearchSolicitante(e.target.value)}
                  placeholder="Filtrar nomes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-700"
                />
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {filteredSolicitantes.length === 0 ? (
                  <div className="py-8 text-center text-[10px] text-slate-600 italic">Nenhum nome encontrado</div>
                ) : (
                  filteredSolicitantes.map(val => (
                    <button
                      key={val}
                      onClick={() => onToggleFilter('solicitantes', val)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${filters.solicitantes.includes(val)
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'text-slate-400 hover:bg-slate-800/50'
                        }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.solicitantes.includes(val) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700'
                        }`}>
                        {filters.solicitantes.includes(val) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="truncate">{val}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Coluna: Responsáveis */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-l-2 border-indigo-500 pl-2">
                  <Monitor className="w-3.5 h-3.5" /> Responsáveis
                </div>
                <span className="text-[10px] text-slate-600 font-medium bg-slate-950 px-1.5 py-0.5 rounded">
                  {filteredResponsaveis.length}
                </span>
              </div>

              {/* Campo de Busca Interno */}
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  value={searchResponsavel}
                  onChange={(e) => setSearchResponsavel(e.target.value)}
                  placeholder="Filtrar nomes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-700"
                />
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {filteredResponsaveis.length === 0 ? (
                  <div className="py-8 text-center text-[10px] text-slate-600 italic">Nenhum nome encontrado</div>
                ) : (
                  filteredResponsaveis.map(val => (
                    <button
                      key={val}
                      onClick={() => onToggleFilter('responsaveis', val)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${filters.responsaveis.includes(val)
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'text-slate-400 hover:bg-slate-800/50'
                        }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.responsaveis.includes(val) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700'
                        }`}>
                        {filters.responsaveis.includes(val) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="truncate">{val}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer com Ações */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
          <button
            onClick={onClear}
            className="text-[10px] font-bold text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest"
          >
            Limpar Tudo
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

