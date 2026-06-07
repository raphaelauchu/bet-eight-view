import requests
import pandas as pd
import io
import zipfile

PLAYER_ID = 8475791
SEASON = 2025

print("=" * 60)
print("1. SEASON SUMMARY")
print("=" * 60)
url_szn = f"https://moneypuck.com/moneypuck/playerData/seasonSummary/{SEASON}/regular/skaters.csv"
response = requests.get(url_szn)
response.raise_for_status()
df_szn = pd.read_csv(io.StringIO(response.text))
print(f"Colonnes ({len(df_szn.columns)}):")
for col in df_szn.columns:
    print(f"  {col}")
shot_cols = [c for c in df_szn.columns if 'shot' in c.lower() or 'goal' in c.lower()]
player_row = df_szn[df_szn['playerId'] == PLAYER_ID]
print(f"\nJoueur {PLAYER_ID} trouvé: {not player_row.empty}")
if not player_row.empty:
    print(player_row[shot_cols].to_string())

print("\n" + "=" * 60)
print("2. GAME-BY-GAME")
print("=" * 60)
url_gbg = f"https://peter-tanner.com/moneypuck/downloads/seasonPlayersSummary/skaters/{SEASON}.zip"
response_zip = requests.get(url_gbg)
response_zip.raise_for_status()
with zipfile.ZipFile(io.BytesIO(response_zip.content)) as z:
    print(f"Fichiers ZIP: {z.namelist()}")
    with z.open(z.namelist()[0]) as f:
        df_gbg = pd.read_csv(f)
print(f"Colonnes ({len(df_gbg.columns)}):")
for col in df_gbg.columns:
    print(f"  {col}")
shot_cols_gbg = [c for c in df_gbg.columns if 'shot' in c.lower() or 'goal' in c.lower()]
player_gbg = df_gbg[df_gbg['playerId'] == PLAYER_ID]
print(f"\nJoueur {PLAYER_ID} trouvé: {not player_gbg.empty}, matchs: {len(player_gbg)}")
if not player_gbg.empty:
    print(player_gbg[shot_cols_gbg].head(5).to_string())