# Guide utilisateur — Registre des Porteurs

Ce guide s'adresse à toute personne qui **utilise** l'interface (agent de conformité, opérationnel, investisseur), pas à quelqu'un qui développe le projet. Pour la documentation technique, voir `backend/README.md`.

## 1. À quoi sert cette interface

Le Registre des Porteurs affiche, en temps quasi réel, qui détient un token conforme ERC-3643 (T-REX) : combien chaque porteur possède, combien est gelé, dans quelle juridiction il est déclaré, et si le token est globalement actif ou en pause.

Toutes les données viennent directement de la blockchain (Sepolia, un réseau de test) — rien n'est saisi à la main, rien n'est estimé.

## 2. Ouvrir l'interface

Rendez-vous sur l'URL fournie par votre équipe technique (en local pendant le développement : `http://localhost:3000`). Aucune installation n'est nécessaire ; un navigateur suffit.

## 3. Le tableau de bord

En haut de l'écran, quatre tuiles résument l'état du token :

| Tuile | Signification |
|---|---|
| **Encours total** | Le nombre total de tokens en circulation (mintés moins brûlés) |
| **Porteurs** | Le nombre d'adresses détenant actuellement un solde non nul |
| **Gels partiels** | Le nombre de porteurs ayant une partie de leur solde bloquée au transfert (voir §5) |
| **Statut du token** | *Actif* (transferts autorisés) ou *En pause* (tous les transferts bloqués, décision globale d'un agent) |

Un badge en haut à droite indique le réseau (« Sepolia ») et le dernier bloc traité par l'indexeur — c'est la preuve que les données sont à jour, pas figées.

## 4. Le tableau des porteurs

Chaque ligne représente une adresse détenant un solde :

- **Porteur** : l'adresse, tronquée. Cliquez sur le lien pour l'ouvrir sur Etherscan (l'explorateur de blocs) ; le bouton ⧉ à côté copie l'adresse complète dans le presse-papiers.
- **Juridiction** : le drapeau du pays déclaré pour ce porteur lors de son enregistrement. Un porteur sans pays connu affiche un avertissement — ce n'est pas normal, à signaler.
- **Solde** : la quantité totale détenue, gel compris.
- **Gelé** : la part du solde bloquée par un agent (freezing partiel). Un tiret signifie qu'aucun montant n'est gelé.
- **Transférable** : ce que le porteur peut réellement envoyer maintenant (solde moins la part gelée). C'est toujours ce chiffre-là qui compte pour savoir ce qu'un porteur peut faire, pas le solde brut.

Le tableau se rafraîchit automatiquement toutes les 5 secondes — pas besoin de recharger la page.

## 5. Comprendre les gels

Deux mécanismes distincts existent sur ce type de token, à ne pas confondre :

- **Gel total d'une adresse** : un agent bloque tous les mouvements d'un porteur, quel que soit le montant. Rare, généralement lié à une procédure (fraude suspectée, ordre judiciaire).
- **Gel partiel** (celui affiché dans le tableau) : un agent verrouille un montant précis, le reste restant transférable normalement. C'est la situation la plus courante — par exemple, une partie des tokens d'un porteur bloquée en garantie d'une opération en cours.

## 6. Connecter un wallet

Le bouton en haut à droite permet de connecter un wallet (MetaMask ou équivalent installé dans le navigateur). Ce n'est **pas nécessaire pour consulter le registre** — la lecture est publique. La connexion sert uniquement si votre rôle nécessite d'interagir avec le token directement depuis votre wallet (ce que cette interface ne fait pas encore automatiquement : elle affiche, elle n'envoie pas de transaction).

## 7. Questions fréquentes

**Le pays affiché me semble faux ou absent.**
Le pays est déclaré une fois, lors de l'enregistrement de l'identité du porteur, par un agent de conformité. S'il manque ou semble erroné, c'est une anomalie à corriger à la source (le registre d'identité), pas dans cette interface qui ne fait qu'afficher ce qui est enregistré on-chain.

**Un porteur a un solde mais aucune identité/pays.**
C'est une vraie anomalie possible : un investisseur peut avoir été radié du registre d'identités après coup tout en gardant son solde. C'est précisément le genre de situation que cette interface est conçue pour révéler, pas pour cacher.

**Les chiffres ne bougent pas immédiatement après une transaction.**
L'indexeur traite les blocs au fur et à mesure ; il y a un léger délai (quelques secondes à quelques dizaines de secondes selon la charge du réseau) entre une transaction confirmée sur la blockchain et son apparition ici. Le badge « bloc » en haut à droite indique jusqu'où l'indexeur est allé.

**J'ai besoin d'une donnée qui n'apparaît pas dans le tableau.**
L'indexeur expose aussi une API pour un usage technique : la fiche complète d'un porteur (mouvements, actions d'agent), la répartition par pays, l'audit des gels/dégels. Demandez à votre équipe technique l'accès à ces routes si le tableau ne suffit pas.
