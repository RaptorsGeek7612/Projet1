# Contribuer

## Structure

Le repo contient deux projets pnpm indépendants, chacun avec son propre workspace, ses dépendances et son déploiement :

- `backend/` — indexeur Ponder + API ([`backend/README.md`](backend/README.md))
- `frontend/` — dashboard Next.js ([`frontend/README.md`](frontend/README.md))

Il n'y a pas de `package.json` racine : installe et lance les commandes depuis le sous-dossier concerné.

## Avant de commencer

```bash
cd backend && pnpm install && cp .env.local.example .env.local   # renseigner RPC, adresses, START_BLOCK
cd ../frontend && pnpm install
```

Détails (variables d'environnement, limites connues, pièges déjà rencontrés) dans les README de chaque dossier — à lire avant de modifier le code correspondant, ils documentent des comportements non évidents (ex. le token démarre en pause, le pays est un `uint16` ISO, `LayoutProps` généré au build...).

## Avant d'ouvrir une PR

Le CI (`.github/workflows/ci.yml`) tourne sur chaque push/PR vers `main` et doit passer :

```bash
# backend
cd backend
pnpm run typecheck
pnpm run compile:contracts
pnpm run test
pnpm run test:contracts

# frontend
cd frontend
pnpm build            # type-check les routes App Router au passage
pnpm exec tsc --noEmit
```

Si tu touches aux contrats Solidity, lance le skill `solidity-security-audit` avant de proposer la PR.

## Commits

Messages en français, à l'impératif, qui expliquent le *pourquoi* plutôt que de décrire le diff (ex. `Corrige la propagation du pays lors d'une récupération de portefeuille`, pas `Fix bug`). Un commit = un changement logique.

## Style

- TypeScript strict partout, pas de `any` non justifié.
- Pas de commentaire qui répète ce que le code dit déjà — seulement pour une contrainte cachée, un piège, ou un choix non évident (le code existant en est plein d'exemples).
- Ne pas inventer de donnée que l'indexeur ne peut pas produire honnêtement (voir « Une limite structurelle à connaître » dans `backend/README.md`) : mieux vaut documenter une limite que simuler un chiffre faux.

## Déploiement

`main` déploie automatiquement : backend sur Railway, frontend sur Vercel. Un push cassé sur `main` casse donc la prod — vérifie le CI localement avant de pousser sur cette branche pour un changement non trivial.
