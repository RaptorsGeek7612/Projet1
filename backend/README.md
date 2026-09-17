# T-REX Registry Indexer

Indexeur Ponder qui reconstruit le **registre des porteurs** d'un token ERC-3643 et l'expose en HTTP.

## Ce que ça produit

Pas un explorateur d'événements. Les vues qu'un émetteur demande réellement :

| Route | Question à laquelle elle répond |
|---|---|
| `GET /registry` | Qui détient quoi, combien est gelé, combien est transférable |
| `GET /registry/by-country` | Combien de porteurs par juridiction |
| `GET /registry/anomalies` | Qui détient du solde sans identité enregistrée |
| `GET /holder/:address` | Fiche complète d'un porteur, mouvements et actions d'agent |
| `GET /audit/agent-actions` | Piste d'audit des gels, dégels et récupérations |
| `GET /stats` | Encours, nombre de porteurs, état de pause |

Ponder génère par ailleurs une API GraphQL et SQL automatique. Ces routes existent parce qu'un opérationnel ne veut pas écrire de requête — il veut une URL.

## Une limite structurelle à connaître

**Un transfert refusé n'émet aucun événement.** Il `revert`, donc rien n'est écrit dans les logs. Aucun indexeur ne peut donc produire un rapport des refus de conformité à partir de la chaîne seule.

Les trois façons d'obtenir cette donnée, par ordre de coût :

1. Simuler `canTransfer()` en amont depuis le front, et journaliser le résultat côté application
2. Ajouter un événement dans tes propres modules de conformité, sur le chemin `transferred()` plutôt que sur le check
3. Rejouer les transactions échouées via `debug_traceTransaction` — coûteux et rarement disponible sur un RPC gratuit

Ce projet fait le choix (1) implicitement : il n'invente pas de donnée qu'il n'a pas. Savoir dire ce qu'un indexeur ne peut pas produire vaut mieux que livrer un chiffre faux.

## Principe de reconstruction

Les soldes ne sont **jamais lus on-chain**. Ils sont dérivés de la somme des `Transfer`. Un appel RPC par événement rendrait l'indexation lente et coûteuse pour un résultat identique.

Le compteur de porteurs suit la même règle que le module de conformité correspondant : un porteur naît quand son solde passe de zéro à non nul, et disparaît à l'inverse. **Si l'indexeur et le contrat divergent sur ce nombre, c'est l'indexeur qui a tort** — et c'est exactement ce qu'un test de réconciliation doit détecter.

## Démarrage

```bash
npm install
cp .env.local.example .env.local   # remplir RPC, adresses, START_BLOCK
npm run dev
```

L'interface est sur `http://localhost:42069`. En développement, Ponder utilise SQLite ; renseigner `DATABASE_URL` bascule sur Postgres.

> `START_BLOCK` doit être le bloc de déploiement du token. Laisser 0 épuise le quota d'un RPC gratuit avant d'atteindre le premier `mint`.

## Déploiement de test sur Sepolia

Une suite T-REX minimale (registres + token, sans claim topic ni module de conformité) a été déployée pour valider les handlers contre de vrais événements :

| Contrat | Adresse |
|---|---|
| Token (RPD) | `0x2C75bB41c4B90Da410D39D7413304922Ddb497D9` |
| IdentityRegistry | `0xafe7308c10F26C6cC5e0d83938dc10D421704c23` |

- Bloc de déploiement (`START_BLOCK`) : `11722735`
- Réseau : Sepolia (chain id `11155111`)
- Deux porteurs réels : un premier avec 900 RPD (France, `250`), un second avec 100 RPD dont 20 gelés partiellement (États-Unis, `840`)

Les sources T-REX + ONCHAINID sont vendorisées dans `src/contracts/` (compilées en solc `0.8.35` via Hardhat) et le déploiement se refait avec :

```bash
npm run compile:contracts
npm run deploy:sepolia   # lit SEPOLIA_RPC_URL et DEPLOYER_PRIVATE_KEY depuis .env (pas .env.local)
```

`scripts/deploy.ts` déploie la suite complète depuis zéro ; `scripts/finish-deploy.ts` a servi à reprendre après le pause-by-default du token (voir « Points d'attention »).

## Points d'attention

**Le pays est un `uint16` ISO 3166-1 numérique**, pas un code alpha-2. La France est `250`, pas `"FR"`. C'est une confusion fréquente au moment de configurer un module de restriction par pays. La table de correspondance est dans `src/countries.ts`, partielle et orientée UE — complète-la selon tes juridictions.

**Les ABIs sont réduites aux événements indexés** et écrites à la main dans `abis/trex.ts`. Vérifie chaque signature contre la version du token que tu indexes : un paramètre `indexed` en trop et l'événement n'est jamais capté, silencieusement, sans erreur.

**Une radiation d'identité ne supprime pas la ligne du porteur.** Un investisseur retiré du registre d'identités peut conserver un solde. C'est légitime et c'est précisément l'anomalie que `/registry/anomalies` fait remonter.

**`registerIdentity()` n'émet aucun événement portant le pays.** Le contrat écrit `_country` dans l'`IdentityRegistryStorage` mais seul `IdentityRegistered(address,identity)` sort — pas de `CountryUpdated`. Le handler décode donc le calldata de la transaction (`registerIdentity`/`batchRegisterIdentity`) pour le récupérer. Sans ça, tout porteur fraîchement enregistré ressortirait à tort dans `holdersWithoutCountry`.

**Le token T-REX démarre en pause.** `mint()` passe (pas de garde `whenNotPaused`), mais `transfer()` est bloqué jusqu'à un `unpause()` explicite par un agent. `scripts/deploy.ts` le fait automatiquement après le mint initial.

## État

- Typecheck **vert**, `ponder codegen` validé contre Ponder 0.11.44
- **Validé contre un déploiement réel** sur Sepolia (voir « Déploiement de test sur Sepolia ») : les handlers ont tourné contre de vrais `Transfer`, `IdentityRegistered`, `TokensFrozen`
- Les agrégats par pays sont maintenus au fil de l'eau ; sur un registre chargé, un job de recalcul périodique serait plus sûr qu'une accumulation de deltas

## Suites possibles

1. Test de réconciliation : comparer `holderCount` indexé et `balanceOf` on-chain sur un échantillon
2. Export CSV du registre, format attendu par un teneur de compte
3. Indexation de plusieurs tokens en parallèle, une ligne `tokenState` par émission
4. Instantané daté du registre à une date donnée, pour les distributions de dividendes

## Licence

MIT.
