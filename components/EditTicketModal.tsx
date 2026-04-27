import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { X, Save, Loader2, Tag, FileText, Layout, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { UserSession, Chamado, Category } from '../types';

interface EditTicketModalProps {
  ticket: Chamado;
  user: UserSession;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditTicketModal: React.FC<EditTicketModalProps> = ({ ticket, user, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [categorias, setCategorias] = useState<Category[]>([]);

  // Estados do formulário baseados no chamado atual
  const [titulo, setTitulo] = useState(ticket.titulo || '');
  const [descricao, setDescricao] = useState(ticket.descricao || '');
  const [status, setStatus] = useState(ticket.status || 'Não iniciado');
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number | undefined>(ticket.categorie_id || undefined);

  // Verifica se o usuário pode editar o status (apenas Role 6 ou 7)
  const canEditStatus = Number(user.role_id) === 6 || Number(user.role_id) === 7;

  // Busca categorias
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from('categoria_chamados')
          .select('*');

        if (error) throw error;
        setCategorias(data || []);
      } catch (err) {
        console.error('Erro ao buscar categorias:', err);
      } finally {
        setFetchingData(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !descricao || !selectedCategoriaId || !status) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      const categoriaObj = categorias.find(c => c.id === Number(selectedCategoriaId));
      
      const updateData: any = {
        titulo,
        descricao,
        status,
        categorie_id: selectedCategoriaId,
        sla_id: categoriaObj?.sla_id,
      };

      // Se mudar para concluído e não tiver data de conclusão, define agora
      if (status === 'Concluído' && !ticket.conclued_at) {
        updateData.conclued_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('chamados')
        .update(updateData)
        .eq('id', ticket.id);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao atualizar chamado:', err);
      alert('Erro ao atualizar chamado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { value: 'Não iniciado', label: 'Não iniciado', icon: AlertCircle, color: 'text-red-400' },
    { value: 'Em Aberto', label: 'Em Aberto', icon: Clock, color: 'text-amber-400' },
    { value: 'Em andamento', label: 'Em andamento', icon: Clock, color: 'text-indigo-400' },
    { value: 'Concluído', label: 'Concluído', icon: CheckCircle2, color: 'text-emerald-400' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 p-2 rounded-lg">
              <Save className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg tracking-wide">Editar Chamado #{ticket.id}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Título */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-3 h-3 text-amber-400" /> Nome do Chamado
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500 transition-all"
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Layout className="w-3 h-3 text-amber-400" /> Categoria
            </label>
            <select
              value={selectedCategoriaId || ''}
              onChange={(e) => setSelectedCategoriaId(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
              required
              disabled={fetchingData}
            >
              <option value="" disabled>Selecione uma categoria</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-3 h-3 text-amber-400" /> Status do Chamado
            </label>
            <div className="grid grid-cols-3 gap-2">
              {statusOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!canEditStatus}
                    onClick={() => setStatus(opt.value)}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all ${
                      isSelected 
                        ? 'bg-slate-800 border-amber-500 text-white shadow-lg' 
                        : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600'
                    } ${!canEditStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={!canEditStatus ? "Apenas técnicos podem alterar o status" : ""}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? opt.color : ''}`} />
                    <span className="text-[10px] font-bold uppercase">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3 h-3 text-amber-400" /> Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500 transition-all resize-none"
              required
            />
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || fetchingData}
              className="flex-[2] px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
