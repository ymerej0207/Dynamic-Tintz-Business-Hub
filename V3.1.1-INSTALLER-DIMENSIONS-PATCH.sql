-- Dynamic Tintz OS V3.1.1 Installer Dimensions Patch
-- Run once in Supabase SQL Editor.

-- Ensure jobs can link to cloud quotes, even if the earliest schema was installed.
alter table public.jobs
  add column if not exists quote_id uuid references public.quotes(id) on delete set null;

-- Replace quote read policy so an installer can read a quote only when a job
-- linked to that quote is assigned to the signed-in installer.
drop policy if exists p_quotes_select on public.quotes;
drop policy if exists quote_select on public.quotes;
drop policy if exists quotes_select on public.quotes;

create policy p_quotes_select on public.quotes
for select
using (
  public.is_owner()
  or created_by = auth.uid()
  or assigned_to = auth.uid()
  or exists (
    select 1
    from public.jobs j
    where j.quote_id = quotes.id
      and j.assigned_to = auth.uid()
  )
);

-- Refresh PostgREST's schema cache.
notify pgrst, 'reload schema';
