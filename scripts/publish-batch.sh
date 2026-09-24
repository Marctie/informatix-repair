#!/bin/sh
# Uso: sh scripts/publish-batch.sh "descrizione"  (build di verifica, commit e push)
set -e
npm run build >/dev/null
git add -A
git commit -q -m "$1

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" 2>&1 | grep -v warning || true
git push origin main 2>&1 | tail -1
