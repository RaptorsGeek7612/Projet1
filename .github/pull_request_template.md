## Quoi et pourquoi

<!-- Le changement, et surtout la raison (bug corrigé, besoin couvert). -->

## Zone touchée

- [ ] backend (indexeur Ponder / API)
- [ ] backend (contrats Solidity)
- [ ] frontend (dashboard)
- [ ] CI / déploiement
- [ ] documentation

## Vérifications

- [ ] CI vert (`.github/workflows/ci.yml`) — typecheck + tests backend, build + typecheck frontend
- [ ] Si contrats Solidity modifiés : skill `solidity-security-audit` lancé
- [ ] Si comportement UI modifié : testé dans le navigateur (pas seulement les tests automatisés)
- [ ] Documentation mise à jour si le comportement observable change (README concerné, `GUIDE-UTILISATEUR.md`)

## Notes de déploiement

<!-- `main` déploie automatiquement (backend → Railway, frontend → Vercel). Signaler ici toute variable
d'environnement ou migration nécessaire avant/après le merge, sinon supprimer cette section. -->
