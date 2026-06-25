-- Tabela principal do Groot
create table if not exists budgets (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  data        jsonb not null default '{}',
  updated_at  timestamptz default now() not null,
  constraint budgets_user_id_unique unique (user_id)
);

-- Row Level Security: cada usuário só acessa seu próprio orçamento
alter table budgets enable row level security;

create policy "Usuário acessa apenas seu próprio budget"
  on budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: atualiza updated_at automaticamente
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger budgets_updated_at
  before update on budgets
  for each row execute function update_updated_at();
