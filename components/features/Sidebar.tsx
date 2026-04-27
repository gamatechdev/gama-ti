import React from 'react';
import {
  LayoutDashboard,
  Ticket,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCircle,
  Library
} from 'lucide-react';
import { UserSession } from '../../types';

interface SidebarProps {
  user: UserSession | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  user,
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse
}: SidebarProps) {

  // Itens de menu com permissões
  const menuItems = [
    { id: 'chamados', label: 'Chamados', icon: Ticket, roles: [1, 2, 3, 4, 5, 6, 7] },
    { id: 'categories', label: 'Categorias', icon: Library, roles: [6, 7] },
  ];

  // Filtra itens baseado na role do usuário
  const filteredItems = menuItems.filter(item => {
    if (!user?.role_id) return item.roles.includes(1); // Default role
    return item.roles.includes(Number(user.role_id));
  });

  return (
    <aside
      className={`bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ease-in-out relative z-30 ${isCollapsed ? 'w-20' : 'w-64'
        }`}
    >
      {/* Botão de Recolher/Expandir */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-20 bg-indigo-600 text-white rounded-full p-1 border-2 border-slate-900 hover:bg-indigo-500 transition-colors shadow-lg z-50 hidden md:block"
      >
        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Seção do Usuário (Topo) */}
      <div className={`p-6 mb-4 flex items-center gap-4 ${isCollapsed ? 'justify-center px-0' : ''}`}>
        <div className="relative shrink-0">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-10 h-10 rounded-xl object-cover border-2 border-indigo-500/30 shadow-inner"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center border-2 border-indigo-500/30">
              <UserCircle className="w-6 h-6 text-indigo-400" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-sm" />
        </div>

        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
            <span className="text-sm font-bold text-slate-100 truncate">{user?.name}</span>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">
                {Number(user?.role_id) >= 6 ? 'Administrador' : 'Colaborador'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 space-y-1.5">
        {!isCollapsed && <div className={`mb-4 px-3 ${isCollapsed ? 'text-center' : ''}`}>
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Menu Principal</span>
        </div>}

        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
            >
              <Icon className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />

              {!isCollapsed && (
                <span className="text-sm font-semibold whitespace-nowrap animate-in fade-in duration-300">
                  {item.label}
                </span>
              )}

              {/* Indicador de Item Ativo */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              )}

              {/* Tooltip para modo recolhido */}
              {isCollapsed && (
                <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl border border-slate-700 z-[100]">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Rodapé da Sidebar */}
      {!isCollapsed && (
        <div className="p-6">
          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Status do Sistema</p>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-slate-300">Servidores Online</span>
              </div>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-12 h-12 text-indigo-400" />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
