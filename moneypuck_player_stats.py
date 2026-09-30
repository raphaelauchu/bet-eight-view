"""
moneypuck_player_stats.py
------------------------
Source : MoneyPuck (moneypuck.com), résumé de saison par joueur (skaters).
Endpoint : moneypuck.com/moneypuck/playerData/seasonSummary/{season}/regular/skaters.csv

On conserve TOUTES les colonnes du CSV (pas de filtrage) pour flexibilité future, comme
moneypuck_team_stats.py le fait déjà pour les équipes.

En plus des colonnes brutes, on calcule et expose par joueur (situation 'all' sauf mention
contraire) les variables pré-calculées utilisées par le modèle de donut (compute_donut_scores.py) :
  - preIxG_per60      = I_F_xGoals / icetime * 3600
  - preAssists_per60  = (I_F_primaryAssists + I_F_secondaryAssists) / icetime * 3600
  - preShots_per60    = I_F_shotsOnGoal / icetime * 3600
  - prePP_TOI_avg_sec = icetime (situation '5on4') / games_played (situation '5on4')

Output JSON (un seul fichier, écrasé à chaque run) :
  public/data/moneypuck_player_stats.json
  {
    "season": 2025,
    "lastUpdated": "...",
    "players": {
      "<playerId>": {
        "all": { ...toutes les colonnes... + variables pré-calculées },
        "5on4": { ...toutes les colonnes... },
        ...
      },
      ...
    }
  }

Usage :
  python moneypuck_player_stats.py
  python moneypuck_player_stats.py --season 2025
"""

import argparse
import io
import json
import math
import os
from datetime import datetime

import pandas as pd
import requests

CURRENT_SEASON = 2025
OUTPUT_DIR = "public/data"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "moneypuck_player_stats.json")
SKATERS_URL = "https://moneypuck.com/moneypuck/playerData/seasonSummary/{season}/regular/skaters.csv"

# MoneyPuck bloque les requêtes sans User-Agent de navigateur (mur "data license").
REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}


def telecharger_skaters_csv(season):
    print("Telechargement skaters.csv saison " + str(season) + "...")
    url = SKATERS_URL.format(season=season)
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=60)
    response.raise_for_status()
    df = pd.read_csv(io.StringIO(response.text))
    print(str(len(df)) + " lignes chargees (joueurs x situations)")
    return df


def nettoyer_valeur(v):
    """Convertit les valeurs pandas (NaN, numpy types) en types JSON-serialisables."""
    if isinstance(v, float) and math.isnan(v):
        return None
    if hasattr(v, "item"):
        return v.item()
    return v


def calculer_variables_donut(situations):
    """Ajoute les variables pré-calculées du modèle donut dans situations['all']."""
    all_stats = situations.get("all")
    if not all_stats:
        return

    icetime = all_stats.get("icetime")
    if icetime:
        all_stats["preIxG_per60"] = all_stats.get("I_F_xGoals", 0) / icetime * 3600
        primary = all_stats.get("I_F_primaryAssists") or 0
        secondary = all_stats.get("I_F_secondaryAssists") or 0
        all_stats["preAssists_per60"] = (primary + secondary) / icetime * 3600
        all_stats["preShots_per60"] = all_stats.get("I_F_shotsOnGoal", 0) / icetime * 3600
    else:
        all_stats["preIxG_per60"] = None
        all_stats["preAssists_per60"] = None
        all_stats["preShots_per60"] = None

    pp_stats = situations.get("5on4")
    games_played = pp_stats.get("games_played") if pp_stats else None
    if pp_stats and games_played:
        all_stats["prePP_TOI_avg_sec"] = pp_stats.get("icetime", 0) / games_played
    else:
        all_stats["prePP_TOI_avg_sec"] = None


def construire_structure(df):
    players = {}
    for _, row in df.iterrows():
        player_id = str(row.get("playerId"))
        situation = row.get("situation", "all")
        if player_id not in players:
            players[player_id] = {}
        players[player_id][situation] = {
            col: nettoyer_valeur(row[col]) for col in df.columns
        }

    for situations in players.values():
        calculer_variables_donut(situations)

    return players


def sauvegarder_json(players, season):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    data = {
        "season": season,
        "lastUpdated": datetime.now().isoformat(),
        "players": players,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Sauvegarde: " + OUTPUT_PATH + " (" + str(len(players)) + " joueurs)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, default=CURRENT_SEASON)
    args = parser.parse_args()

    df = telecharger_skaters_csv(args.season)
    players = construire_structure(df)
    sauvegarder_json(players, args.season)


if __name__ == "__main__":
    main()
