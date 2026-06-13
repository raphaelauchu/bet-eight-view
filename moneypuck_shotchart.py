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
    if x >= 69 and abs_y <= 22:
        return "low"
    if x >= 25 and x <= 69 and abs_y <= 22:
        return "slot"
    if x >= 40 and abs_y > 22 and abs_y <= 40:
        return "lowLeft" if y < 0 else "lowRight"
    if abs_y > 27:
        return "left" if y < 0 else "right"
    return "point"

ZONES = ["slot", "low", "lowLeft", "lowRight", "point", "left", "right"]

def telecharger_shots(season):
    print("Telechargement shots_" + str(season) + ".zip...")
    url = SHOTS_URL.format(season=season)
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        with z.open(z.namelist()[0]) as f:
            df = pd.read_csv(f)
    print(str(len(df)) + " tirs charges")
    return df

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

def stats_derniers_matchs(df_player, jeux, n):
    derniers_jeux = jeux[-n:] if len(jeux) >= n else jeux
    return agregat(df_player[df_player['game_id'].isin(derniers_jeux)])

def calculer_section(df_player):
    if df_player.empty:
        return None
    jeux = sorted(df_player['game_id'].unique())
    total_matchs = len(jeux)
    return {
        "totalGames": total_matchs,
        "szn": agregat(df_player),
        "l5": stats_derniers_matchs(df_player, jeux, 5),
        "l10": stats_derniers_matchs(df_player, jeux, 10),
        "l20": stats_derniers_matchs(df_player, jeux, 20)
    }

def calculer_shotchart(df, player_id):
    df_player_all = df[df['shooterPlayerId'] == player_id].copy()
    if df_player_all.empty:
        print("Joueur " + str(player_id) + " introuvable.")
        return None

    df_player_all['zone'] = df_player_all.apply(
        lambda row: assigner_zone(row['arenaAdjustedXCordABS'], row['arenaAdjustedYCord']),
        axis=1
    )

    df_reg = df_player_all[df_player_all['isPlayoffGame'] == 0]
    df_playoffs = df_player_all[df_player_all['isPlayoffGame'] == 1]

    section_reg = calculer_section(df_reg)
    section_playoffs = calculer_section(df_playoffs)

    if section_reg is None and section_playoffs is None:
        return None

    nom = df_player_all['shooterName'].iloc[0] if 'shooterName' in df_player_all.columns else str(player_id)
    equipe = df_player_all['team'].iloc[-1] if 'team' in df_player_all.columns else ""

    reg_games = section_reg['totalGames'] if section_reg else 0
    playoff_games = section_playoffs['totalGames'] if section_playoffs else 0
    print(str(nom) + " — reg: " + str(reg_games) + " matchs, playoffs: " + str(playoff_games) + " matchs")

    return {
        "playerId": player_id,
        "playerName": nom,
        "team": equipe,
        "season": int(df_player_all['season'].iloc[0]),
        "lastUpdated": datetime.now().isoformat(),
        "reg": section_reg,
        "playoffs": section_playoffs
    }

def sauvegarder_json(data, player_id):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, "shotchart_" + str(player_id) + ".json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Sauvegarde: " + path)
    return path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--player", type=int)
    parser.add_argument("--season", type=int, default=CURRENT_SEASON)
    args = parser.parse_args()

    df = telecharger_shots(args.season)

    if args.player:
        print("Traitement joueur " + str(args.player))
        data = calculer_shotchart(df, args.player)
        if data:
            sauvegarder_json(data, args.player)
    else:
        player_ids = df['shooterPlayerId'].unique()
        print("Traitement de " + str(len(player_ids)) + " joueurs...")
        succes = 0
        for pid in player_ids:
            try:
                data = calculer_shotchart(df, int(pid))
                if data:
                    sauvegarder_json(data, int(pid))
                    succes += 1
            except Exception as e:
                print("Erreur joueur " + str(pid) + " " + str(e))
        print(str(succes) + " joueurs traites")

if __name__ == "__main__":
    main()
