/* Só a chave pública (anon) fica no navegador. Quem pode ler tudo ou editar é decidido pelo RLS
   e pela tabela admins no banco, não por esta chave. */
export const SUPABASE_URL = 'https://vcunrbzfinnnyjviwlag.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdW5yYnpmaW5ubnlqdml3bGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NjAxOTYsImV4cCI6MjEwNzIzNjE5Nn0.t0NRuguarsR5nv6LjtndZj-0JnY0gB-w5ogyBXUsDDo';
export const BUCKET = 'produtos';
/* o banner do topo do site tem 5 tomadas (mesmo limite de MAX_OFERTAS em produtos.js) */
export const MAX_OFERTAS_BANNER = 5;
