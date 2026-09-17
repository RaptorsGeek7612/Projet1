# Registre des Porteurs — T-REX / ERC-3643

Indexeur et interface qui reconstruisent, en temps quasi réel, le registre des porteurs d'un token conforme [ERC-3643](https://www.erc3643.org/) (suite T-REX) : qui détient quoi, combien est gelé, dans quelle juridiction, et si le token est actif ou en pause. Toutes les données viennent directement de la blockchain (Sepolia) — rien n'est saisi à la main.

## Structure du repo

| Dossier | Rôle | Doc |
|---|---|---|
| `backend/` | Indexeur [Ponder](https://ponder.sh) qui rejoue les événements on-chain (`Transfer`, `IdentityRegistered`, `TokensFrozen`, ...) et les expose en HTTP/GraphQL | [`backend/README.md`](backend/README.md) |
| `frontend/` | Dashboard Next.js qui consomme l'API de l'indexeur | [`frontend/README.md`](frontend/README.md) |

Les deux sont des projets pnpm indépendants (workspace propre à chacun), déployés séparément : backend sur Railway, frontend sur Vercel.

## Par où commencer

- **Tu veux utiliser l'interface** (agent de conformité, opérationnel, investisseur) : lis [`GUIDE-UTILISATEUR.md`](GUIDE-UTILISATEUR.md).
- **Tu veux faire tourner ou modifier le projet** : lis [`backend/README.md`](backend/README.md) (indexeur, API, déploiement des contrats de test) puis [`frontend/README.md`](frontend/README.md) (dashboard).
- **Tu veux contribuer** (PR, checks à passer, convention de commits) : lis [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Démarrage rapide (local)

```bash
# Backend — indexeur + API sur http://localhost:42069
cd backend
pnpm install
cp .env.local.example .env.local   # renseigner RPC, adresses, START_BLOCK
pnpm dev

# Frontend — dashboard sur http://localhost:3000
cd frontend
pnpm install
pnpm dev
```

Détails, variables d'environnement et limites connues : voir les README de chaque dossier.

## CI

`.github/workflows/ci.yml` fait tourner, à chaque push/PR sur `main` : typecheck + compilation des contrats + tests (backend), typecheck + build (frontend).

## Licence

MIT — voir [`LICENSE`](LICENSE).
