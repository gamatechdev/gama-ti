import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { X, Plus, Loader2, Tag, FileText, Layout, Check } from 'lucide-react';
import { UserSession } from '../types';

interface Categoria {
  id: number;
  nome: string;
  sla: string;
  sla_id: number;
}

interface CreateTicketModalProps {
  user: UserSession;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({ user, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  // Estados do formulário
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(null);

  // Busca categorias e seus respectivos SLAs
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Busca categorias (agora assumindo que o campo sla já contém o valor a ser exibido)
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
  useEffect(() => {
    console.log(categorias);
  }, [categorias])
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !descricao || !selectedCategoria) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true); // Ativa o estado de carregamento do botão
    try {
      // Tenta inserir o novo chamado na tabela 'chamados' do banco de dados
      const { error } = await supabase
        .from('chamados')
        .insert([
          {
            titulo, // Título fornecido pelo usuário
            descricao, // Descrição detalhada do problema
            solicitante: user.name, // Nome do usuário logado
            status: 'Não iniciado', // Status inicial padrão
            responsavel: 'Arthur Silva', // Responsável fixo para triagem (exemplo)
            solicitante_id: user.db_id, // ID numérico do solicitante
            responsavel_id: '92b01c3c-af11-4d37-bb30-087f828e6d48', // UUID do responsável fixo
            ti_leu: false, // Marca que a equipe técnica ainda não visualizou
            categorie_id: selectedCategoria?.id, // ID da categoria selecionada
            sla_id: selectedCategoria?.sla_id, // ID do SLA vinculado à categoria
            created_at: new Date().toISOString(), // Data e hora da criação
          }
        ]);

      if (error) throw error; // Lança erro se a requisição ao Supabase falhar

      // Exibe notificação de sucesso para o usuário
      toast.success('Chamado aberto com sucesso!');
      
      onSuccess(); // Executa o callback de sucesso (ex: atualizar lista)
      onClose(); // Fecha o modal
    } catch (err) {
      // Loga o erro detalhado no console para depuração
      console.error('Erro ao criar chamado:', err);
      // Exibe notificação de erro amigável para o usuário
      toast.error('Ocorreu um erro ao abrir o chamado. Tente novamente.');
    } finally {
      setLoading(false); // Desativa o estado de carregamento do botão
    }
  };
  useEffect(() => {
    console.log(selectedCategoria)
  }, [selectedCategoria])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg tracking-wide">Abrir Novo Chamado</h2>
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
              <Tag className="w-3 h-3 text-indigo-400" /> Título do Problema
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Erro ao acessar o sistema"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Layout className="w-3 h-3 text-indigo-400" /> Categoria
            </label>
            <div className="relative">
              <select
                value={selectedCategoria?.id || ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const cat = categorias.find(c => c.id === id);
                  setSelectedCategoria(cat || null);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
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
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                {fetchingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 rotate-45" />}
              </div>
            </div>
            {/* Badge de SLA para a categoria selecionada */}
            {selectedCategoria && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">SLA Estimado:</span>
                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                  {selectedCategoria.sla}
                </span>
              </div>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3 h-3 text-indigo-400" /> Descrição Detalhada
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o problema com o máximo de detalhes possível..."
              rows={4}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600 resize-none"
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
              className="flex-[2] px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Criar Chamado
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
