import React, { useState, useEffect } from 'react'; // Importa o React e hooks necessários
import { toast } from 'sonner'; // Biblioteca para notificações
import {
  Clock, // Ícone de relógio para SLA
  Plus, // Ícone de adição
  Search, // Ícone de busca
  Pencil, // Ícone de edição
  Trash2, // Ícone de lixeira
  Loader2, // Ícone de carregamento
  X, // Ícone de fechar
  ShieldAlert // Ícone para nível de prioridade
} from 'lucide-react'; // Ícones da biblioteca lucide-react
import { supabase } from '../../supabaseClient'; // Cliente Supabase configurado
import { SLA } from '../../types'; // Tipo SLA definido

export function SlaManager() { // Componente Organism para gerenciar SLAs
  const [slas, setSlas] = useState<SLA[]>([]); // Estado da lista de SLAs
  const [loading, setLoading] = useState(true); // Estado de carregamento inicial
  const [searchTerm, setSearchTerm] = useState(''); // Termo para busca local
  const [isModalOpen, setIsModalOpen] = useState(false); // Estado do modal de formulário
  const [editingSla, setEditingSla] = useState<SLA | null>(null); // SLA em edição
  const [isSaving, setIsSaving] = useState(false); // Estado de salvamento no banco

  // Estado dos campos do formulário
  const [formData, setFormData] = useState({
    nome: '', // Nome amigável do SLA
    status: '', // Nível de prioridade (Alta, Média, Baixa)
    deadline_hours: '', // Horas para conclusão
    descricao: '' // Descrição detalhada do SLA
  });

  // Busca os dados ao carregar o componente
  useEffect(() => {
    fetchSlas();
  }, []);

  // Função para buscar SLAs do Supabase
  const fetchSlas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sla')
        .select('*')
        .order('deadline_hours', { ascending: true }); // Ordena por tempo de resposta

      if (error) throw error;
      if (data) setSlas(data);
    } catch (error) {
      console.error('Erro ao buscar SLAs:', error);
      toast.error('Falha ao carregar as configurações de SLA.');
    } finally {
      setLoading(false);
    }
  };

  // Abre o modal para criação ou edição
  const handleOpenModal = (sla: SLA | null = null) => {
    if (sla) {
      setEditingSla(sla);
      setFormData({
        nome: sla.nome,
        status: sla.status,
        deadline_hours: String(sla.deadline_hours),
        descricao: sla.descricao || ''
      });
    } else {
      setEditingSla(null);
      setFormData({ nome: '', status: '', deadline_hours: '', descricao: '' });
    }
    setIsModalOpen(true);
  };

  // Salva ou atualiza o SLA no banco
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      nome: formData.nome,
      status: formData.status,
      deadline_hours: Number(formData.deadline_hours),
      descricao: formData.descricao
    };

    try {
      if (editingSla) {
        // Atualiza SLA existente
        const { error } = await supabase
          .from('sla')
          .update(payload)
          .eq('id', editingSla.id);
        
        if (error) throw error;
        toast.success('SLA atualizado com sucesso!');
      } else {
        // Cria novo SLA
        const { error } = await supabase
          .from('sla')
          .insert([payload]);
        
        if (error) throw error;
        toast.success('Novo SLA criado com sucesso!');
      }
      setIsModalOpen(false);
      fetchSlas();
    } catch (error) {
      console.error('Erro ao salvar SLA:', error);
      toast.error('Erro ao salvar as configurações. Verifique os dados.');
    } finally {
      setIsSaving(false);
    }
  };

  // Exclui um SLA
  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este SLA? Isso pode afetar chamados vinculados.')) return;

    try {
      const { error } = await supabase.from('sla').delete().eq('id', id);
      if (error) throw error;
      toast.success('SLA removido com sucesso!');
      fetchSlas();
    } catch (error) {
      console.error('Erro ao excluir SLA:', error);
      toast.error('Não foi possível excluir o SLA. Ele pode estar em uso.');
    }
  };

  // Filtro de pesquisa local
  const filteredSlas = slas.filter(s => 
    s.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.descricao && s.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col p-8 bg-slate-950 overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 mb-1">
            <Clock className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Administração</span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Gerenciamento de SLA</h2>
          <p className="text-slate-500 text-sm mt-1">Configure os tempos de resposta e níveis de prioridade.</p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Novo SLA
        </button>
      </div>

      {/* Ferramentas */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-t-2xl flex items-center justify-between shrink-0">
        <div className="relative w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          <input
            type="text"
            placeholder="Buscar SLA..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {filteredSlas.length} configurações encontradas
        </div>
      </div>

      {/* Listagem */}
      <div className="flex-1 bg-slate-900 border-x border-b border-slate-800 rounded-b-2xl overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-sm font-medium">Carregando SLAs...</span>
            </div>
          ) : filteredSlas.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
              <Clock className="w-12 h-12 opacity-20" />
              <span className="text-sm">Nenhum SLA configurado.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
                <tr className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                  <th className="px-6 py-4">Status / Prioridade</th>
                  <th className="px-6 py-4">Tempo (Horas)</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredSlas.map((sla) => (
                  <tr key={sla.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          sla.status.toLowerCase().includes('alta') || sla.status.toLowerCase().includes('crítica') ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                          sla.status.toLowerCase().includes('média') ? 'bg-yellow-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                          'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                        }`} />
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-semibold">{sla.nome}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{sla.status}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-300 font-mono text-sm">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {sla.deadline_hours}h
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-500 text-xs max-w-xs truncate" title={sla.descricao || ''}>
                        {sla.descricao || 'Sem descrição detalhada'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(sla)}
                          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sla.id)}
                          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Formulário */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white">
                  {editingSla ? 'Editar SLA' : 'Configurar Novo SLA'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nome do SLA</label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Suporte Padrão, Atendimento VIP..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Prioridade</label>
                <input
                  type="text"
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  placeholder="Ex: Alta, Crítica, Normal..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Prazo (Horas Úteis)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.deadline_hours}
                  onChange={(e) => setFormData({ ...formData, deadline_hours: e.target.value })}
                  placeholder="Ex: 24"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Descrição</label>
                <textarea
                  rows={3}
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Explique os critérios para este nível de serviço..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : editingSla ? 'Salvar Alterações' : 'Configurar SLA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
