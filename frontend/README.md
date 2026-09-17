# Registre des Porteurs — Frontend

Dashboard Next.js qui affiche, en lecture seule, le registre des porteurs d'un token ERC-3643 (T-REX) tel que reconstruit par l'indexeur (`../backend`). Pour l'usage de l'interface elle-même, voir [`../GUIDE-UTILISATEUR.md`](../GUIDE-UTILISATEUR.md) ; ce README couvre la partie technique.

## Ce que ça affiche

- **Tuiles de synthèse** (`src/components/stat-tiles.tsx`) : encours total, nombre de porteurs, nombre de gels partiels, statut du token (actif/en pause).
- **Tableau des porteurs** (`src/app/registry-table.tsx`) : adresse (lien Etherscan Sepolia + copie), juridiction (drapeau via `country-flag-icons`), solde, part gelée, solde transférable.
- **Badge réseau** (`src/app/page.tsx`) : réseau (Sepolia) et dernier bloc indexé, pour prouver que les données ne sont pas figées.
- **Connexion wallet** (`src/components/wallet-chip.tsx`, via `wagmi`) : optionnelle, la lecture du registre ne la nécessite pas.

Tout est lu depuis l'API HTTP de l'indexeur (`src/lib/registry.ts`) et rafraîchi toutes les 5 secondes via React Query (`refetchInterval`), pas de WebSocket.

## Démarrage

```bash
pnpm install
pnpm dev
```

Interface sur `http://localhost:3000`. Par défaut elle interroge l'indexeur sur `http://localhost:42069` (voir `../backend/README.md` pour le lancer) — assure-toi qu'il tourne, sinon le tableau affiche une erreur de connexion.

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `NEXT_PUBLIC_REGISTRY_API_URL` | URL de base de l'API de l'indexeur | `http://localhost:42069` |

À définir en production (déploiement Vercel) pour pointer vers l'indexeur déployé (Railway).

## Stack

- Next.js 16 (App Router), React 19, TypeScript strict
- Tailwind CSS 4 pour le style, `next/font` (Geist + Fraunces) pour la typographie
- `@tanstack/react-query` pour le fetch/cache/polling de l'API
- `wagmi` + `viem` pour la connexion wallet (Sepolia / mainnet, connecteur `injected` uniquement)

## Scripts

```bash
pnpm dev      # serveur de dev
pnpm build    # build de prod (type-check les routes App Router au passage)
pnpm start    # sert le build de prod
pnpm lint     # eslint
```

Le CI (`../.github/workflows/ci.yml`) lance `pnpm build` puis `pnpm exec tsc --noEmit` — dans cet ordre, car des types comme `LayoutProps<"/">` (routes typées) ne sont générés par Next.js que pendant le build.

## Déploiement

Vercel, projet lié via `.vercel/project.json`. Le déploiement est indépendant de celui du backend (Railway) ; seule la variable `NEXT_PUBLIC_REGISTRY_API_URL` les relie.

## Note

`frontend/AGENTS.md` (importé par `CLAUDE.md`) est régénéré automatiquement par `next dev` — ne pas le modifier à la main, il documente les éventuelles ruptures d'API de la version de Next.js installée.
