import requests, zipfile, io, pandas as pd
r = requests.get('https://peter-tanner.com/moneypuck/downloads/shots_2025.zip', timeout=120)
with zipfile.ZipFile(io.BytesIO(r.content)) as z:
    with z.open(z.namelist()[0]) as f:
        df = pd.read_csv(f)
df_p = df[(df['shooterPlayerId']==8475791) & (df['isPlayoffGame']==0)]
print('event values:', df_p['event'].value_counts().to_dict())
for e in df_p['event'].unique():
    sub = df_p[df_p['event']==e]
    print(e, len(sub), 'SOG:', int(sub['shotWasOnGoal'].sum()), 'buts:', int(sub['goal'].sum()))