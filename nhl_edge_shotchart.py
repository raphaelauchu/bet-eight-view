"""
nhl_edge_shotchart.py
---------------------
Remplace moneypuck_shotchart.py.
Source : NHL EDGE API (api-web.nhle.com)

Output JSON par joueur → public/data/shotchart_{playerId}.json

Structure output :
  {
    playerId, playerName, team, position, season, lastUpdated,
    reg: { totalGames, szn, l5, l10, l20 },
    playoffs: { totalGames, szn, l5, l10, l20 }
  }

  Chaque section szn/l5/l10/l20 :
  {
    slot, highSlot, leftCircle, rightCircle,
    cornerLeft, cornerRight, pointLeft, pointRight, pointCenter,
    total,
    totals: { all, high, mid, long }   ← catégories NHL EDGE directes
  }

  Chaque zone : { shotsOnGoal, goals, shootingPctg, sogPercentile, goalsPercentile }

Usage :
  python nhl_edge_shotchart.py                    # tous les joueurs, saison en cours
  python nhl_edge_shotchart.py --player 8478402   # un seul joueur
  python nhl_edge_shotchart.py --season 20242025
  python nhl_edge_shotchart.py --player 8475791 --debug-raw
"""

import argparse
import json
import os
import time
from datetime import datetime

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def current_season() -> str:
    """Saison NHL en cours — bascule automatiquement en octobre."""
    today = datetime.now()
    y, m = today.year, today.month
    return f"{y}{y + 1}" if m >= 10 else f"{y - 1}{y}"

CURRENT_SEASON = current_season()
OUTPUT_DIR = "public/data"
RAW_DIR    = "debug_raw"
BASE_WEB   = "https://api-web.nhle.com/v1"
BASE_STATS = "https://api.nhle.com/stats/rest/en"
DELAY      = 0.35

# ---------------------------------------------------------------------------
# Mapping zones NHL EDGE → noms output
#
# NHL EDGE "area" → clé de zone dans le JSON output
# Plusieurs areas peuvent se combiner dans une même zone output
# ---------------------------------------------------------------------------

AREA_TO_ZONE = {
    "Low Slot":               "slot",
    "Crease":                 "slot",
    "High Slot":              "highSlot",
    "L Circle":               "leftCircle",
    "R Circle":               "rightCircle",
    "L Net Side":             "cornerLeft",
    "L Corner":               "cornerLeft",
    "R Net Side":             "cornerRight",
    "R Corner":               "cornerRight",
    "L Point":                "pointLeft",
    "R Point":                "pointRight",
    "Center Point":           "pointCenter",
    "Outside L":              "leftCircle",
    "Outside R":              "rightCircle",
    "Offensive Neutral Zone": "pointCenter",
    # "Behind the Net" et "Beyond Red Line" ignorés (derrière le filet)
}

ZONES_OUTPUT = [
    "slot", "highSlot",
    "leftCircle", "rightCircle",
    "cornerLeft", "cornerRight",
    "pointLeft", "pointRight", "pointCenter",
]

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "nhl-edge-shotchart/1.0"})


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def get_json(url: str) -> dict | list | None:
    try:
        resp = SESSION.get(url, timeout=20)
        resp.raise_for_status()
        return resp.json()
    except requests.HTTPError as e:
        print(f"  [HTTP {e.response.status_code}] {url}")
        return None
    except Exception as e:
        print(f"  [ERR] {url} — {e}")
        return None


# ---------------------------------------------------------------------------
# Joueurs
# ---------------------------------------------------------------------------

def get_all_player_ids(season: str) -> list[dict]:
    """Récupère tous les skaters via pagination (100 par page)."""
    players = []
    start = 0
    page_size = 100

    while True:
        url = (
            f"{BASE_STATS}/skater/summary"
            f"?isAggregate=false&isGame=false"
            f'&sort=[{{"property":"points","direction":"DESC"}}]'
            f"&start={start}&limit={page_size}"
            f"&cayenneExp=gameTypeId=2 and seasonId<={season} and seasonId>={season}"
        )
        data = get_json(url)
        if not data or "data" not in data:
            break

        rows = data["data"]
        if not rows:
            break

        for row in rows:
            players.append({
                "playerId":   row["playerId"],
                "name":       row.get("skaterFullName", str(row["playerId"])),
                "teamAbbrev": row.get("teamAbbrevs", ""),
                "position":   row.get("positionCode", ""),
            })

        # Si on a reçu moins que page_size, c'est la dernière page
        if len(rows) < page_size:
            break

        start += page_size
        time.sleep(DELAY)

    print(f"  {len(players)} joueurs trouvés pour {season}")
    return players


def get_player_info(player_id: int) -> dict:
    url = f"{BASE_WEB}/player/{player_id}/landing"
    data = get_json(url)
    if not data:
        return {"name": str(player_id), "teamAbbrev": "", "position": ""}
    first = data.get("firstName", {}).get("default", "")
    last  = data.get("lastName",  {}).get("default", "")
    return {
        "name":       data.get("fullName") or f"{first} {last}".strip(),
        "teamAbbrev": data.get("currentTeamAbbrev", ""),
        "position":   data.get("position", ""),
    }


# ---------------------------------------------------------------------------
# Fetch EDGE
# ---------------------------------------------------------------------------

def fetch_shot_location(player_id: int, season: str, game_type: int) -> dict | None:
    url = f"{BASE_WEB}/edge/skater-shot-location-detail/{player_id}/{season}/{game_type}"
    return get_json(url)


def fetch_game_log(player_id: int, season: str, game_type: int) -> list[dict]:
    url = f"{BASE_WEB}/player/{player_id}/game-log/{season}/{game_type}"
    data = get_json(url)
    if not data:
        return []
    return sorted(data.get("gameLog", []), key=lambda g: g.get("gameDate", ""))


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_shot_location(raw: dict) -> dict | None:
    """
    Transforme la réponse NHL EDGE en dict de zones standardisées.

    Input attendu :
    {
      "shotLocationDetails": [ { "area": "Low Slot", "sog": 50, "goals": 11, ... }, ... ],
      "shotLocationTotals":  [ { "locationCode": "all", "sog": 137, ... }, ... ]
    }
    """
    if not raw or "shotLocationDetails" not in raw:
        return None

    details = raw["shotLocationDetails"]
    totals_raw = raw.get("shotLocationTotals", [])

    # Zones géographiques
    zones = {z: {"shotsOnGoal": 0, "goals": 0, "shootingPctg": 0.0,
                 "sogPercentile": 0.0, "goalsPercentile": 0.0} for z in ZONES_OUTPUT}
    zone_counts = {z: 0 for z in ZONES_OUTPUT}  # pour moyenner les percentiles

    for item in details:
        area   = item.get("area", "")
        zone   = AREA_TO_ZONE.get(area)
        if not zone:
            continue
        zones[zone]["shotsOnGoal"]    += int(item.get("sog", 0) or 0)
        zones[zone]["goals"]          += int(item.get("goals", 0) or 0)
        zones[zone]["sogPercentile"]  += float(item.get("sogPercentile", 0) or 0)
        zones[zone]["goalsPercentile"]+= float(item.get("goalsPercentile", 0) or 0)
        zone_counts[zone]             += 1

    # Moyenne des percentiles quand plusieurs areas → même zone
    for z in ZONES_OUTPUT:
        n = zone_counts[z]
        if n > 1:
            zones[z]["sogPercentile"]   = round(zones[z]["sogPercentile"]   / n, 4)
            zones[z]["goalsPercentile"] = round(zones[z]["goalsPercentile"] / n, 4)
        else:
            zones[z]["sogPercentile"]   = round(zones[z]["sogPercentile"],   4)
            zones[z]["goalsPercentile"] = round(zones[z]["goalsPercentile"], 4)
        # Recalculer shooting%
        sog = zones[z]["shotsOnGoal"]
        zones[z]["shootingPctg"] = round(zones[z]["goals"] / sog, 4) if sog else 0.0

    # Total général
    total_sog   = sum(z["shotsOnGoal"] for z in zones.values())
    total_goals = sum(z["goals"]       for z in zones.values())
    zones["total"] = {
        "shotsOnGoal":  total_sog,
        "goals":        total_goals,
        "shootingPctg": round(total_goals / total_sog, 4) if total_sog else 0.0,
    }

    # Catégories NHL EDGE directes (high / mid / long / all)
    totals = {}
    for t in totals_raw:
        code = t.get("locationCode", "")
        totals[code] = {
            "shotsOnGoal":      int(t.get("sog", 0) or 0),
            "goals":            int(t.get("goals", 0) or 0),
            "shootingPctg":     round(float(t.get("shootingPctg", 0) or 0), 4),
            "sogPercentile":    round(float(t.get("sogPercentile", 0) or 0), 4),
            "goalsPercentile":  round(float(t.get("goalsPercentile", 0) or 0), 4),
            "sogLeagueAvg":     round(float(t.get("sogLeagueAvg", 0) or 0), 4),
            "goalsLeagueAvg":   round(float(t.get("goalsLeagueAvg", 0) or 0), 4),
        }
    zones["totals"] = totals

    return zones


def build_section(szn_stats: dict | None, game_log: list) -> dict | None:
    if szn_stats is None:
        return None
    return {
        "totalGames": len(game_log),
        "szn":  szn_stats,
        "l5":   None,   # TODO: pas d'endpoint NHL EDGE par fenêtre glissante
        "l10":  None,
        "l20":  None,
    }


# ---------------------------------------------------------------------------
# Calcul principal par joueur
# ---------------------------------------------------------------------------

def calculer_shotchart(player_id: int, name: str, team: str, position: str,
                       season: str, debug_raw: bool) -> dict | None:
    season_int = int(season[4:])  # "20252026" → 2026

    raw_reg = fetch_shot_location(player_id, season, game_type=2)
    time.sleep(DELAY)
    log_reg = fetch_game_log(player_id, season, game_type=2)
    time.sleep(DELAY)

    raw_po  = fetch_shot_location(player_id, season, game_type=3)
    time.sleep(DELAY)
    log_po  = fetch_game_log(player_id, season, game_type=3)
    time.sleep(DELAY)

    if debug_raw:
        os.makedirs(RAW_DIR, exist_ok=True)
        with open(os.path.join(RAW_DIR, f"raw_{player_id}.json"), "w") as f:
            json.dump({"reg": raw_reg, "playoffs": raw_po}, f, indent=2)
        print(f"    Raw sauvegardé → {RAW_DIR}/raw_{player_id}.json")

    section_reg      = build_section(parse_shot_location(raw_reg), log_reg)
    section_playoffs = build_section(parse_shot_location(raw_po),  log_po)

    if section_reg is None and section_playoffs is None:
        return None

    reg_games = section_reg["totalGames"]      if section_reg      else 0
    po_games  = section_playoffs["totalGames"] if section_playoffs else 0
    print(f"    {name} — reg: {reg_games} matchs, playoffs: {po_games} matchs")

    return {
        "playerId":    player_id,
        "playerName":  name,
        "team":        team,
        "position":    position,
        "season":      season_int,
        "lastUpdated": datetime.now().isoformat(),
        "reg":         section_reg,
        "playoffs":    section_playoffs,
    }


# ---------------------------------------------------------------------------
# Sauvegarde
# ---------------------------------------------------------------------------

def sauvegarder_json(data: dict, player_id: int):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, f"shotchart_{player_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"    Sauvegardé : {path}")
    return path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="NHL EDGE shot chart scraper")
    parser.add_argument("--player",    type=int,  help="Player ID spécifique")
    parser.add_argument("--season",    default=CURRENT_SEASON, help="ex: 20252026")
    parser.add_argument("--debug-raw", action="store_true",
                        help=f"Sauvegarde les réponses brutes dans {RAW_DIR}/")
    args = parser.parse_args()

    print(f"NHL EDGE Shot Chart Scraper — saison {args.season}")
    print("=" * 55)

    if args.player:
        info = get_player_info(args.player)
        print(f"Joueur : {info['name']} ({args.player})")
        data = calculer_shotchart(
            args.player,
            info["name"], info["teamAbbrev"], info["position"],
            args.season, args.debug_raw
        )
        if data:
            sauvegarder_json(data, args.player)
        else:
            print("Aucune donnée shot location trouvée.")
    else:
        print("Récupération de la liste des joueurs…")
        players = get_all_player_ids(args.season)
        if not players:
            return

        total = len(players)
        succes, erreurs = 0, 0
        print(f"\nTraitement de {total} joueurs…\n")

        for i, p in enumerate(players, 1):
            pid = p["playerId"]
            print(f"[{i:4d}/{total}] {p['name']} ({pid})")

            out_path = os.path.join(OUTPUT_DIR, f"shotchart_{pid}.json")
            if os.path.exists(out_path) and not args.debug_raw:
                print("    Skip (déjà existant)")
                succes += 1
                continue

            try:
                data = calculer_shotchart(
                    pid,
                    p["name"], p["teamAbbrev"], p["position"],
                    args.season, args.debug_raw
                )
                if data:
                    sauvegarder_json(data, pid)
                    succes += 1
                else:
                    print("    Aucune donnée.")
                    erreurs += 1
            except Exception as e:
                print(f"    ERREUR : {e}")
                erreurs += 1

        print(f"""
Terminé.
  Succès  : {succes}
  Erreurs : {erreurs}
  Output  : {OUTPUT_DIR}/
""")


if __name__ == "__main__":
    main()
