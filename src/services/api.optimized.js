import { NodeProvider, web3, TOTAL_NUMBER_OF_GROUPS } from '@alephium/web3';

// Configuration
const NODE_URL = 'https://node.mainnet.alephium.org';
const BACKUP_NODES = [
  'https://node.mainnet.alephium.org',
  'https://backend.mainnet.alephium.org',
  'https://alephium-node-1.example.com',
  'https://alephium-node-2.example.com'
];

// Cache configuration
const MAX_KNOWN_BLOCKS = 2000; // Augmenté pour couvrir plus de blocs
const CACHE_EXPIRY_TIME = 15 * 60 * 1000; // 15 minutes
const BATCH_SIZE = 5; // Nombre de requêtes parallèles par groupe
const REQUEST_DELAY = 100; // Délai entre les requêtes en ms

// Classe de gestion du cache
class BlockCache {
  constructor() {
    this.blocks = new Map();
    this.heightIndex = new Map(); // Index par hauteur pour une recherche plus rapide
    this.lastCleanup = Date.now();
    this.hitCount = 0;
    this.missCount = 0;
  }

  add(hash, block) {
    const cacheEntry = {
      data: block,
      timestamp: Date.now(),
      lastAccessed: Date.now()
    };
    
    this.blocks.set(hash, cacheEntry);
    
    // Mise à jour de l'index par hauteur
    if (block && block.height !== undefined) {
      this.heightIndex.set(block.height, hash);
    }
    
    this.cleanup();
    return cacheEntry;
  }

  get(hash) {
    const entry = this.blocks.get(hash);
    if (!entry) {
      this.missCount++;
      return null;
    }
    
    if (Date.now() - entry.timestamp > CACHE_EXPIRY_TIME) {
      this.blocks.delete(hash);
      if (entry.data && entry.data.height !== undefined) {
        this.heightIndex.delete(entry.data.height);
      }
      this.missCount++;
      return null;
    }
    
    // Mettre à jour le dernier accès pour le LRU
    entry.lastAccessed = Date.now();
    this.hitCount++;
    
    return entry.data;
  }
  
  getByHeight(height) {
    const hash = this.heightIndex.get(height);
    return hash ? this.get(hash) : null;
  }
  
  getHitRate() {
    const total = this.hitCount + this.missCount;
    return total > 0 ? (this.hitCount / total) * 100 : 0;
  }

  cleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < 60000) return; // Max une fois par minute
    
    // Nettoyer les entrées expirées
    for (const [hash, entry] of this.blocks.entries()) {
      if (now - entry.timestamp > CACHE_EXPIRY_TIME) {
        if (entry.data && entry.data.height !== undefined) {
          this.heightIndex.delete(entry.data.height);
        }
        this.blocks.delete(hash);
      }
    }
    
    // Limiter la taille du cache (stratégie LRU)
    if (this.blocks.size > MAX_KNOWN_BLOCKS) {
      const entries = Array.from(this.blocks.entries())
        .map(([hash, entry]) => ({
          hash,
          lastAccessed: entry.lastAccessed,
          timestamp: entry.timestamp
        }))
        .sort((a, b) => a.lastAccessed - b.lastAccessed);
      
      // Supprimer les entrées les moins récemment utilisées
      const entriesToRemove = entries.slice(0, this.blocks.size - MAX_KNOWN_BLOCKS);
      entriesToRemove.forEach(({ hash }) => {
        const entry = this.blocks.get(hash);
        if (entry && entry.data && entry.data.height !== undefined) {
          this.heightIndex.delete(entry.data.height);
        }
        this.blocks.delete(hash);
      });
      
      console.log(`Cache cleanup: Removed ${entriesToRemove.length} old entries`);
    }
    
    this.lastCleanup = now;
    
    // Journalisation des statistiques du cache (toutes les 10 minutes)
    if (now % (10 * 60 * 1000) < 60000) {
      console.log(`Cache stats: ${this.blocks.size} blocks, Hit rate: ${this.getHitRate().toFixed(2)}%`);
    }
  }
}

// Instance du cache
const blockCache = new BlockCache();

// Classe de gestion des noeuds
class NodeManager {
  constructor(nodes) {
    this.nodes = nodes;
    this.currentNodeIndex = 0;
    this.providers = nodes.map(url => new NodeProvider(url));
  }

  getCurrentProvider() {
    return this.providers[this.currentNodeIndex];
  }

  rotateNode() {
    this.currentNodeIndex = (this.currentNodeIndex + 1) % this.nodes.length;
    web3.setCurrentNodeProvider(this.nodes[this.currentNodeIndex]);
    return this.getCurrentProvider();
  }

  async executeWithFailover(operation) {
    for (let i = 0; i < this.nodes.length; i++) {
      try {
        return await operation(this.getCurrentProvider());
      } catch (error) {
        console.warn(`Node ${this.nodes[this.currentNodeIndex]} failed:`, error);
        this.rotateNode();
        if (i === this.nodes.length - 1) throw error;
      }
    }
  }
}

// Instance du gestionnaire de noeuds
const nodeManager = new NodeManager(BACKUP_NODES);

// Système de retry amélioré avec backoff exponentiel et jitter
const retryWithBackoff = async (fn, { 
  maxRetries = 3, 
  baseDelay = 1000, 
  maxDelay = 10000,
  retryOn429 = true,
  operationName = 'operation'
} = {}) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await fn();
      
      // Réinitialiser le compteur d'erreurs en cas de succès
      if (i > 0) {
        console.log(`Retry successful after ${i} attempts for ${operationName}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Ne pas réessayer pour certaines erreurs
      if (error.status === 404 || (error.status === 400 && !retryOn429)) {
        console.warn(`Non-retryable error (${error.status}) in ${operationName}:`, error.message);
        break;
      }
      
      if (i === maxRetries - 1) {
        console.error(`All ${maxRetries} attempts failed for ${operationName}:`, error);
        break;
      }
      
      const delay = Math.min(Math.pow(2, i) * baseDelay, maxDelay);
      const jitter = Math.random() * 500; // Augmentation du jitter
      const waitTime = delay + jitter;
      
      console.warn(`Attempt ${i + 1}/${maxRetries} failed for ${operationName}. Retrying in ${waitTime.toFixed(0)}ms...`, error.message);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};

// Fonction utilitaire pour transformer un bloc
const transformBlock = (block) => ({
  hash: block.hash,
  height: block.height,
  timestamp: block.timestamp,
  chainFrom: parseInt(block.chainFrom) || 0,
  chainTo: parseInt(block.chainTo) || 0,
  transactions: block.transactions || [],
  nonce: block.nonce,
  version: block.version,
  parentBlockHash: block.deps ? [block.deps[0]] : [],
  blockDeps: block.deps || []
});

// Fonction pour récupérer les blocs par groupe avec gestion du taux de requêtes
const fetchBlocksByGroup = async (fromGroup, toGroup, count) => {
  const blocks = [];
  
  try {
    const chainInfo = await nodeManager.executeWithFailover(provider =>
      retryWithBackoff(
        () => provider.blockflow.getBlockflowChainInfo({ fromGroup, toGroup }),
        { operationName: `getBlockflowChainInfo(${fromGroup},${toGroup})` }
      )
    );
    
    if (!chainInfo?.currentHeight) return [];
    
    // Récupérer les hauteurs les plus récentes
    const heights = Array.from(
      { length: Math.min(count, chainInfo.currentHeight) },
      (_, i) => chainInfo.currentHeight - i
    );
    
    // Traiter par lots pour éviter la surcharge
    for (let i = 0; i < heights.length; i += BATCH_SIZE) {
      const batch = heights.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (height) => {
        try {
          // Vérifier d'abord le cache
          const cachedBlock = blockCache.getByHeight(height);
          if (cachedBlock) {
            blocks.push(cachedBlock);
            return;
          }
          
          // Sinon, récupérer depuis l'API
          const hashes = await nodeManager.executeWithFailover(provider =>
            retryWithBackoff(
              () => provider.blockflow.getBlockflowHashes({
                fromGroup,
                toGroup,
                height
              }),
              { operationName: `getBlockflowHashes(${height})` }
            )
          );
          
          if (hashes?.[0]) {
            const block = await nodeManager.executeWithFailover(provider =>
              retryWithBackoff(
                () => provider.blockflow.getBlockflowBlocksBlockHash(hashes[0]),
                { operationName: `getBlockByHash(${hashes[0].substring(0, 8)}...)` }
              )
            );
            
            if (block) {
              const transformedBlock = transformBlock(block);
              blockCache.add(hashes[0], transformedBlock);
              blocks.push(transformedBlock);
            }
          }
          
          // Délai entre les requêtes pour éviter le rate limiting
          if (i < heights.length - 1) {
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
          }
        } catch (error) {
          console.error(`Error fetching block at height ${height}:`, error);
        }
      }));
    }
  } catch (error) {
    console.error(`Error in fetchBlocksByGroup(${fromGroup}, ${toGroup}):`, error);
  }
  
  return blocks;
};

// API Functions
export const getLatestBlocks = async (count = 50) => {
  console.log('Fetching latest blocks');
  const allBlocks = [];
  
  try {
    // Récupérer les blocs de tous les groupes en parallèle
    const groupPromises = [];
    
    for (let fromGroup = 0; fromGroup < TOTAL_NUMBER_OF_GROUPS; fromGroup++) {
      for (let toGroup = 0; toGroup < TOTAL_NUMBER_OF_GROUPS; toGroup++) {
        // Limiter le nombre de requêtes parallèles
        if (groupPromises.length >= BATCH_SIZE) {
          const completed = await Promise.race(
            groupPromises.map((p, i) => p.then(() => i))
          );
          groupPromises.splice(completed, 1);
        }
        
        const promise = fetchBlocksByGroup(fromGroup, toGroup, count)
          .then(blocks => {
            allBlocks.push(...blocks);
            return null;
          })
          .catch(error => {
            console.error(`Error in group ${fromGroup}-${toGroup}:`, error);
            return null;
          });
        
        groupPromises.push(promise);
      }
    }
    
    // Attendre la fin de toutes les requêtes
    await Promise.all(groupPromises);
    
    // Trier par timestamp et limiter le nombre de résultats
    const uniqueBlocks = Array.from(new Map(allBlocks.map(b => b && b.hash ? [b.hash, b] : []).filter(([k]) => k)).values());
    const sortedBlocks = uniqueBlocks
      .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0))
      .slice(0, count);
    
    console.log(`Fetched ${sortedBlocks.length} unique blocks`);
    return sortedBlocks;
  } catch (error) {
    console.error('Error in getLatestBlocks:', error);
    
    // En cas d'erreur, essayer de retourner les blocs en cache si disponibles
    if (allBlocks && allBlocks.length > 0) {
      console.warn('Returning partial results from cache due to error');
      const uniqueBlocks = Array.from(new Map(allBlocks.map(b => b && b.hash ? [b.hash, b] : []).filter(([k]) => k)).values());
      return uniqueBlocks
        .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0))
        .slice(0, count);
    }
    
    throw new Error(`Failed to fetch blocks: ${error.message}`);
  }
};

/**
 * Récupère un bloc par son hash
 * @param {string} hash - Le hash du bloc à récupérer
 * @returns {Promise<Object|null>} Le bloc demandé ou null si non trouvé
 */
export const getBlockByHash = async (hash) => {
  if (!hash) {
    console.error('getBlockByHash called with empty hash');
    return null;
  }
  
  try {
    // Vérifier d'abord le cache
    const cachedBlock = blockCache.get(hash);
    if (cachedBlock) {
      console.log(`Cache hit for block ${hash.substring(0, 8)}...`);
      return cachedBlock;
    }
    
    console.log(`Fetching block ${hash.substring(0, 8)}...`);
    
    // Récupérer depuis l'API avec retry
    let block;
    try {
      block = await nodeManager.executeWithFailover(provider =>
        retryWithBackoff(
          () => provider.blockflow.getBlockflowBlocksBlockHash(hash),
          { 
            operationName: `getBlockByHash(${hash.substring(0, 8)}...)`,
            retryOn429: true,
            maxRetries: 5
          }
        )
      );
    } catch (error) {
      console.error(`Failed to fetch block ${hash.substring(0, 8)}:`, error);
      throw error;
    }
    
    if (!block) {
      console.warn(`Block not found: ${hash}`);
      return null;
    }
    
    // Mettre en cache et retourner
    const transformedBlock = transformBlock(block);
    blockCache.add(hash, transformedBlock);
    
    return transformedBlock;
  } catch (error) {
    console.error('Error in getBlockByHash:', error);
    
    // Essayer de retourner une version partielle si disponible
    const cachedPartial = blockCache.get(hash);
    if (cachedPartial) {
      console.warn('Using cached partial block due to error');
      return cachedPartial;
    }
    
    throw new Error(`Failed to fetch block: ${error.message}`);
  }
};

/**
 * Vérifie les nouveaux blocs depuis la dernière hauteur connue
 * @param {number} lastKnownHeight - Dernière hauteur connue
 * @param {Function} [callback] - Fonction de rappel appelée avec les nouveaux blocs
 * @returns {Promise<Array>} Liste des nouveaux blocs
 */
export const checkForNewBlocks = async (lastKnownHeight, callback) => {
  if (typeof lastKnownHeight !== 'number' || lastKnownHeight < 0) {
    console.error('Invalid lastKnownHeight:', lastKnownHeight);
    return [];
  }
  
  try {
    const newBlocks = [];
    const batchSize = 2; // Limite les appels parallèles
    
    // Créer des groupes de travail pour limiter le parallélisme
    const groups = [];
    for (let fromGroup = 0; fromGroup < TOTAL_NUMBER_OF_GROUPS; fromGroup++) {
      for (let toGroup = 0; toGroup < TOTAL_NUMBER_OF_GROUPS; toGroup++) {
        groups.push({ fromGroup, toGroup });
      }
    }
    
    // Traiter les groupes par lots
    for (let i = 0; i < groups.length; i += batchSize) {
      const batch = groups.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async ({ fromGroup, toGroup }) => {
        try {
          // Récupérer les infos de la chaîne avec gestion d'erreur
          const [chainInfo, versionInfo] = await Promise.all([
            nodeManager.executeWithFailover(provider =>
              retryWithBackoff(
                () => provider.infos.getInfosGetChainInfo(),
                { operationName: 'getChainInfo' }
              )
            ).catch(() => null),
            
            nodeManager.executeWithFailover(provider =>
              retryWithBackoff(
                () => provider.infos.getInfosGetVersion(),
                { operationName: 'getVersionInfo', maxRetries: 2 }
              )
            ).catch(() => null)
          ]);
          
          const currentHeight = chainInfo?.currentHeight || 0;
          const nodeVersion = versionInfo?.version || 'unknown';
          
          // Calculer le temps moyen entre les blocs (approximatif)
          let averageBlockTime = 64000; // Valeur par défaut (64 secondes)
          if (currentHeight > 10) {
            try {
              const recentBlocks = [];
              for (let i = 1; i <= 10; i++) {
                const block = await getBlockByHash(
                  await nodeManager.executeWithFailover(provider =>
                    provider.blockflow.getBlockflowHashes({
                      fromGroup: 0,
                      toGroup: 0,
                      height: currentHeight - i
                    })
                  )
                );
                if (block?.timestamp) {
                  recentBlocks.push(block);
                }
              }
              
              if (recentBlocks.length > 1) {
                const timeDiff = recentBlocks[0].timestamp - recentBlocks[recentBlocks.length - 1].timestamp;
                averageBlockTime = Math.floor(timeDiff / (recentBlocks.length - 1));
              }
            } catch (e) {
              console.error('Error calculating average block time:', e);
            }
          }
          
          // Récupérer les hauteurs des nouveaux blocs
          const heights = [];
          for (let h = lastKnownHeight + 1; h <= currentHeight; h++) {
            heights.push(h);
          }
          
          // Traiter les hauteurs par lots
          for (let i = 0; i < heights.length; i += BATCH_SIZE) {
            const batchHeights = heights.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batchHeights.map(async (height) => {
              try {
                const hashes = await nodeManager.executeWithFailover(provider =>
                  retryWithBackoff(
                    () => provider.blockflow.getBlockflowHashes({
                      fromGroup,
                      toGroup,
                      height
                    }),
                    { operationName: `getHashes(${height})` }
                  )
                );
                
                if (!hashes?.[0]) return;
                
                // Vérifier le cache d'abord
                const cachedBlock = blockCache.get(hashes[0]);
                if (cachedBlock) {
                  newBlocks.push(cachedBlock);
                  return;
                }
                
                // Récupérer le bloc depuis l'API
                const block = await nodeManager.executeWithFailover(provider =>
                  retryWithBackoff(
                    () => provider.blockflow.getBlockflowBlocksBlockHash(hashes[0]),
                    { 
                      operationName: `getBlock(${hashes[0].substring(0, 8)}...)`,
                      maxRetries: 3
                    }
                  )
                );
                
                if (block) {
                  const transformedBlock = transformBlock(block);
                  blockCache.add(block.hash, transformedBlock);
                  newBlocks.push(transformedBlock);
                }
                
                // Délai entre les requêtes
                if (i < heights.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
                }
              } catch (error) {
                console.error(`Error processing block at height ${height}:`, error);
              }
            }));
          }
        } catch (error) {
          console.error(`Error checking new blocks for chain ${fromGroup}->${toGroup}:`, error);
        }
      }));
      
      // Délai entre les lots pour éviter la surcharge
      if (i + batchSize < groups.length) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY * 2));
      }
    }
    
    // Trier les blocs par hauteur et supprimer les doublons
    const uniqueBlocks = Array.from(new Map(newBlocks.map(b => [b.hash, b])).values())
      .sort((a, b) => a.height - b.height);
    
    // Appeler le callback si des nouveaux blocs sont trouvés
    if (uniqueBlocks.length > 0 && typeof callback === 'function') {
      try {
        callback(uniqueBlocks);
      } catch (callbackError) {
        console.error('Error in checkForNewBlocks callback:', callbackError);
      }
    }
    
    return uniqueBlocks;
  } catch (error) {
    console.error('Error checking for new blocks:', error);
    // En cas d'erreur, retourner un tableau vide pour éviter de casser le flux
    return [];
  }
};

/**
 * Récupère les transactions d'un bloc
 * @param {string} hash - Le hash du bloc
 * @returns {Promise<Array>} Liste des transactions
 */
export const getBlockTransactions = async (hash) => {
  if (!hash) {
    console.error('getBlockTransactions called with empty hash');
    return [];
  }
  
  try {
    const block = await getBlockByHash(hash);
    if (!block) {
      console.warn(`Block not found: ${hash}`);
      return [];
    }
    
    // Vérifier si les transactions sont déjà dans le bloc
    if (Array.isArray(block.transactions)) {
      return block.transactions;
    }
    
    // Si pas de transactions dans le bloc, essayer de les récupérer séparément
    try {
      const txData = await nodeManager.executeWithFailover(provider =>
        retryWithBackoff(
          () => provider.blockflow.getBlockflowBlockAndEventsBlockHash(hash),
          { operationName: `getBlockTxs(${hash.substring(0, 8)}...)` }
        )
      );
      
      return txData.events || [];
    } catch (txError) {
      console.error(`Error fetching transactions for block ${hash}:`, txError);
      return [];
    }
  } catch (error) {
    console.error(`Error in getBlockTransactions for block ${hash}:`, error);
    // Ne pas propager l'erreur pour éviter de casser l'interface utilisateur
    return [];
  }
};

/**
 * Récupère les informations sur le réseau
 * @returns {Promise<Object>} Informations sur le réseau
 */
export const getNetworkInfo = async () => {
  const defaultInfo = {
    currentHeight: 0,
    averageBlockTime: 0,
    nodeVersion: 'unknown',
    network: 'mainnet',
    timestamp: Date.now()
  };
  
  try {
    const [chainInfo, versionInfo] = await Promise.all([
      nodeManager.executeWithFailover(provider =>
        retryWithBackoff(
          () => provider.infos.getInfosGetChainInfo(),
          { operationName: 'getChainInfo' }
        )
      ).catch(() => null),
      
      nodeManager.executeWithFailover(provider =>
        retryWithBackoff(
          () => provider.infos.getInfosGetVersion(),
          { operationName: 'getVersionInfo', maxRetries: 2 }
        )
      ).catch(() => null)
    ]);
    
    const currentHeight = chainInfo?.currentHeight || 0;
    const nodeVersion = versionInfo?.version || 'unknown';
    
    // Calculer le temps moyen entre les blocs (approximatif)
    let averageBlockTime = 64000; // Valeur par défaut (64 secondes)
    if (currentHeight > 10) {
      try {
        const recentBlocks = [];
        for (let i = 1; i <= 10; i++) {
          const block = await getBlockByHash(
            await nodeManager.executeWithFailover(provider =>
              provider.blockflow.getBlockflowHashes({
                fromGroup: 0,
                toGroup: 0,
                height: currentHeight - i
              })
            )
          );
          if (block?.timestamp) {
            recentBlocks.push(block);
          }
        }
        
        if (recentBlocks.length > 1) {
          const timeDiff = recentBlocks[0].timestamp - recentBlocks[recentBlocks.length - 1].timestamp;
          averageBlockTime = Math.floor(timeDiff / (recentBlocks.length - 1));
        }
      } catch (e) {
        console.error('Error calculating average block time:', e);
      }
    }
    
    return {
      currentHeight,
      averageBlockTime,
      nodeVersion,
      network: 'mainnet',
      timestamp: Date.now(),
      ...(chainInfo || {})
    };
  } catch (error) {
    console.error('Error fetching network info:', error);
    // Retourner les valeurs par défaut en cas d'erreur
    return defaultInfo;
  }
};