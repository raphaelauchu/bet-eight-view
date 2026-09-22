"""
fetch_team_pk_data.py
----------------------
Recupere les stats de power play / penalty kill par equipe et par match via
l'API NHL (api-web.nhle.com).

Sources des gameId (dans l'ordre de priorite) :
  1. donut_processed.xlsx, onglet "equipes", colonne gameId (dedupliques)
  2. Si le fichier est absent : API schedule NHL (club-schedule-season), les 60
     premiers matchs de saison reguliere de chaque equipe, saison 20252026.

Pour chaque gameId, appelle :
  https://api-web.nhle.com/v1/gamecenter/{gameId}/right-rail
et lit l'entree teamGameStats dont category == "powerPlay" (format "buts/occasions",
ex: "1/3").

Output : team_pk_data.csv (a la racine du repo), colonnes :
  gameId, team, ppGoalsFor, timesOnPP, ppGoalsAgainst

Usage :
  python scripts/fetch_team_pk_data.py
"""

import csv
import os
import time

import pandas as pd
import requests

XLSX_PATH = "donut_processed.xlsx"
XLSX_SHEET = "equipes"
SEASON = "20252026"
GAMES_PER_TEAM = 60
REQUEST_DELAY = 0.3
OUTPUT_CSV = "team_pk_data.csv"

SCHEDULE_URL = "https://api-web.nhle.com/v1/club-schedule-season/{team}/{season}"
RIGHT_RAIL_URL = "https://api-web.nhle.com/v1/gamecenter/{gameId}/right-rail"
BOXSCORE_URL = "https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore"

TEAM_ABBREVS = [
    "ANA", "BOS", "BUF", "CGY", "CAR", "CHI", "COL", "CBJ", "DAL", "DET",
    "EDM", "FLA", "LAK", "MIN", "MTL", "NSH", "NJD", "NYI", "NYR", "OTT",
    "PHI", "PIT", "SJS", "SEA", "STL", "TBL", "TOR", "UTA", "VAN", "VGK",
    "WSH", "WPG",
]


def get_game_ids_from_xlsx():
    """Lit les gameId depuis donut_processed.xlsx (onglet 'equipes'), dedupliques.
    Les abbreviations d'equipes ne sont pas connues a partir de cette source,
    elles seront recuperees via l'API boxscore pour chaque match.
    """
    df = pd.read_excel(XLSX_PATH, sheet_name=XLSX_SHEET)
    col = next((c for c in df.columns if str(c).strip().lower() == "gameid"), None)
    if col is None:
        raise ValueError(
            f"Colonne gameId introuvable dans l'onglet '{XLSX_SHEET}'. "
            f"Colonnes disponibles: {list(df.columns)}"
        )
    game_ids = df[col].dropna().astype(int).unique().tolist()
    print(f"{len(game_ids)} gameId uniques lus depuis {XLSX_PATH} (onglet {XLSX_SHEET})")
    return {gid: None for gid in game_ids}


def get_game_ids_from_schedule():
    """Recupere les gameId via l'API schedule NHL : les 60 premiers matchs de
    saison reguliere de chaque equipe, saison 20252026. Retourne un dict
    gameId -> (awayAbbrev, homeAbbrev) deduplique.
    """
    print(f"{XLSX_PATH} introuvable, utilisation de l'API schedule NHL (saison {SEASON})...")
    game_map = {}
    for i, team in enumerate(TEAM_ABBREVS):
        url = SCHEDULE_URL.format(team=team, season=SEASON)
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        games = [
            g for g in data.get("games", [])
            if g.get("gameType") == 2 and g.get("gameState") in ("FINAL", "OFF")
        ][:GAMES_PER_TEAM]
        for g in games:
            gid = g["id"]
            if gid not in game_map:
                game_map[gid] = (g["awayTeam"]["abbrev"], g["homeTeam"]["abbrev"])
        print(f"[{i + 1}/{len(TEAM_ABBREVS)}] {team}: {len(games)} matchs (total gameId uniques: {len(game_map)})")
        time.sleep(REQUEST_DELAY)
    print(f"{len(game_map)} gameId uniques recuperes via schedule")
    return game_map


def get_team_abbrevs(game_id):
    url = BOXSCORE_URL.format(gameId=game_id)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data["awayTeam"]["abbrev"], data["homeTeam"]["abbrev"]


def parse_pp_value(value):
    """Parse un score au format 'buts/occasions', ex: '1/3' -> (1, 3)."""
    goals_str, opp_str = str(value).split("/")
    return int(goals_str), int(opp_str)


def fetch_team_pk_data(game_map):
    rows = []
    missing_category_reported = False
    total = len(game_map)

    for i, (game_id, teams) in enumerate(game_map.items()):
        url = RIGHT_RAIL_URL.format(gameId=game_id)
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as e:
            print(f"[{i + 1}/{total}] Erreur gameId {game_id}: {e}")
            time.sleep(REQUEST_DELAY)
            continue

        stats = data.get("teamGameStats", []) or []
        pp_entry = next((s for s in stats if s.get("category") == "powerPlay"), None)

        if pp_entry is None:
            if not missing_category_reported:
                cats = [s.get("category") for s in stats]
                print(f"Categorie 'powerPlay' introuvable pour gameId {game_id}. Categories disponibles: {cats}")
                missing_category_reported = True
            time.sleep(REQUEST_DELAY)
            continue

        away_goals, away_opp = parse_pp_value(pp_entry.get("awayValue"))
        home_goals, home_opp = parse_pp_value(pp_entry.get("homeValue"))

        if teams is None:
            time.sleep(REQUEST_DELAY)
            away_abbrev, home_abbrev = get_team_abbrevs(game_id)
        else:
            away_abbrev, home_abbrev = teams

        rows.append({
            "gameId": game_id,
            "team": away_abbrev,
            "ppGoalsFor": away_goals,
            "timesOnPP": away_opp,
            "ppGoalsAgainst": home_goals,
        })
        rows.append({
            "gameId": game_id,
            "team": home_abbrev,
            "ppGoalsFor": home_goals,
            "timesOnPP": home_opp,
            "ppGoalsAgainst": away_goals,
        })

        print(f"[{i + 1}/{total}] gameId {game_id}: {away_abbrev} {away_goals}/{away_opp} PP - {home_abbrev} {home_goals}/{home_opp} PP")
        time.sleep(REQUEST_DELAY)

    return rows


def write_csv(rows):
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["gameId", "team", "ppGoalsFor", "timesOnPP", "ppGoalsAgainst"])
        writer.writeheader()
        writer.writerows(rows)


def main():
    if os.path.exists(XLSX_PATH):
        game_map = get_game_ids_from_xlsx()
    else:
        game_map = get_game_ids_from_schedule()

    rows = fetch_team_pk_data(game_map)
    write_csv(rows)
    print(f"Termine: {len(rows)} lignes ecrites dans {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
