export interface Chamado {
  id: number;
  titulo: string | null;
  descricao: string | null;
  solicitante: string | null;
  status: string | null;
  responsavel: string | null;
  responsavel_id?: string | null; // Reverted to string (UUID)
  created_at: string;
  conclued_at?: string | null;
  sla_id?: number | null;
}

export interface UserSession {
  id: string; // Auth UUID
  db_id?: number;
  name: string;
  avatar?: string;
  email?: string;
  role_id?: string;
}

export interface ChatMessage {
  id: number;
  chamado_id: number;
  status: string | null;
  text_msg: string | null;
  sent_by: string | null; // UUID
  created_at: string;
}

export interface Category {
  id: number;
  nome: string;
  descricao: string | null;
  sla_id: number | null;
}