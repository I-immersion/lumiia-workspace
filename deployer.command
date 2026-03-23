#!/bin/bash
# ════════════════════════════════════════════════
# LUMIIA · Workspace · Script de déploiement
# Double-cliquer pour déployer sur GitHub Pages
# ════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Chemin fixe vers le dossier ──
SCRIPT_DIR="/Users/emmanuelexbrayat/Dropbox/DB LUMIIA 2025/Outils APP Claude/Workspace/lumiia-workspace"

cd "$SCRIPT_DIR" || {
  echo -e "${RED}❌ Dossier introuvable : $SCRIPT_DIR${NC}"
  echo -e "${YELLOW}Vérifie que le dossier existe bien à cet emplacement.${NC}"
  read -p "Entrée pour fermer..."; exit 1
}

echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}   LUMIIA · Déploiement Workspace        ${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""

# ── Vérifier les fichiers ──
if [ ! -f "index.html" ]; then
  echo -e "${RED}❌ Fichier index.html introuvable${NC}"
  read -p "Entrée pour fermer..."; exit 1
fi

# ── Lire la version ──
VERSION=$(grep -o 'LUMIIA Workspace v[0-9]*\.[0-9]*' index.html | head -1 | sed 's/LUMIIA Workspace //')
if [ -z "$VERSION" ]; then VERSION="?.?"; fi

echo -e "📄 Version détectée : ${CYAN}${VERSION}${NC}"
echo ""

# ── Message de commit ──
echo -e "${YELLOW}Message de déploiement (décris ce qui a changé) :${NC}"
echo -n "> "
read -r COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="déploiement ${VERSION}"
fi
echo ""

# ── Git push ──
echo -e "🚀 Envoi sur GitHub..."
git pull origin main --rebase 2>&1
git add -A
git commit -m "[${VERSION}] ${COMMIT_MSG}"

PUSH_RESULT=$(git push origin main 2>&1)
PUSH_CODE=$?

if [ $PUSH_CODE -eq 0 ]; then
  echo ""
  echo -e "${GREEN}${BOLD}✅ Déploiement réussi !${NC}"
  echo ""
  echo -e "   App : ${CYAN}https://i-immersion.github.io/lumiia-workspace/${NC}"
  echo ""
  echo -e "   GitHub Pages se met à jour dans ~2 minutes."
else
  echo ""
  echo -e "${RED}❌ Erreur push :${NC}"
  echo "$PUSH_RESULT"
fi

echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""
read -p "Appuie sur Entrée pour fermer..."
# ════════════════════════════════════════════════
# LUMIIA · Workspace · Script de déploiement
# Double-cliquer pour déployer sur GitHub Pages
# ════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Chemin fixe vers le dossier ──
SCRIPT_DIR="/Users/emmanuelexbrayat/Dropbox/DB LUMIIA 2025/LUMIIA Apps/lumiia-workspace"

cd "$SCRIPT_DIR" || {
  echo -e "${RED}❌ Dossier introuvable : $SCRIPT_DIR${NC}"
  echo -e "${YELLOW}Vérifie que le dossier existe bien à cet emplacement.${NC}"
  read -p "Entrée pour fermer..."; exit 1
}

echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}   LUMIIA · Déploiement Workspace        ${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""

# ── Vérifier les fichiers ──
if [ ! -f "index.html" ]; then
  echo -e "${RED}❌ Fichier index.html introuvable${NC}"
  read -p "Entrée pour fermer..."; exit 1
fi

# ── Lire la version ──
VERSION=$(grep -o 'LUMIIA Notes v[0-9]*\.[0-9]*' index.html | head -1 | sed 's/LUMIIA Notes //')
if [ -z "$VERSION" ]; then VERSION="?.?"; fi

echo -e "📄 Version détectée : ${CYAN}${VERSION}${NC}"
echo ""

# ── Message de commit ──
echo -e "${YELLOW}Message de déploiement (décris ce qui a changé) :${NC}"
echo -n "> "
read -r COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="déploiement ${VERSION}"
fi
echo ""

# ── Git push ──
echo -e "🚀 Envoi sur GitHub..."
git pull origin main --rebase 2>&1
git add -A
git commit -m "[${VERSION}] ${COMMIT_MSG}"

PUSH_RESULT=$(git push origin main 2>&1)
PUSH_CODE=$?

if [ $PUSH_CODE -eq 0 ]; then
  echo ""
  echo -e "${GREEN}${BOLD}✅ Déploiement réussi !${NC}"
  echo ""
  echo -e "   App : ${CYAN}https://i-immersion.github.io/lumiia-workspace/${NC}"
  echo ""
  echo -e "   GitHub Pages se met à jour dans ~2 minutes."
else
  echo ""
  echo -e "${RED}❌ Erreur push :${NC}"
  echo "$PUSH_RESULT"
fi

echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""
read -p "Appuie sur Entrée pour fermer..."
