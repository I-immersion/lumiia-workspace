#!/bin/bash
set -u
PROJ="$(cd "$(dirname "$0")" && pwd)"
MARQUEUR="LUMIIA Workspace v"
PAGE="https://i-immersion.github.io/lumiia-workspace/"
ZONES=("$HOME/Downloads" "$HOME/Desktop")
TROUVE=""
for Z in "${ZONES[@]}"; do
  [ -d "$Z" ] || continue
  while IFS= read -r zip; do
    TMP=$(mktemp -d)
    if unzip -qo "$zip" -d "$TMP" 2>/dev/null; then
      IDX=$(find "$TMP" -type f -name 'index.html' 2>/dev/null | head -1)
      IDE=$(find "$TMP" -type f -name 'idees.html' 2>/dev/null | head -1)
      if [ -n "$IDX" ] && grep -q "$MARQUEUR" "$IDX" 2>/dev/null; then
        VER=$(sed -n '1,25p' "$IDX" | grep -oE 'v[0-9]+[.][0-9]+' | head -1)
        if [ -n "$VER" ]; then
          mkdir -p "$PROJ/_versions"
          if [ -f "$PROJ/index.html" ]; then
            OLD=$(sed -n '1,25p' "$PROJ/index.html" | grep -oE 'v[0-9]+[.][0-9]+' | head -1)
            cp "$PROJ/index.html" "$PROJ/_versions/index_${OLD:-inconnue}_$(date +%Y%m%d-%H%M%S).html"
          fi
          cp "$IDX" "$PROJ/index.html"
          [ -n "$IDE" ] && cp "$IDE" "$PROJ/idees.html"
          TROUVE="$VER"
          rm -f "$zip"
        fi
      fi
    fi
    rm -rf "$TMP"
    [ -n "$TROUVE" ] && break
  done < <(find "$Z" -maxdepth 1 -type f -name '*.zip' -mtime -3 2>/dev/null)
  [ -n "$TROUVE" ] && break
done
if [ -z "$TROUVE" ]; then
  echo "STOP : aucune livraison Workspace dans Telechargements ou sur le Bureau."
  echo "Clique d'abord la carte dans la conversation, puis relance cette ligne."
  exit 1
fi
echo "Livraison $TROUVE installee dans le dossier du projet."
cd "$PROJ" || exit 1
grep -q '_versions/' .gitignore 2>/dev/null || printf '.DS_Store\n_versions/\n' >> .gitignore
git add -A
if git diff --cached --quiet; then
  echo "Rien de nouveau a pousser."
else
  git commit -q -m "$TROUVE"
  git pull --rebase -q >/dev/null 2>&1 || true
  git push -q -u origin HEAD || { echo "Push refuse."; exit 1; }
  echo "Push effectue."
fi
OK=""
for i in $(seq 1 12); do
  sleep 10
  SERVI=$(curl -s -m 10 -H 'Cache-Control: no-cache' "${PAGE}?probe=$(date +%s)" 2>/dev/null | sed -n '1,25p' | grep -oE 'v[0-9]+[.][0-9]+' | head -1)
  [ "$SERVI" = "$TROUVE" ] && { OK="oui"; break; }
  printf '.'
done
echo
if [ -n "$OK" ]; then
  echo "$TROUVE EN LIGNE : $PAGE"
else
  echo "Push OK mais Pages sert encore ${SERVI:-illisible}. Ce n'est PAS le cache navigateur."
fi
