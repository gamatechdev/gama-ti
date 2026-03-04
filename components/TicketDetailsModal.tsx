import React, { useEffect, useState } from 'react';
// Importação do cliente Supabase para buscar dados do usuário
import { supabase } from '../supabaseClient';
// Importação de tipos
import { Chamado } from '../types';
// Importação de ícones para a interface
import { X, Clock, User, Calendar, Tag, FileText, UserCheck } from 'lucide-react';
// Importação para formatação de data
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

// Definição das propriedades do componente
interface TicketDetailsModalProps {
    ticket: Chamado;
    onClose: () => void;
}

export const TicketDetailsModal: React.FC<TicketDetailsModalProps> = ({ ticket, onClose }) => {
    // Estado para armazenar a URL da imagem do solicitante
    const [solicitanteImg, setSolicitanteImg] = useState<string | null>(null);

    // Efeito para buscar a foto do solicitante quando o modal abrir
    useEffect(() => {
        const fetchSolicitanteData = async () => {
            // Se não houver solicitante, não faz nada
            if (!ticket.solicitante) return;

            try {
                // Busca o usuário na tabela 'users' pelo username
                // Nota: Idealmente buscaríamos por ID se disponível no objeto ticket
                const { data, error } = await supabase
                    .from('users')
                    .select('img_url')
                    .eq('username', ticket.solicitante)
                    .maybeSingle();

                // Se encontrou dados e não houve erro, define a imagem
                if (!error && data) {
                    setSolicitanteImg(data.img_url);
                }
            } catch (err) {
                // Silencia erros de busca de imagem para não quebrar o modal
                console.warn("Erro ao buscar imagem do solicitante:", err);
            }
        };

        fetchSolicitanteData();
    }, [ticket.solicitante]);

    // Função para retornar o estilo do badge de status
    const getStatusStyle = (status: string | null) => {
        // Define cores baseadas no status do chamado
        switch (status) {
            case 'Concluído':
                return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'Em andamento':
                return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
            default:
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
        }
    };

    return (
        // Overlay do modal com desfoque de fundo
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Container principal do modal */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Cabeçalho do Modal */}
                <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-lg">
                            <Tag className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-white font-bold text-lg tracking-wide">Detalhes do Chamado #{ticket.id}</h2>
                    </div>
                    {/* Botão de Fechar */}
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white hover:bg-slate-700 p-2 rounded-full transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Corpo do Modal */}
                <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">

                    {/* Seção do Solicitante e Data */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 bg-slate-800/30 p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-4">
                            {/* Avatar do Solicitante */}
                            {solicitanteImg ? (
                                <img
                                    src={solicitanteImg}
                                    alt={ticket.solicitante || 'Solicitante'}
                                    className="w-16 h-16 rounded-full border-2 border-indigo-500/30 object-cover shadow-lg"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-600 shadow-lg">
                                    <User className="w-8 h-8 text-slate-400" />
                                </div>
                            )}
                            {/* Informações do Solicitante */}
                            <div>
                                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-1">Solicitante</span>
                                <h3 className="text-white font-bold text-lg">{ticket.solicitante || 'Anônimo'}</h3>
                            </div>
                        </div>

                        <div className="flex flex-col md:items-end gap-3">
                            <div>
                                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-1">Solicitado em</span>
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Calendar className="w-4 h-4 text-indigo-400" />
                                    <span className="text-sm font-medium">
                                        {ticket.created_at ? format(new Date(ticket.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) : 'Data desconhecida'}
                                    </span>
                                </div>
                            </div>

                            {ticket.conclued_at && (
                                <div>
                                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-1">Resolvido em</span>
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <Calendar className="w-4 h-4 text-emerald-400" />
                                        <span className="text-sm font-medium">
                                            {format(new Date(ticket.conclued_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Título */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-extrabold text-white leading-tight">
                            {ticket.titulo || 'Sem título'}
                        </h1>
                    </div>

                    {/* Descrição */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 text-slate-400 mb-3">
                            <FileText className="w-4 h-4 text-indigo-400" />
                            <span className="text-sm font-semibold uppercase tracking-wider">Descrição do Problema</span>
                        </div>
                        <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {ticket.descricao || 'Nenhuma descrição detalhada fornecida.'}
                        </div>
                    </div>

                    {/* Rodapé Interno: Responsável (esquerda) e Status (direita) */}
                    <div className="pt-6 border-t border-slate-800 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-800 p-2 rounded-lg">
                                <UserCheck className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div>
                                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-1">Responsável</span>
                                <span className="text-slate-200 font-medium">
                                    {ticket.responsavel ? ticket.responsavel : <span className="text-slate-500 italic">Aguardando responsável</span>}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col items-center">
                            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-2">Status</span>
                            <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold border w-fit ${getStatusStyle(ticket.status)}`}>
                                {ticket.status || 'Novo'}
                            </span>
                        </div>
                    </div>
                </div>
                {/* Rodapé do Modal */}
                <div className="bg-slate-800/50 px-8 py-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all shadow-lg active:scale-95"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
