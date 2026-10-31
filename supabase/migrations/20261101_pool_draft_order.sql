-- Ordre de repechage (rules.draft.orderMode = 'random' | 'manual').
-- Aucune policy UPDATE directe n'est ajoutee sur pool_members : le commissaire ne peut
-- fixer draft_position que via ces deux RPC, restreintes a lui-meme et uniquement tant
-- que le pool est en 'setup'. La lecture (y compris pour les non-commissaires) passe deja
-- par la policy "pool_members_select_same_pool" existante (RLS lecture inchangee).

-- Fixe l'ordre de repechage dans l'ordre exact du tableau p_member_ids fourni
-- (reordonnancement manuel par glisser-deposer / boutons monter-descendre cote client).
create or replace function public.set_draft_order(p_pool_id uuid, p_member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_given int;
  v_pos int := 1;
  v_id uuid;
begin
  if not is_pool_commissioner(p_pool_id) then
    raise exception 'not_commissioner';
  end if;

  if not exists (select 1 from pools where id = p_pool_id and status = 'setup') then
    raise exception 'pool_not_setup';
  end if;

  select count(*) into v_total from pool_members where pool_id = p_pool_id;
  select count(*) into v_given from (select distinct x from unnest(p_member_ids) x) d;

  if p_member_ids is null or array_length(p_member_ids, 1) is distinct from v_total or v_given is distinct from v_total then
    raise exception 'invalid_member_list';
  end if;

  if exists (
    select 1 from unnest(p_member_ids) x
    where not exists (select 1 from pool_members where id = x and pool_id = p_pool_id)
  ) then
    raise exception 'invalid_member_list';
  end if;

  foreach v_id in array p_member_ids loop
    update pool_members set draft_position = v_pos where id = v_id and pool_id = p_pool_id;
    v_pos := v_pos + 1;
  end loop;
end;
$$;

revoke execute on function public.set_draft_order(uuid, uuid[]) from public;
grant execute on function public.set_draft_order(uuid, uuid[]) to authenticated;

-- Tire l'ordre de repechage au hasard (bouton "Tirer l'ordre maintenant", mode aleatoire).
create or replace function public.shuffle_draft_order(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pos int := 1;
begin
  if not is_pool_commissioner(p_pool_id) then
    raise exception 'not_commissioner';
  end if;

  if not exists (select 1 from pools where id = p_pool_id and status = 'setup') then
    raise exception 'pool_not_setup';
  end if;

  for v_id in select id from pool_members where pool_id = p_pool_id order by random() loop
    update pool_members set draft_position = v_pos where id = v_id;
    v_pos := v_pos + 1;
  end loop;
end;
$$;

revoke execute on function public.shuffle_draft_order(uuid) from public;
grant execute on function public.shuffle_draft_order(uuid) to authenticated;
