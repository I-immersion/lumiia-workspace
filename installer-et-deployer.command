#!/bin/bash
set -u
PROJ="$(cd "$(dirname "$0")" && pwd)"
MARQUEUR="LUMIIA Workspace v"
PAGE="https://i-immersion.github.io/lumiia-workspace/"
TROUVE=""; SRC_IDX=""; SRC_IDE=""; ACONSOMMER=""

essaye() {
  local idx="$1" ide="$2" src="$3"
  [ -n "$idx" ] || return 1
  grep -q "$MARQUEUR" "$idx" 2>/dev/null || return 1
  local v
  v=$(sed -n '1,25p' "$idx" | grep -oE 'v[0-9]+[.][0-9]+' | head -1)
  [ -n "$v" ] || return 1
  TROUVE="$v"; SRC_IDX="$idx"; SRC_IDE="$ide"; ACONSOMMER="$src"
  return 0
}

while IFS= read -r C; do
  [ -e "$C" ] || continue
  case "$C" in
    *.zip)
      TMP=$(mktemp -d)
      if unzip -qo "$C" -d "$TMP" 2>/dev/null; then
        essaye "$(find "$TMP" -type f -name 'index.html' | head -1)" \
               "$(find "$TMP" -type f -name 'idees.html' | head -1)" "$C" && break
      fi
      rm -rf "$TMP" ;;
    *)
      if [ -d "$C" ]; then
        essaye "$(find "$C" -maxdepth 2 -type f -name 'index.html' | head -1)" \
               "$(find "$C" -maxdepth 2 -type f -name 'idees.html' | head -1)" "$C" && break
      elif [ -f "$C" ]; then
        case "$C" in *.html)
          essaye "$C" "$(dirname "$C")/idees.html" "" && break ;;
        esac
      fi ;;
  esac
done < <(ls -td "$HOME/Downloads"/* "$HOME/Desktop"/* 2>/dev/null)

if [ -z "$TROUVE" ]; then
  echo "STOP : aucune livraison Workspace trouvee."
  echo "Cherche : un .zip, un dossier decompresse, ou un index.html portant le marqueur."
  echo "Clique la carte dans la conversation, puis relance cette ligne."
  exit 1
fi

mkdir -p "$PROJ/_versions"
if [ -f "$PROJ/index.html" ]; then
  OLD=$(sed -n '1,25p' "$PROJ/index.html" | grep -oE 'v[0-9]+[.][0-9]+' | head -1)
  cp "$PROJ/index.html" "$PROJ/_versions/index_${OLD:-inconnue}_$(date +%Y%m%d-%H%M%S).html"
fi
cp "$SRC_IDX" "$PROJ/index.html"
[ -n "$SRC_IDE" ] && [ -f "$SRC_IDE" ] && cp "$SRC_IDE" "$PROJ/idees.html"
[ -n "$ACONSOMMER" ] && rm -rf "$ACONSOMMER"
echo "Livraison $TROUVE installee."

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
