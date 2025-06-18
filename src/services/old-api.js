import { NodeProvider, web3, TOTAL_NUMBER_OF_GROUPS } from '@alephium/web3';

// Configurer le fournisseur de nœuds Alephium avec l'URL correcte
const NODE_URL = 'https://node.mainnet.alephium.org';
const nodeProvider = new NodeProvider(NODE_URL);

// Définir le fournisseur de nœud global pour les fonctions utilitaires du SDK
web3.setCurrentNodeProvider(NODE_URL);

// Configuration du cache
const MAX_KNOWN_BLOCKS = 1000;

// Stocker les blocs déjà récupérés pour éviter les doublons
let knownBlockHashes = new Set();

// Fonction utilitaire pour gérer le cache des blocs
const manageBlockCache = () => {
  if (knownBlockHashes.size > MAX_KNOWN_BLOCKS) {
    const oldestHashes = Array.from(knownBlockHashes).slice(0, knownBlockHashes.size - MAX_KNOWN_BLOCKS);
    oldestHashes.forEach(hash => knownBlockHashes.delete(hash));
  }
};

// Fonction utilitaire pour les retries
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};

// Fonction pour récupérer les derniers blocs
export const getLatestBlocks = async (count = 50) => {
  try {
    console.log('Fetching blocks from API');
    
    // Obtenir les informations de la chaîne pour chaque groupe
    const blocks = [];
    for (let fromGroup = 0; fromGroup < TOTAL_NUMBER_OF_GROUPS; fromGroup++) {
      for (let toGroup = 0; toGroup < TOTAL_NUMBER_OF_GROUPS; toGroup++) {
        try {
          const chainInfo = await retryWithBackoff(() => 
            nodeProvider.blockflow.getBlockflowChainInfo({ fromGroup, toGroup })
          );
          
          // Récupérer les hashes des blocs pour la hauteur actuelle
          const hashes = await retryWithBackoff(() =>
            nodeProvider.blockflow.getBlockflowHashes({ 
              fromGroup, 
              toGroup, 
              height: chainInfo.currentHeight 
            })
          );
          
          // Récupérer les détails du bloc canonique
          if (hashes && hashes.length > 0) {
            const block = await retryWithBackoff(() =>
              nodeProvider.blockflow.getBlockflowBlocksBlockHash(hashes[0])
            );
            if (block) {
              blocks.push({
                hash: block.hash,
                height: block.height,
                timestamp: block.timestamp,
                chainFrom: fromGroup,
                chainTo: toGroup,
                transactions: block.transactions || [],
                nonce: block.nonce,
                version: block.version,
                parentBlockHash: block.deps ? [block.deps[0]] : [],
                blockDeps: block.deps || []
              });
              knownBlockHashes.add(block.hash);
              manageBlockCache();
            }
          }
        } catch (error) {
          console.error(`Error fetching blocks for chain ${fromGroup}->${toGroup}:`, error);
        }
      }
    }

    // Trier les blocs par timestamp (du plus récent au plus ancien)
    blocks.sort((a, b) => b.timestamp - a.timestamp);

    // Retourner seulement le nombre de blocs demandé
    return blocks.slice(0, count);
  } catch (error) {
    console.error('Error in getLatestBlocks:', error);
    throw new Error(`Failed to fetch blocks: ${error.message}`);
  }
};

// Fonction pour récupérer un bloc spécifique
export const getBlockByHash = async (hash) => {
  try {
    const block = await retryWithBackoff(() => 
      nodeProvider.blockflow.getBlockflowBlocksBlockHash(hash)
    );
    return {
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
    };
  } catch (error) {
    console.error(`Error fetching block with hash ${hash}:`, error);
    throw error;
  }
};

// Fonction pour vérifier les nouveaux blocs
export const checkForNewBlocks = async (lastKnownHeight, callback) => {
  try {
    const newBlocks = [];
    for (let fromGroup = 0; fromGroup < TOTAL_NUMBER_OF_GROUPS; fromGroup++) {
      for (let toGroup = 0; toGroup < TOTAL_NUMBER_OF_GROUPS; toGroup++) {
        const chainInfo = await retryWithBackoff(() => 
          nodeProvider.blockflow.getBlockflowChainInfo({ fromGroup, toGroup })
        );
        
        if (chainInfo.currentHeight > lastKnownHeight) {
          const hashes = await retryWithBackoff(() =>
            nodeProvider.blockflow.getBlockflowHashes({ 
              fromGroup, 
              toGroup, 
              height: chainInfo.currentHeight 
            })
          );
          
          if (hashes && hashes.length > 0) {
            const block = await retryWithBackoff(() =>
              nodeProvider.blockflow.getBlockflowBlocksBlockHash(hashes[0])
            );
            if (block) {
              const transformedBlock = {
                hash: block.hash,
                height: block.height,
                timestamp: block.timestamp,
                chainFrom: fromGroup,
                chainTo: toGroup,
                transactions: block.transactions || [],
                nonce: block.nonce,
                version: block.version,
                parentBlockHash: block.deps ? [block.deps[0]] : [],
                blockDeps: block.deps || []
              };
              newBlocks.push(transformedBlock);
              knownBlockHashes.add(block.hash);
              manageBlockCache();
            }
          }
        }
      }
    }
    
    if (newBlocks.length > 0 && callback) {
      callback(newBlocks);
    }
    
    return newBlocks;
  } catch (error) {
    console.error('Error checking for new blocks:', error);
    return [];
  }
};

// Fonction pour récupérer les blocs historiques pour un groupe spécifique
export async function fetchHistoricalBlocksForGroup(group, fromTimestamp, toTimestamp, knownBlockHashes) {
  console.log(`Fetching historical blocks for group ${group} from ${new Date(fromTimestamp).toISOString()} to ${new Date(toTimestamp).toISOString()}`);
  
  const historicalBlocks = [];
  
  try {
    const apiUrl = `${NODE_URL}/blocks?fromGroup=${group}&toGroup=${group}&limit=100`;
    console.log('Fetching from API:', apiUrl);
    
    const response = await retryWithBackoff(() =>
      fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
    );

    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.blocks) && data.blocks.length > 0) {
        console.log(`Successfully fetched ${data.blocks.length} historical blocks from API for group ${group}`);
        
        // Filtrer les blocs par timestamp
        const filteredBlocks = data.blocks.filter(block => {
          const blockTimestamp = new Date(block.timestamp).getTime();
          return blockTimestamp >= fromTimestamp && blockTimestamp <= toTimestamp;
        });
        
        console.log(`After filtering by timestamp: ${filteredBlocks.length} blocks`);
        
        // Transformer les données pour correspondre à notre format
        filteredBlocks.forEach(block => {
          if (!knownBlockHashes.has(block.hash)) {
            const transformedBlock = {
              hash: block.hash,
              height: block.height,
              timestamp: new Date(block.timestamp).getTime(),
              chainFrom: block.chainFrom,
              chainTo: block.chainTo,
              transactions: block.txNumber ? new Array(block.txNumber).fill({}) : [],
              nonce: block.nonce || 0,
              version: block.version || 0,
              parentBlockHash: block.parent ? [block.parent] : [],
            };
            historicalBlocks.push(transformedBlock);
            knownBlockHashes.add(block.hash);
            manageBlockCache();
          }
        });
        
        if (historicalBlocks.length > 0) {
          console.log(`Returning ${historicalBlocks.length} historical blocks for group ${group}`);
          return historicalBlocks;
        }
      }
    }
    
    console.log(`No historical blocks found from API for group ${group}`);
    return [];
    
  } catch (error) {
    console.error(`Error fetching historical blocks for group ${group}:`, error);
    return [];
  }
}

// Get transactions for a specific block using the SDK
export const getBlockTransactions = async (hash) => {
  try {
    const block = await retryWithBackoff(() =>
      nodeProvider.blockflow.getBlockflowBlocksBlockHash(hash)
    );
    return block.transactions || [];
  } catch (error) {
    console.error(`Error fetching transactions for block ${hash}:`, error);
    throw error;
  }
};

// Fonction pour obtenir les informations sur le réseau Alephium
export const getNetworkInfo = async () => {
  try {
    const [selfClique, version] = await Promise.all([
      retryWithBackoff(() => nodeProvider.infos.getInfosSelfClique()),
      retryWithBackoff(() => nodeProvider.infos.getInfosVersion())
    ]);
    
    return {
      cliqueId: selfClique.cliqueId,
      nodes: selfClique.nodes,
      synced: selfClique.synced,
      version: version.version
    };
  } catch (error) {
    console.error('Error fetching network info:', error);
    throw error;
  }
};

export default {
  getLatestBlocks,
  getBlockByHash,
  getBlockTransactions,
  checkForNewBlocks,
  getNetworkInfo
};
