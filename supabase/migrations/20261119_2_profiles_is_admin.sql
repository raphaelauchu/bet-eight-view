-- Verification d'admin cote base de donnees (profiles.is_admin), remplace l'ancienne liste
-- ADMIN_EMAILS codee en dur cote client (src/App.js) -- celle-ci ne protegeait rien reellement
-- (visible dans le bundle JS, contournable en inspectant la page). Idempotente.
--
-- La table profiles existe deja hors de ce dossier de migrations (creee via le dashboard
-- Supabase, voir 20261118_profiles_add_province.sql) -- on ne touche qu'a la colonne is_admin
-- et a un trigger de protection, pas au reste de ses policies RLS existantes.

alter table profiles add column if not exists is_admin boolean not null default false;

-- Empeche un utilisateur authentifie de s'auto-accorder (ou de conserver apres un upsert) le
-- role admin, meme si la policy RLS "update own profile"/"insert own profile" existante permet
-- par ailleurs de modifier sa propre ligne (necessaire pour username/avatar/province, voir
-- ProfilePage dans src/App.js). auth.uid() est NULL quand la requete est executee par le role
-- postgres (migration, SQL editor du dashboard) -- c'est le SEUL chemin autorise a positionner
-- is_admin : jamais via l'API authentifiee du client, meme par le proprietaire de la ligne.
create or replace function prevent_self_admin_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if TG_OP = 'INSERT' then
      new.is_admin := false;
    elsif TG_OP = 'UPDATE' and new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_admin_write on profiles;
create trigger trg_prevent_self_admin_write
  before insert or update on profiles
  for each row
  execute function prevent_self_admin_write();

-- Migre les deux admins actuels (auparavant ADMIN_EMAILS cote client) vers le flag DB.
-- Executee par le role postgres (migration) : auth.uid() est NULL ici, le trigger ci-dessus ne
-- bloque donc pas cette mise a jour.
update profiles set is_admin = true
where id in (select id from auth.users where email in ('raphael.auch@outlook.com', 'mick31laf@gmail.com'));
