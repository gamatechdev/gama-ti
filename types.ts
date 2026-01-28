export interface Chamado {
  id: number;
  titulo: string | null;
  descricao: string | null;
  solicitante: string | null;
  status: string | null;
  responsavel: string | null;
  responsavel_id?: string | null; // Reverted to string (UUID)
  created_at: string;
}

export interface UserSession {
  id: string; // Auth UUID
  name: string;
  avatar?: string;
  email?: string;
}

export interface ChatMessage {
  id: number;
  chamado_id: number;
  status: string | null;
  text_msg: string | null;
  sent_by: string | null; // UUID
  created_at: string;
}