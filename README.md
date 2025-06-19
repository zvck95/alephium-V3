# Explorateur Alephium

## Vue d'ensemble
L'Explorateur Alephium est une interface web interactive permettant d'explorer et de visualiser la blockchain Alephium en temps réel. Il utilise le SDK officiel Alephium (@alephium/web3) pour interagir avec le réseau mainnet.

## Architecture

### Composants Principaux
- **BlockchainExplorer** : Composant racine gérant l'état global
- **BlockList** : Affiche la liste des blocs récents
- **BlockDetails** : Montre les détails d'un bloc spécifique
- **BlockchainGraph** : Visualisation graphique des blocs avec D3.js

### Services API
Le fichier `src/services/api.js` contient toutes les interactions avec l'API Alephium :

#### Fonctions Principales
1. **getLatestBlocks(count = 50)**
   - Récupère les derniers blocs de tous les groupes
   - Gère automatiquement le cache des blocs
   - Retourne les blocs triés par timestamp

2. **getBlockByHash(hash)**
   - Récupère les détails d'un bloc spécifique
   - Transforme les données en format standardisé

3. **checkForNewBlocks(lastKnownHeight, callback)**
   - Surveille les nouveaux blocs
   - Notifie via callback lors de nouveaux blocs
   - Maintient le cache à jour

4. **getBlockTransactions(hash)**
   - Récupère les transactions d'un bloc spécifique

5. **getNetworkInfo()**
   - Obtient les informations du réseau Alephium

### Gestion des Erreurs
- Système de retry avec backoff exponentiel
- Logging détaillé des erreurs
- Validation des données

### Cache
- Limite de 1000 blocs en cache
- Gestion automatique du nettoyage
- Évite les requêtes redondantes

## Configuration

### Prérequis
- Node.js >= 14.0.0
- npm >= 6.0.0

### Installation
```bash
npm install
```

### Développement
```bash
npm run dev
```

### Production
```bash
npm run build
npm run preview
```

### WebSocket temps réel
La fonction `connectWebSocket` permet de recevoir automatiquement les nouveaux blocs via WebSocket (chemin `/events`).
```javascript
import { connectWebSocket } from './src/services/websocket'

connectWebSocket((block) => {
  console.log('Nouveau bloc', block)
})
```

### Graphique des blocs
La vue `BlockchainGraph` affiche maintenant clairement les liens entre parents et dépendances. Les flèches bleues représentent la relation parent → enfant. Les traits pointillés gris ou orange mettent en valeur les dépendances croisées ou sur la même chaîne.

## API Alephium

### Configuration
```javascript
const NODE_URL = 'https://node.mainnet.alephium.org';
```

### Structure des Données

#### Block
```typescript
interface Block {
  hash: string;
  height: number;
  timestamp: number;
  chainFrom: number;
  chainTo: number;
  transactions: Transaction[];
  nonce: string;
  version: number;
  parentBlockHash: string[];
  blockDeps: string[];
}
```

## Bonnes Pratiques
1. Toujours utiliser le système de retry pour les appels API
2. Maintenir le cache des blocs pour optimiser les performances
3. Gérer les erreurs de manière appropriée
4. Utiliser le logging pour le debugging

## Roadmap
- [ ] Amélioration de la visualisation des transactions
- [x] Support des websockets pour les mises à jour en temps réel
- [ ] Ajout de filtres avancés pour la recherche de blocs
- [ ] Optimisation des performances du cache
