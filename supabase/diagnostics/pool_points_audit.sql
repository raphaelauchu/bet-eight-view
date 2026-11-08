-- ============================================================================================
-- AUDIT DU CLASSEMENT D'UN POOL -- lecture seule, aucun secret, aucune ecriture.
--
-- A coller dans le SQL Editor de Supabase. Remplacez '<POOL_ID>' par l'UUID du pool a
-- inspecter (visible dans l'URL de la page du pool, ou via la requete tout en bas de ce
-- fichier) PARTOUT ou il apparait (une fois par section, 5 occurrences).
--
-- Ce fichier ne contient QUE des SELECT. Aucune section n'insere, ne modifie ou ne supprime
-- quoi que ce soit. Vous pouvez executer tout le fichier d'un coup (Supabase affiche le
-- resultat de chaque section) ou une section a la fois.
-- ============================================================================================


-- =========================================================================================
-- SECTION 0 -- Trouver l'UUID du pool si vous ne l'avez pas sous la main.
-- =========================================================================================
select id as pool_id, name, season, status, scoring_start_at, created_at
from pools
order by created_at desc;


-- =========================================================================================
-- SECTION 1 -- DETAIL LIGNE PAR LIGNE : participant / joueur / match / statistiques / bareme
-- / points. Utilise pool_scored_events(), la MEME fonction interne que get_pool_standings et
-- get_member_breakdown (source unique de calcul) -- ce que vous voyez ici est exactement ce
-- qui alimente le Classement. "counted" = false signifie "au banc/IR, ne compte pas dans le
-- total" (pools fantasy uniquement ; toujours true pour un pool classique ou pour les
-- equipes NHL).
-- =========================================================================================
select
  pm.display_name,
  pm.team_name,
  ev.kind,
  ev.ref_id as player_id,
  ev.label as player_name,
  ev.pos_group,
  g.game_id,
  g.game_date,
  g.home_abbrev,
  g.away_abbrev,
  ev.stats,
  ev.points_by_category,
  ev.points,
  ev.counted
from pool_scored_events('<POOL_ID>'::uuid) ev
join pool_members pm on pm.id = ev.member_id
join nhl_games g on g.game_id = ev.game_id
order by pm.display_name, g.game_date, ev.ref_id;


-- =========================================================================================
-- SECTION 2 -- RECAPITULATIF PAR PARTICIPANT, pour comparaison visuelle directe avec la page
-- Classement. "total_points" doit correspondre EXACTEMENT a ce qui est affiche dans le
-- Classement pour chaque participant ; "matchs_comptes" doit correspondre au "PJ" affiche.
-- Si un ecart apparait ici vs l'ecran, le probleme est cote client (affichage), pas cote
-- calcul -- sinon la cause est dans les donnees (voir sections 3/4/5 plus bas).
-- =========================================================================================
select
  pm.display_name,
  pm.team_name,
  count(ev.game_id) filter (where ev.counted) as matchs_comptes,
  coalesce(sum(ev.points) filter (where ev.counted), 0) as total_points,
  coalesce(sum(ev.points) filter (where not ev.counted), 0) as points_au_banc_ignores,
  rank() over (order by coalesce(sum(ev.points) filter (where ev.counted), 0) desc) as rang
from pool_members pm
left join pool_scored_events('<POOL_ID>'::uuid) ev on ev.member_id = pm.id
where pm.pool_id = '<POOL_ID>'::uuid
group by pm.id, pm.display_name, pm.team_name
order by total_points desc;


-- =========================================================================================
-- SECTION 3 -- DETECTEUR DE DOUBLONS DE PROPRIETE (la cause la plus probable d'un total tres
-- negatif ou irrealiste). pool_roster_periods JOINT (pas EXISTS) les statistiques : si un
-- meme joueur/equipe a DEUX periodes "ouvertes" (to_at IS NULL) qui se chevauchent -- que ce
-- soit pour le MEME participant ou pour DEUX participants differents -- ses statistiques sont
-- comptees une fois par periode qui chevauche, donc en double (ou plus). Une ligne ici = une
-- anomalie de donnees a corriger manuellement (fermer/supprimer la periode en trop).
-- Normalement 0 ligne.
-- =========================================================================================
select
  a.kind, a.player_id, a.player_name,
  a.member_id as membre_1, pm1.display_name as participant_1, a.from_at as periode_1_debut, a.to_at as periode_1_fin,
  b.member_id as membre_2, pm2.display_name as participant_2, b.from_at as periode_2_debut, b.to_at as periode_2_fin
from pool_roster_periods a
join pool_roster_periods b
  on a.pool_id = b.pool_id and a.kind = b.kind and a.player_id = b.player_id and a.id < b.id
join pool_members pm1 on pm1.id = a.member_id
join pool_members pm2 on pm2.id = b.member_id
where a.pool_id = '<POOL_ID>'::uuid
  and a.from_at < coalesce(b.to_at, 'infinity'::timestamptz)
  and b.from_at < coalesce(a.to_at, 'infinity'::timestamptz);


-- =========================================================================================
-- SECTION 4 -- DETECTEUR DE CHEVAUCHEMENT D'ALIGNEMENT (pools fantasy uniquement). Moins
-- grave que la section 3 (n'affecte pas le TOTAL de points, seulement si un joueur apparait
-- comme "actif" au mauvais moment) mais signale un etat incoherent a nettoyer. Normalement
-- 0 ligne.
-- =========================================================================================
select
  a.member_id, pm.display_name as participant, a.kind, a.player_id,
  a.slot as poste_1, a.from_at as periode_1_debut, a.to_at as periode_1_fin,
  b.slot as poste_2, b.from_at as periode_2_debut, b.to_at as periode_2_fin
from pool_lineup_periods a
join pool_lineup_periods b
  on a.pool_id = b.pool_id and a.member_id = b.member_id and a.kind = b.kind and a.player_id = b.player_id and a.id < b.id
join pool_members pm on pm.id = a.member_id
where a.pool_id = '<POOL_ID>'::uuid
  and a.from_at < coalesce(b.to_at, 'infinity'::timestamptz)
  and b.from_at < coalesce(a.to_at, 'infinity'::timestamptz);


-- =========================================================================================
-- SECTION 5 -- MATCHS AUX POINTS ABERRANTS : liste les matchs dont la contribution en points
-- (positive ou negative) d'UN SEUL joueur/equipe depasse le seuil ci-dessous (ajustez
-- "v_seuil" selon votre bareme -- par defaut 15, nettement au-dessus d'un match normal dans
-- la plupart des baremes). Utile pour reperer un bareme applique au mauvais poste (ex. le
-- bareme gardien applique a un patineur) ou une statistique saisie avec une unite erronee.
-- =========================================================================================
select
  pm.display_name, ev.ref_id as player_id, ev.label as player_name, ev.pos_group,
  g.game_date, ev.stats, ev.points_by_category, ev.points
from pool_scored_events('<POOL_ID>'::uuid) ev
join pool_members pm on pm.id = ev.member_id
join nhl_games g on g.game_id = ev.game_id
where abs(ev.points) > 15 -- v_seuil : ajustez selon votre bareme
order by abs(ev.points) desc;
