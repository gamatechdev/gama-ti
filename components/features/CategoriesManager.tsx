import React, { useState, useEffect } from 'react'; // Importa o React e os hooks useState e useEffect
import { toast } from 'sonner'; // Importa a biblioteca de notificações toast
import {
  Library, // Ícone de biblioteca para representar categorias
  Plus, // Ícone de adição para novos registros
  Search, // Ícone de busca para filtragem
  MoreVertical, // Ícone de menu de opções
  Pencil, // Ícone de lápis para edição
  Trash2, // Ícone de lixeira para exclusão
  Loader2, // Ícone de carregamento (spinner)
  X, // Ícone de fechar para modais
  CheckCircle2, // Ícone de sucesso
  AlertCircle // Ícone de alerta/erro
} from 'lucide-react'; // Importa ícones da biblioteca lucide-react
import { supabase } from '../../supabaseClient'; // Importa o cliente do Supabase para comunicação com o banco
import { Category } from '../../types'; // Importa a interface de tipo Category

export function CategoriesManager() { // Define e exporta o componente CategoriesManager
  const [categories, setCategories] = useState<Category[]>([]); // Estado para armazenar a lista de categorias
  const [slas, setSlas] = useState<any[]>([]); // Estado para armazenar a lista de SLAs disponíveis
  const [loading, setLoading] = useState(true); // Estado para controlar o carregamento inicial dos dados
  const [searchTerm, setSearchTerm] = useState(''); // Estado para o termo de busca na filtragem

  // Estados para gerenciar o Modal de Cadastro e Edição
  const [isModalOpen, setIsModalOpen] = useState(false); // Controla a visibilidade do modal
  const [editingCategory, setEditingCategory] = useState<Category | null>(null); // Armazena a categoria que está sendo editada
  const [formData, setFormData] = useState({ // Estado para os campos do formulário
    nome: '', // Nome da categoria
    descricao: '', // Descrição da categoria
    sla_id: '' // ID do SLA vinculado
  });
  const [isSaving, setIsSaving] = useState(false); // Estado para controlar o carregamento durante o salvamento

  useEffect(() => { // Hook executado ao montar o componente
    fetchData(); // Chama a função para buscar os dados iniciais
  }, []); // Dependência vazia garante execução única

  const fetchData = async () => { // Função assíncrona para buscar categorias e SLAs
    setLoading(true); // Ativa o estado de carregamento
    try {
      // Executa as buscas em paralelo para melhor performance
      const [catRes, slaRes] = await Promise.all([
        supabase.from('categoria_chamados').select('*').order('nome'), // Busca categorias ordenadas por nome
        supabase.from('sla').select('*') // Busca todos os SLAs
      ]);

      if (catRes.data) setCategories(catRes.data); // Atualiza o estado de categorias se houver dados
      if (slaRes.data) setSlas(slaRes.data); // Atualiza o estado de SLAs se houver dados
    } catch (error) {
      console.error('Erro ao buscar dados:', error); // Loga erros de busca no console
    } finally {
      setLoading(false); // Desativa o estado de carregamento
    }
  };

  const handleOpenModal = (category: Category | null = null) => { // Função para abrir o modal de criação/edição
    if (category) { // Se uma categoria for passada, entra no modo de edição
      setEditingCategory(category); // Define a categoria atual para edição
      setFormData({ // Preenche o formulário com os dados da categoria
        nome: category.nome,
        descricao: category.descricao || '',
        sla_id: String(category.sla_id || '')
      });
    } else { // Caso contrário, limpa o formulário para uma nova categoria
      setEditingCategory(null); // Reseta a categoria de edição
      setFormData({ nome: '', descricao: '', sla_id: '' }); // Limpa os campos do formulário
    }
    setIsModalOpen(true); // Abre o modal
  };

  const handleSave = async (e: React.FormEvent) => { // Função para salvar (criar ou atualizar) uma categoria
    e.preventDefault(); // Previne o comportamento padrão de recarregar a página no submit
    setIsSaving(true); // Ativa o estado de salvamento

    const payload = { // Prepara os dados para o envio ao Supabase
      nome: formData.nome,
      descricao: formData.descricao,
      sla_id: formData.sla_id ? Number(formData.sla_id) : null // Converte o ID para número ou null
    };

    try {
      // Verifica se existe uma categoria sendo editada
      if (editingCategory) {
        // Log para depuração: verifica se o ID e os dados estão corretos antes de enviar
        console.log("[DEBUG] Atualizando categoria:", { id: editingCategory.id, payload });

        // Atualiza o registro e usa .select() para confirmar o retorno dos dados
        const { data, error } = await supabase
          .from('categoria_chamados')
          .update(payload)
          .eq('id', editingCategory.id)
          .select();
        
        if (error) throw error; // Lança erro se houver falha no banco
        
        // Log de confirmação do que foi alterado
        console.log("[DEBUG] Categoria atualizada com sucesso:", data);
        
        // Exibe notificação de sucesso para a atualização
        toast.success('Categoria atualizada com sucesso!');
      } else {
        // Insere um novo registro no banco de dados
        await supabase
          .from('categoria_chamados')
          .insert([payload]);
        
        // Exibe notificação de sucesso para a criação
        toast.success('Categoria criada com sucesso!');
      }
      setIsModalOpen(false); // Fecha o modal após o sucesso
      fetchData(); // Recarrega a lista de categorias
    } catch (error) {
      console.error('Erro ao salvar:', error); // Loga o erro no console
      // Exibe notificação de erro para o usuário
      toast.error('Ocorreu um erro ao salvar a categoria.');
    } finally {
      setIsSaving(false); // Desativa o estado de salvamento
    }
  };

  const handleDelete = async (id: number) => { // Função para excluir uma categoria
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return; // Solicita confirmação do usuário

    try {
      // Tenta excluir a categoria do banco de dados pelo ID
      await supabase.from('categoria_chamados').delete().eq('id', id);
      // Exibe notificação de sucesso na exclusão
      toast.success('Categoria excluída com sucesso!');
      fetchData(); // Recarrega a lista de categorias
    } catch (error) {
      // Caso ocorra erro (geralmente por restrição de chave estrangeira)
      toast.error('Erro ao excluir: A categoria pode estar sendo usada em chamados.');
    }
  };

  const filteredCategories = categories.filter(c => // Filtra as categorias localmente com base no termo de busca
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) // Compara o nome em minúsculo
  );

  return (
    <div className="flex-1 flex flex-col p-8 bg-slate-950 overflow-hidden"> {/* Container principal da página */}
      {/* Seção de cabeçalho da página */}
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 mb-1">
            <Library className="w-5 h-5" /> {/* Ícone decorativo */}
            <span className="text-xs font-bold uppercase tracking-widest">Configurações</span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Categorias de Chamados</h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie os tipos de chamados e seus SLAs vinculados.</p>
        </div>

        {/* Botão para abrir o modal de nova categoria */}
        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Nova Categoria
        </button>
      </div>

      {/* Seção da barra de ferramentas (busca) */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-t-2xl flex items-center justify-between shrink-0">
        <div className="relative w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {filteredCategories.length} categorias encontradas {/* Contador de resultados */}
        </div>
      </div>

      {/* Seção da tabela de listagem */}
      <div className="flex-1 bg-slate-900 border-x border-b border-slate-800 rounded-b-2xl overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 custom-scrollbar">
          {loading ? ( // Renderiza estado de carregamento
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-sm font-medium">Carregando categorias...</span>
            </div>
          ) : filteredCategories.length === 0 ? ( // Renderiza estado vazio
            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
              <Library className="w-12 h-12 opacity-20" />
              <span className="text-sm">Nenhuma categoria encontrada.</span>
            </div>
          ) : ( // Renderiza a tabela de dados
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
                {filteredCategories.map((cat) => ( // Mapeia as categorias filtradas para linhas da tabela
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
                      {cat.sla_id ? ( // Exibe o status do SLA com cor condicional
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          slas.find(s => s.id === cat.sla_id)?.status === 'Alta' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
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
                        {/* Botão de edição */}
                        <button
                          onClick={() => handleOpenModal(cat)}
                          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* Botão de exclusão */}
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

      {/* Modal para formulário de categoria */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Overlay de fundo com desfoque */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            {/* Cabeçalho do modal */}
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

            {/* Corpo do formulário */}
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Campo: Nome */}
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

              {/* Campo: Descrição */}
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

              {/* Campo: SLA Padrão */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">SLA Padrão</label>
                <select
                  value={formData.sla_id}
                  onChange={(e) => setFormData({ ...formData, sla_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Selecione um SLA</option>
                  {slas.map(sla => ( // Mapeia os SLAs para opções do select
                    <option key={sla.id} value={sla.id}>{sla.status} - {sla.nome}</option>
                  ))}
                </select>
              </div>

              {/* Ações do formulário */}
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
                  {/* Exibe spinner se estiver salvando, caso contrário exibe o texto da ação */}
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
