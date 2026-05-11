// Importa a função createClient do SDK do Supabase
import { createClient } from '@supabase/supabase-js';

// Obtém a URL do projeto Supabase das variáveis de ambiente do Vite
const SUPABASE_URL = import.meta.env.VITE_API_SUPABASE_URL;
// Obtém a chave anônima do projeto Supabase das variáveis de ambiente do Vite
const SUPABASE_ANON_KEY = import.meta.env.VITE_API_ANON_KEY;

// Cria uma única instância do cliente Supabase para ser exportada e usada em toda a aplicação
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);