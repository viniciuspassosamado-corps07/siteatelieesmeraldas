-- Exportada do histórico de migrations do banco (supabase_migrations.schema_migrations), sem alterações.
-- Aplicada em 2026-10-10.

-- Quem pode editar a loja (o dono). Vazio até cadastrar o usuário do Supabase Auth.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "admin ve a propria linha"
  on public.admins for select to authenticated
  using (user_id = (select auth.uid()));

-- Produtos (pedras e joias). A oferta é um conjunto de campos do próprio produto.
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 120),
  categoria text not null check (categoria in ('pedra', 'joia')),
  titulo text,
  descricao text,
  detalhes text,
  cor text check (cor in ('esmeralda', 'safira', 'rubi', 'ametista', 'topazio', 'diamante')),
  preco numeric(12, 2) check (preco is null or preco >= 0),
  fotos text[] not null default '{}',
  estoque integer not null default 1 check (estoque >= 0),
  ativo boolean not null default true,
  oferta boolean not null default false,
  preco_original numeric(12, 2) check (preco_original is null or preco_original >= 0),
  oferta_ate timestamptz,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint oferta_valida check (
    not oferta or (preco is not null and preco_original is not null and preco_original > preco)
  )
);

create index produtos_categoria_ordem_idx on public.produtos (categoria, ordem) where ativo;
create index produtos_oferta_idx on public.produtos (ordem) where ativo and oferta;

create function public.produtos_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;
create trigger produtos_atualizado_em
  before update on public.produtos
  for each row execute function public.produtos_atualizado_em();

alter table public.produtos enable row level security;

-- Público só lê produtos ativos; só o dono cria, edita e remove.
create policy "publico le produtos ativos"
  on public.produtos for select to anon, authenticated
  using (ativo);

create policy "admin le todos os produtos"
  on public.produtos for select to authenticated
  using (public.is_admin());

create policy "admin cria produtos"
  on public.produtos for insert to authenticated
  with check (public.is_admin());

create policy "admin edita produtos"
  on public.produtos for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin remove produtos"
  on public.produtos for delete to authenticated
  using (public.is_admin());

-- Fotos: bucket público para leitura, escrita só do dono.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "admin envia fotos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and public.is_admin());

create policy "admin troca fotos"
  on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and public.is_admin())
  with check (bucket_id = 'produtos' and public.is_admin());

create policy "admin remove fotos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and public.is_admin());
