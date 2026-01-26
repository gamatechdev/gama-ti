export interface Chamado {
  id: number;
  titulo: string | null;
  descricao: string | null;
  solicitante: string | null;
  status: string | null;
  responsavel: string | null;
  created_at: string;
}

export interface UserSession {
  name: string;
  avatar?: string;
}