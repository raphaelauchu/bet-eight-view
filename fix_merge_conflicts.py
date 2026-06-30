"""
fix_merge_conflicts.py
-----------------------
Nettoie les conflits Git non résolus dans public/data/shotchart_*.json.
Garde la version "incoming" (entre ======= et >>>>>>>).
Traite ligne par ligne pour gérer plusieurs blocs de conflit par fichier.

Usage:
  python fix_merge_conflicts.py
"""

import glob

def fix_file(path):
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    if not any(l.startswith("<<<<<<<") for l in lines):
        return False

    result = []
    mode = "normal"  # normal | ours | theirs

    for line in lines:
        if line.startswith("<<<<<<<"):
            mode = "ours"
            continue
        elif line.startswith("======="):
            mode = "theirs"
            continue
        elif line.startswith(">>>>>>>"):
            mode = "normal"
            continue

        if mode == "normal":
            result.append(line)
        elif mode == "theirs":
            result.append(line)
        # mode == "ours" -> skip (on jette la version HEAD)

    with open(path, "w", encoding="utf-8") as f:
        f.writelines(result)
    return True


def main():
    files = glob.glob("public/data/shotchart_*.json")
    print(f"{len(files)} fichiers trouvés.")

    fixed_count = 0
    for path in files:
        try:
            if fix_file(path):
                fixed_count += 1
        except Exception as e:
            print(f"Erreur sur {path}: {e}")

    print(f"\n{fixed_count} fichiers corrigés.")


if __name__ == "__main__":
    main()
