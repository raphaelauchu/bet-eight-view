-- Complements au moteur de draft (20261102_pool_draft_engine.sql) :
-- 1) pause_draft / resume_draft remplaces pour que le minuteur reprenne exactement ou il
--    s'etait arrete (plutot que de redonner un plein secondsPerPick a la reprise).
-- 2) delete_pool : le commissaire supprime son pool (peu importe le status).
-- 3) leave_pool : un membre non-commissaire quitte un pool tant qu'il est en 'setup'.

-- ===================== Pause / reprise avec temps restant =====================

create or replace function public.pause_draft(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_remaining_ms bigint;
begin
  if not is_pool_commissioner(p_pool_id) then raise exception 'not_commissioner'; end if;

  select * into v_pool from pools where id = p_pool_id and status = 'draft';
  if v_pool.id is null then raise exception 'draft_not_active'; end if;

  if coalesce((v_pool.draft_state->>'paused')::boolean, false) then
    return; -- deja en pause : idempotent, ne touche pas au temps deja memorise.
  end if;

  if v_pool.draft_state->>'pick_deadline' is not null then
    v_remaining_ms := greatest(0, floor(extract(epoch from ((v_pool.draft_state->>'pick_deadline')::timestamptz - now())) * 1000)::bigint);
  else
    v_remaining_ms := 0;
  end if;

  update pools set draft_state = draft_state || jsonb_build_object('paused', true, 'paused_remaining_ms', v_remaining_ms)
  where id = p_pool_id;
end;
$$;

-- A la reprise, pick_deadline = now() + le temps qui restait au moment de la pause (pas un
-- plein secondsPerPick). paused_remaining_ms est ensuite efface de draft_state.
create or replace function public.resume_draft(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_remaining_ms bigint;
begin
  if not is_pool_commissioner(p_pool_id) then raise exception 'not_commissioner'; end if;

  select * into v_pool from pools where id = p_pool_id and status = 'draft';
  if v_pool.id is null then raise exception 'draft_not_active'; end if;

  v_remaining_ms := coalesce((v_pool.draft_state->>'paused_remaining_ms')::bigint, 0);

  update pools set draft_state = (
    draft_state || jsonb_build_object(
      'paused', false,
      'pick_deadline', to_jsonb(now() + (v_remaining_ms::text || ' milliseconds')::interval)
    )
  ) - 'paused_remaining_ms'
  where id = p_pool_id;
end;
$$;

revoke execute on function public.pause_draft(uuid) from public;
revoke execute on function public.resume_draft(uuid) from public;
grant execute on function public.pause_draft(uuid) to authenticated;
grant execute on function public.resume_draft(uuid) to authenticated;

-- ===================== Supprimer un pool (commissaire, n'importe quel status) =====================
-- pool_picks et pool_members ont deja ON DELETE CASCADE vers pools, mais on les supprime
-- explicitement dans le bon ordre par prudence (le comportement ne doit pas dependre
-- silencieusement d'une contrainte qui pourrait changer plus tard).

create or replace function public.delete_pool(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_pool_commissioner(p_pool_id) then raise exception 'not_commissioner'; end if;

  delete from pool_picks where pool_id = p_pool_id;
  delete from pool_members where pool_id = p_pool_id;
  delete from pools where id = p_pool_id;
end;
$$;

revoke execute on function public.delete_pool(uuid) from public;
grant execute on function public.delete_pool(uuid) to authenticated;

-- ===================== Quitter un pool (membre non-commissaire, status='setup' seulement) =====================

create or replace function public.leave_pool(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
begin
  select * into v_pool from pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'pool_not_found'; end if;
  if v_pool.status <> 'setup' then raise exception 'pool_not_setup'; end if;
  if v_pool.owner_id = auth.uid() then raise exception 'commissioner_cannot_leave'; end if;

  delete from pool_members where pool_id = p_pool_id and user_id = auth.uid();
  if not found then raise exception 'not_a_member'; end if;
end;
$$;

revoke execute on function public.leave_pool(uuid) from public;
grant execute on function public.leave_pool(uuid) to authenticated;
