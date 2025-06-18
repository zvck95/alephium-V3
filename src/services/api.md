# Documentation Technique des Services API

## Configuration Globale

```javascript
import { NodeProvider, web3, TOTAL_NUMBER_OF_GROUPS } from '@alephium/web3';

const NODE_URL = 'https://node.mainnet.alephium.org';
const nodeProvider = new NodeProvider(NODE_URL);
web3.setCurrentNodeProvider(NODE_URL);
```

## Système de Cache

### Configuration
```javascript
const MAX_KNOWN_BLOCKS = 1000;
let knownBlockHashes = new Set();
```

### Gestion du Cache
```javascript
const manageBlockCache = () => {
  if (knownBlockHashes.size > MAX_KNOWN_BLOCKS) {
    const oldestHashes = Array.from(knownBlockHashes)
      .slice(0, knownBlockHashes.size - MAX_KNOWN_BLOCKS);
    oldestHashes.forEach(hash => knownBlockHashes.delete(hash));
  }
};
```

## Système de Retry

```javascript
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
};
```

## API Endpoints

### 1. getLatestBlocks

**Description** : Récupère les derniers blocs de tous les groupes de la blockchain.

**Paramètres** :
- `count` (optional) : Nombre de blocs à retourner (défaut: 50)

**Retourne** :
```typescript
Array<{
  hash: string;
  height: number;
  timestamp: number;
  chainFrom: number;
  chainTo: number;
  transactions: Array<Transaction>;
  nonce: string;
  version: number;
  parentBlockHash: string[];
  blockDeps: string[];
}>
```

**Exemple d'utilisation** :
```javascript
const latestBlocks = await getLatestBlocks(10);
```

### 2. getBlockByHash

**Description** : Récupère les détails d'un bloc spécifique par son hash.

**Paramètres** :
- `hash` (required) : Hash du bloc à récupérer

**Retourne** :
```typescript
{
  hash: string;
  height: number;
  timestamp: number;
  chainFrom: number;
  chainTo: number;
  transactions: Array<Transaction>;
  nonce: string;
  version: number;
  parentBlockHash: string[];
  blockDeps: string[];
}
```

### 3. checkForNewBlocks

**Description** : Surveille les nouveaux blocs et notifie via callback.

**Paramètres** :
- `lastKnownHeight` (required) : Hauteur du dernier bloc connu
- `callback` (optional) : Fonction appelée avec les nouveaux blocs

**Retourne** : Array de nouveaux blocs

### 4. getBlockTransactions

**Description** : Récupère les transactions d'un bloc spécifique.

**Paramètres** :
- `hash` (required) : Hash du bloc

**Retourne** : Array de transactions

### 5. getNetworkInfo

**Description** : Obtient les informations du réseau Alephium.

**Retourne** : Informations sur l'état du réseau

## Gestion des Erreurs

Chaque fonction API implémente :
1. Logging détaillé des erreurs
2. Retry automatique avec backoff exponentiel
3. Validation des données reçues

## Bonnes Pratiques d'Utilisation

1. **Gestion du Cache** :
   ```javascript
   // Ajouter un bloc au cache
   knownBlockHashes.add(block.hash);
   manageBlockCache();
   ```

2. **Utilisation du Retry** :
   ```javascript
   const result = await retryWithBackoff(() => 
     nodeProvider.blockflow.getBlockflowBlocksBlockHash(hash)
   );
   ```

3. **Logging** :
   ```javascript
   console.error(`Error fetching block with hash ${hash}:`, error);
   ```

## Optimisations Futures

1. Implémentation de WebSocket pour les mises à jour en temps réel
2. Cache persistant avec IndexedDB
3. Pagination des résultats pour les grandes listes
4. Compression des données pour optimiser la bande passante 