"""
compute_donut_scores.py
------------------------
Calcule le score de "matchup" (donut, 0-100%) affiche a cote du prochain adversaire
d'un joueur dans FicheJoueur/FicheMatchup (src/Analyses.js).

Pour chaque joueur patineur actif ayant un prochain match connu :
  1. Calcule 4 valeurs predites (tirs, buts, passes, points) via le modele de regression
     lineaire calibre en Excel (coefficients dans public/data/donut_coefficients.json),
     a partir des variables du joueur (public/data/moneypuck_player_stats.json) et des
     variables defensives de son PROCHAIN adversaire (public/data/moneypuck_team_stats.json).
  2. Construit, pour chaque outcome, la distribution de toutes les valeurs predites de tous
     les joueurs actifs pour LEUR PROPRE prochain match (population de reference).
  3. Calcule le percentile de chaque joueur dans cette population, pour chacun des 4 outcomes.
  4. La moyenne des 4 percentiles est le score affiche sur le donut.

Limitation connue (v1) : la population de reference est batie a partir des prochains matchs
du jour/de la semaine courante uniquement (pas d'un historique complet de saison). Un soir avec
peu de matchs aura donc une population plus petite/bruitee qu'un soir avec beaucoup de matchs.

Gere explicitement le cas hors-saison (games_played=0, aucun prochain match trouve) sans
planter : les joueurs concernes sont simplement absents de "scores".

Output : public/data/donut_scores.json
  {
    "lastUpdated": "...",
    "scores": {
      "<playerId>": {
        "opponent": "VAN",
        "gameDate": "2026-04-16",
        "tirs": 93.7,
        "buts": 95.3,
        "passes": 84.6,
        "points": 91.4,
        "moyenne": 91.3
      },
      ...
    }
  }

Usage :
  python compute_donut_scores.py
"""

import bisect
import json
import os
import time
from datetime import datetime

import requests

PLAYER_STATS_PATH = "public/data/moneypuck_player_stats.json"
TEAM_STATS_PATH = "public/data/moneypuck_team_stats.json"
COEFFICIENTS_PATH = "public/data/donut_coefficients.json"
OUTPUT_PATH = "public/data/donut_scores.json"

SCHEDULE_URL = "https://api-web.nhle.com/v1/club-schedule-season/{team}/{season}"
REQUEST_DELAY = 0.2

TEAM_ABBREVS = [
    "ANA", "BOS", "BUF", "CGY", "CAR", "CHI", "COL", "CBJ", "DAL", "DET",
    "EDM", "FLA", "LAK", "MIN", "MTL", "NSH", "NJD", "NYI", "NYR", "OTT",
    "PHI", "PIT", "SJS", "SEA", "STL", "TBL", "TOR", "UTA", "VAN", "VGK",
    "WSH", "WPG",
]

OUTCOME_KEYS = {
    "tirs": "actShots",
    "buts": "actGoals",
    "passes": "actAssists",
    "points": "actPoints",
}

PLAYER_VAR_ORDER = ["preIxG_per60", "preAssists_per60", "preShots_per60", "prePP_TOI_avg_sec"]
OPP_VAR_ORDER = [
    "opp_preGA_per60",
    "opp_preShotsAgainst_per60",
    "opp_preHighDShotsAgainst_per60",
    "opp_prePK_pct",
]


def charger_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def fetch_schedule(team, season_id):
    try:
        url = SCHEDULE_URL.format(team=team, season=season_id)
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"Erreur schedule {team}/{season_id}: {e}")
        return None


def trouver_prochain_match(team, season_id):
    data = fetch_schedule(team, season_id)
    if not data:
        return None
    for g in data.get("games", []):
        if g.get("gameState") not in ("OFF", "FINAL"):
            return g
    return None


def get_prochain_adversaire(team, season_id):
    """Meme logique que trouverProchainMatchEquipe/chargerProchainAdversaire (src/Analyses.js) :
    premier match non termine de la saison courante, sinon premier match de la saison suivante
    (hors-saison)."""
    game = trouver_prochain_match(team, season_id)
    if game is None:
        annee_debut = int(season_id[:4])
        season_suivante = f"{annee_debut + 1}{annee_debut + 2}"
        game = trouver_prochain_match(team, season_suivante)
    if game is None:
        return None
    home_abbrev = game.get("homeTeam", {}).get("abbrev")
    away_abbrev = game.get("awayTeam", {}).get("abbrev")
    domicile = home_abbrev == team
    opponent = away_abbrev if domicile else home_abbrev
    if not opponent:
        return None
    return {
        "opponent": opponent,
        "gameDate": game.get("gameDate"),
        "gameId": game.get("id"),
        "domicile": domicile,
    }


def construire_map_prochains_matchs(season_id):
    prochains = {}
    for i, team in enumerate(TEAM_ABBREVS):
        prochains[team] = get_prochain_adversaire(team, season_id)
        statut = prochains[team]["opponent"] if prochains[team] else "aucun match trouve"
        print(f"[{i + 1}/{len(TEAM_ABBREVS)}] {team}: prochain adversaire -> {statut}")
        time.sleep(REQUEST_DELAY)
    return prochains


def variables_defensives_adversaire(team_stats):
    """opp_preGA_per60, opp_preShotsAgainst_per60, opp_preHighDShotsAgainst_per60, opp_prePK_pct
    a partir des stats d'equipe MoneyPuck (situation 'all' + '4on5'). None si l'equipe n'a pas
    encore joue (hors-saison)."""
    all_s = team_stats.get("all")
    sit_4on5 = team_stats.get("4on5")
    if not all_s or not sit_4on5:
        return None

    games_played = all_s.get("games_played")
    ice_time = all_s.get("iceTime")
    if not games_played or not ice_time:
        return None

    penalites_subies = all_s.get("penaltiesAgainst")
    buts_infériorite = sit_4on5.get("goalsAgainst")
    if not penalites_subies:
        return None

    return {
        "opp_preGA_per60": all_s.get("goalsAgainst", 0) / ice_time * 3600,
        "opp_preShotsAgainst_per60": all_s.get("shotsOnGoalAgainst", 0) / ice_time * 3600,
        "opp_preHighDShotsAgainst_per60": all_s.get("highDangerShotsAgainst", 0) / ice_time * 3600,
        "opp_prePK_pct": 1 - (buts_infériorite / penalites_subies),
    }


def variables_joueur(player_all):
    if any(player_all.get(k) is None for k in PLAYER_VAR_ORDER):
        return None
    return {k: player_all[k] for k in PLAYER_VAR_ORDER}


def predire(coefs, player_vars, opp_vars):
    c0, c1, c2, c3, c4, c5, c6, c7, c8 = coefs
    return (
        c0
        + c1 * player_vars["preIxG_per60"]
        + c2 * player_vars["preAssists_per60"]
        + c3 * player_vars["preShots_per60"]
        + c4 * player_vars["prePP_TOI_avg_sec"]
        + c5 * opp_vars["opp_preGA_per60"]
        + c6 * opp_vars["opp_preShotsAgainst_per60"]
        + c7 * opp_vars["opp_preHighDShotsAgainst_per60"]
        + c8 * opp_vars["opp_prePK_pct"]
    )


def calculer_predictions(players, prochains_matchs, team_stats, coefficients):
    """Une passe : pour chaque joueur actif avec un prochain match et des donnees adverses
    disponibles, calcule ses 4 valeurs predites. Retourne un dict playerId -> infos."""
    defense_cache = {}
    predictions = {}

    for pid, situations in players.items():
        all_stats = situations.get("all")
        if not all_stats or all_stats.get("position") == "G":
            continue

        team = all_stats.get("team")
        prochain = prochains_matchs.get(team)
        if not prochain:
            continue

        opponent = prochain["opponent"]
        if opponent not in defense_cache:
            opp_team_stats = team_stats.get(opponent)
            defense_cache[opponent] = (
                variables_defensives_adversaire(opp_team_stats) if opp_team_stats else None
            )
        opp_vars = defense_cache[opponent]
        if not opp_vars:
            continue

        player_vars = variables_joueur(all_stats)
        if not player_vars:
            continue

        valeurs = {
            outcome: predire(coefficients[coef_key], player_vars, opp_vars)
            for outcome, coef_key in OUTCOME_KEYS.items()
        }
        predictions[pid] = {
            "opponent": opponent,
            "gameDate": prochain["gameDate"],
            "valeurs": valeurs,
        }

    return predictions


def calculer_percentiles(predictions):
    populations = {
        outcome: sorted(p["valeurs"][outcome] for p in predictions.values())
        for outcome in OUTCOME_KEYS
    }

    scores = {}
    for pid, info in predictions.items():
        percentiles = {}
        for outcome, population in populations.items():
            valeur = info["valeurs"][outcome]
            rang = bisect.bisect_right(population, valeur)
            percentiles[outcome] = rang / len(population) * 100

        scores[pid] = {
            "opponent": info["opponent"],
            "gameDate": info["gameDate"],
            **{outcome: round(pct, 1) for outcome, pct in percentiles.items()},
            "moyenne": round(sum(percentiles.values()) / len(percentiles), 1),
        }

    return scores


def sauvegarder_json(scores):
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    data = {
        "lastUpdated": datetime.now().isoformat(),
        "scores": scores,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Sauvegarde: {OUTPUT_PATH} ({len(scores)} joueurs)")


def main():
    player_data = charger_json(PLAYER_STATS_PATH)
    team_data = charger_json(TEAM_STATS_PATH)
    coeff_data = charger_json(COEFFICIENTS_PATH)

    season = player_data["season"]
    season_id = f"{season}{season + 1}"

    prochains_matchs = construire_map_prochains_matchs(season_id)
    predictions = calculer_predictions(
        player_data["players"], prochains_matchs, team_data["teams"], coeff_data["coefficients"]
    )

    if not predictions:
        print("Aucune prediction calculee (hors-saison ou donnees indisponibles).")
        sauvegarder_json({})
        return

    scores = calculer_percentiles(predictions)
    sauvegarder_json(scores)


if __name__ == "__main__":
    main()
