"""
moneypuck_shotchart.py
-----------------------
Télécharge les données de tirs MoneyPuck et génère des fichiers JSON
de shot chart par joueur, compatibles avec l'app React bet-eight-view.

Usage:
    python moneypuck_shotchart.py                  # saison courante, tous les joueurs du jour
    python moneypuck_shotchart.py --player 8475791 # un joueur spécifique
    python moneypuck_shotchart.py --season 2024    # saison spécifique

Output:
    public/data/shotchart_{playerId}.json
"""

import requests
import zipfile
import io
import json
import os
import argparse
import pandas as pd
from datetime import datetime

CURRENT_SEASON = 2025
OUTPUT_DIR = "public/data"
SHOTS_URL = "https://peter-tanner.com/moneypuck/downloads/shots_{season}.zip"


def assigner_zone(x, y):
    abs_y = abs(y)
    if x >= 25 and x <= 69 and abs_y <= 22:
        return "slot"
    if x >= 69 and abs_y <= 22:
        return "low"
    if x >= 40 and abs_y > 22 and abs_y <= 40:
        return "lowLeft" if y < 0 else "lowRight"
    if x <= 25 and abs_y <= 27:
        return "point"
    if abs_y > 27:
        return "left" if y < 0 else "right"
    return "point"


ZONES = ["slot", "low", "lowLeft", "lowRight", "point", "left", "right"]


def telecharger_shots(season):
    print(f"Telechargement shots_{season}.zip...")
    url = SHOTS_URL.format(season=season)
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        with z.open(z.namelist()[0]) as f:
            df = pd.read_csv(f)
    print(f"   {len(df):,} tirs charges")
    return df


def calculer_shotchart(df, player_id):
    df_reg = df[df['isPlayoffGame'] == 0].copy()
    df_player = df_reg[df_reg['shooterPlayerId'] == player_id].copy()
    if df_player.empty:
        print(f"   Joueur {player_id} introuvable.")
        return None
    df_player['zone'] = df_player.apply(
        lambda row: assigner_zone(row['arenaAdjustedXCordABS'], row['arenaAdjustedYCord']),
        axis=1
    )
    jeux = sorted(df_player['game_id'].unique())
    total_matchs = len(jeux)
    print(f"   {len(df_player)} tirs sur {total_matchs} matchs")

    def agregat(subset):
        stats = {}
        for zone in ZONES:
            zone_df = subset[subset['zone'] == zone]
            stats[zone] = {
                "shotsOnGoal": int(zone_df['shotWasOnGoal'].sum()),
                "goals": int(zone_df['goal'].sum()),
                "attempts": int(len(zone_df)),
                "xGoals": round(float(zone_df['xGoal'].sum()), 2)
            }
        stats["total"] = {
            "shotsOnGoal": int(subset['shotWasOnGoal'].sum()),
            "goals": int(subset['goal'].sum()),
            "attempts": int(len(subset)),
            "xGoals": round(float(subset['xGoal'].sum()), 2)
        }
        return stats

    def stats_derniers_matchs(n):
        derniers_jeux = jeux[-n:] if total_matchs >= n else jeux
        return agregat(df_player[df_player['game_id'].isin(derniers_jeux)])

    nom = df_player['shooterName'].iloc[0] if 'shooterName' in df_player.columns else str(player_id)
    equipe = df_player['team'].iloc[-1]