import React, { useState, useEffect } from 'react';
import {
  Library,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Category } from '../../types';

export function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [slas, setSlas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para Modal de Cadastro/Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    sla_id: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, slaRes] = await Promise.all([
        supabase.from('categoria_chamados').select('*').order('nome'),
        supabase.from('sla').select('*')
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (slaRes.data) setSlas(slaRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category: Category | null = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        nome: category.nome,
        descricao: category.descricao || '',
        sla_id: String(category.sla_id || '')
      });
    } else {
      setEditingCategory(null);
      setFormData({ nome: '', descricao: '', sla_id: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      nome: formData.nome,
      descricao: formData.descricao,
      sla_id: formData.sla_id ? Number(formData.sla_id) : null
    };

    try {
      if (editingCategory) {
        await supabase
          .from('categoria_chamados')
          .update(payload)
          .eq('id', editingCategory.id);
      } else {
        await supabase
          .from('categoria_chamados')
          .insert([payload]);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;

    try {
      await supabase.from('categoria_chamados').delete().eq('id', id);
      fetchData();
    } catch (error) {
      alert('Erro ao excluir: A categoria pode estar sendo usada em chamados.');
    }
  };

  const filteredCategories = categories.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col p-8 bg-slate-950 overflow-hidden">
      {/* Header da Página */}
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 mb-1">
            <Library className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Configurações</span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Categorias de Chamados</h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie os tipos de chamados e seus SLAs vinculados.</p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Nova Categoria
        </button>
      </div>

      {/* Barra de Ferramentas */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-t-2xl flex items-center justify-between shrink-0">
        <div className="relative w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {filteredCategories.length} categorias encontradas
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 bg-slate-900 border-x border-b border-slate-800 rounded-b-2xl overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-sm font-medium">Carregando categorias...</span>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
              <Library className="w-12 h-12 opacity-20" />
              <span className="text-sm">Nenhuma categoria encontrada.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
                <tr className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">SLA Padrão</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">#{cat.id}</td>
                    <td className="px-6 py-4">
                      <span className="text-slate-200 font-semibold">{cat.nome}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-500 text-xs max-w-xs truncate" title={cat.descricao || ''}>
                        {cat.descricao || 'Sem descrição'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {cat.sla_id ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${slas.find(s => s.id === cat.sla_id)?.status === 'Alta' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          slas.find(s => s.id === cat.sla_id)?.status === 'Média' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                          {slas.find(s => s.id === cat.sla_id)?.status}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[10px]">Não definido</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(cat)}
                          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id)}
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

      {/* Modal de Formulário */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                  <Library className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white">
                  {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nome da Categoria</label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Problemas com Impressora"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Descrição</label>
                <textarea
                  rows={3}
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva o tipo de problema que esta categoria atende..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">SLA Padrão</label>
                <select
                  value={formData.sla_id}
                  onChange={(e) => setFormData({ ...formData, sla_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Selecione um SLA</option>
                  {slas.map(sla => (
                    <option key={sla.id} value={sla.id}>{sla.status} - {sla.nome}</option>
                  ))}
                </select>
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
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
