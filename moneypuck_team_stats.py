"""
moneypuck_team_stats.py
------------------------
Source : MoneyPuck (moneypuck.com), résumé de saison par équipe.
Endpoint : moneypuck.com/moneypuck/playerData/seasonSummary/{season}/regular/teams.csv

Contient notamment, par équipe et par situation de jeu (all, 5on5, 4on5, 5on4...) :
  - highDangerShotsAgainst / mediumDangerShotsAgainst / lowDangerShotsAgainst
  - highDangerGoalsAgainst / mediumDangerGoalsAgainst / lowDangerGoalsAgainst
  - xGoalsAgainst, goalsAgainst, shotsOnGoalAgainst
  - et leurs équivalents "For"

On conserve TOUTES les colonnes du CSV (pas de filtrage) pour flexibilité future.

Output JSON (un seul fichier, écrasé à chaque run) :
  public/data/moneypuck_team_stats.json
  {
    "season": 2025,
    "lastUpdated": "...",
    "teams": {
      "TOR": {
        "all": { ...toutes les colonnes du CSV... },
        "5on5": { ... },
        "4on5": { ... },
        "5on4": { ... },
        "other": { ... }
      },
      ...
    }
  }

Usage :
  python moneypuck_team_stats.py
  python moneypuck_team_stats.py --season 2025
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
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "moneypuck_team_stats.json")
TEAMS_URL = "https://moneypuck.com/moneypuck/playerData/seasonSummary/{season}/regular/teams.csv"


def telecharger_teams_csv(season):
    print("Telechargement teams.csv saison " + str(season) + "...")
    url = TEAMS_URL.format(season=season)
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    df = pd.read_csv(io.StringIO(response.text))
    print(str(len(df)) + " lignes chargees (equipes x situations)")
    return df


def nettoyer_valeur(v):
    """Convertit les valeurs pandas (NaN, numpy types) en types JSON-serialisables."""
    if isinstance(v, float) and math.isnan(v):
        return None
    if hasattr(v, "item"):
        return v.item()
    return v


def construire_structure(df):
    teams = {}
    for _, row in df.iterrows():
        team = row.get("team")
        situation = row.get("situation", "all")
        if team not in teams:
            teams[team] = {}
        teams[team][situation] = {
            col: nettoyer_valeur(row[col]) for col in df.columns
        }
    return teams


def sauvegarder_json(teams, season):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    data = {
        "season": season,
        "lastUpdated": datetime.now().isoformat(),
        "teams": teams,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Sauvegarde: " + OUTPUT_PATH + " (" + str(len(teams)) + " equipes)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, default=CURRENT_SEASON)
    args = parser.parse_args()

    df = telecharger_teams_csv(args.season)
    teams = construire_structure(df)
    sauvegarder_json(teams, args.season)


if __name__ == "__main__":
    main()
