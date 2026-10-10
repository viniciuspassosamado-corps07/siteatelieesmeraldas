/* Só a chave pública (anon) fica no navegador. Quem pode ler tudo ou editar é decidido pelo RLS
   e pela tabela admins no banco, não por esta chave. */
export const SUPABASE_URL = 'https://vcunrbzfinnnyjviwlag.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdW5yYnpmaW5ubnlqdml3bGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NjAxOTYsImV4cCI6MjEwNzIzNjE5Nn0.t0NRuguarsR5nv6LjtndZj-0JnY0gB-w5ogyBXUsDDo';
export const BUCKET = 'produtos';
/* limites do site (mesmos valores de MAX_BANNER e MAX_CARROSSEL em produtos.js):
   o banner do topo tem 5 tomadas; o carrossel "Ofertas imperdíveis" mostra até 8 ofertas */
export const MAX_BANNER = 5;
export const MAX_CARROSSEL = 8;
