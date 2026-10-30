-- Rend pool_members.team_name optionnel et ajoute display_name : un snapshot du nom du
-- participant (display name du profil, sinon la partie avant le @ du courriel), capture
-- UNE SEULE FOIS cote client au moment ou l'utilisateur cree/rejoint un pool, a partir de
-- SON PROPRE profil (qu'il a toujours le droit de lire). On evite ainsi d'avoir a lire le
-- profil d'autrui pour l'affichage, dont les policies RLS sont inconnues / hors migrations.
--
-- Par defaut (rules.display = 'player'), c'est ce display_name qui est affiche dans le
-- lobby et la liste des pools plutot que le nom d'equipe, desormais optionnel.

alter table pool_members alter column team_name drop not null;
alter table pool_members add column if not exists display_name text;

-- join_pool_by_code change de signature (ajout de p_display_name) : on supprime
-- explicitement l'ancienne version a 2 arguments pour ne pas laisser un overload perime
-- qui contournerait la capture du display_name.
drop function if exists public.join_pool_by_code(text, text);

create or replace function public.join_pool_by_code(p_invite_code text, p_team_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool pools%rowtype;
  v_member_count int;
  v_team_name text;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_team_name := nullif(trim(coalesce(p_team_name, '')), '');
  v_display_name := nullif(trim(coalesce(p_display_name, '')), '');

  select * into v_pool from pools where invite_code = upper(trim(coalesce(p_invite_code, '')));
  if v_pool.id is null then
    raise exception 'invalid_code';
  end if;

  if v_pool.status = 'finished' then
    raise exception 'pool_closed';
  end if;

  if exists (select 1 from pool_members where pool_id = v_pool.id and user_id = auth.uid()) then
    raise exception 'already_member';
  end if;

  select count(*) into v_member_count from pool_members where pool_id = v_pool.id;
  if v_member_count >= v_pool.max_members then
    raise exception 'pool_full';
  end if;

  insert into pool_members (pool_id, user_id, team_name, display_name, role)
  values (v_pool.id, auth.uid(), v_team_name, v_display_name, 'member');

  return v_pool.id;
end;
$$;

revoke execute on function public.join_pool_by_code(text, text, text) from public;
grant execute on function public.join_pool_by_code(text, text, text) to authenticated;
