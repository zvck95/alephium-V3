import React, { useState, useEffect, useRef } from 'react';
import BlockDetails from './BlockDetails';
import CopyIcon from '../assets/CopyIcon.svg';
import ExternalLinkIcon from '../assets/ExternalLinkIcon.svg';
import StarIcon from '../assets/StarIcon.svg';

import { getLatestBlocks, getBlockDetails } from '../services/api';
import BlockchainGraph from './BlockchainGraph';
import { connectWebSocket, closeWebSocket } from '../services/websocket';

const BLOCK_FETCH_LIMIT = 100;
const BLOCKS_TO_ENRICH = 20; // Nombre de blocs enrichis avec blockDeps pour le graph

// Utilitaire pour fusionner/dédupliquer/trier les blocs par timestamp décroissant
const mergeAndSortBlocks = (fetchedBlocks, prevBlocks) => {
  const merged = [...fetchedBlocks, ...prevBlocks];
  const deduped = Array.from(new Map(merged.map(b => [b.hash, b])).values());
  return deduped
    .filter(b => b && typeof b.timestamp === 'number')
    .sort((a, b) => b.timestamp - a.timestamp)
  // .slice(0, BLOCK_FETCH_LIMIT);
};

import { getBlockByHash } from '../services/api.optimized';

const BlockchainExplorer = () => {
  // Thème clair/sombre
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('alfx_theme');
      if (saved === 'light') {
        document.body.classList.add('light-theme');
        return 'light';
      }
    }
    document.body.classList.remove('light-theme');
    return 'dark';
  });

  // Toast pour feedback visuel
  const [toast, setToast] = useState(null);
  function showToast(text, type = 'info') {
    setToast({ text, type });
    setTimeout(() => setToast(null), 1800);
  }
  // Watchlist state (hashes)
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem('alfx_watchlist');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Ajouter un bloc à la watchlist
  const addToWatchlist = (blockHash) => {
    setWatchlist(list => {
      const updated = list.includes(blockHash) ? list : [...list, blockHash];
      localStorage.setItem('alfx_watchlist', JSON.stringify(updated));
      return updated;
    });
  };
  // Retirer un bloc de la watchlist
  const removeFromWatchlist = (blockHash) => {
    setWatchlist(list => {
      const updated = list.filter(h => h !== blockHash);
      localStorage.setItem('alfx_watchlist', JSON.stringify(updated));
      return updated;
    });
  };

  // Sync localStorage si watchlist change (pour les cas d'effacement externe)
  useEffect(() => {
    try {
      localStorage.setItem('alfx_watchlist', JSON.stringify(watchlist));
    } catch (err) {
      console.error(err);
    }
  }, [watchlist]);

  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [refreshInterval] = useState(2); // 2 secondes par défaut
  const [showRawData] = useState(false);
  const [newBlocks, setNewBlocks] = useState([]);
  const [realTimeIndicator, setRealTimeIndicator] = useState(false);
  const [highlightedBlocks, setHighlightedBlocks] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');

  // UI modals
  const [showSearch, setShowSearch] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState("");

  // Recherche de bloc (hash ou hauteur)
  async function handleBlockSearch() {
    setSearchError("");
    const input = searchInput.trim();
    if (!input) {
      setSearchError("Veuillez entrer un hash ou une hauteur.");
      return;
    }
    // Recherche dans les blocs chargés (par hash ou hauteur)
    let found = blocks.find(b => b.hash === input || b.height === Number(input));
    if (found) {
      setSelectedBlock(found);
      setShowSearch(false);
      setSearchInput("");
      return;
    }
    // Sinon, tente un fetch distant par hash
    try {
      const fetched = await getBlockByHash(input);
      if (fetched && fetched.hash) {
        setSelectedBlock(fetched);
        setShowSearch(false);
        setSearchInput("");
        return;
      } else {
        setSearchError("Aucun bloc trouvé.");
      }
    } catch (e) {
      setSearchError("Aucun bloc trouvé ou erreur réseau.");
    }
  }


  const firstLoad = useRef(true);
  const previousHashes = useRef([]);

  const detailsRef = useRef();
  const blocksRef = useRef(blocks);
  const blockDetailsCache = useRef(new Map());

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Récupération d'un bloc enrichi avec ses blockDeps (mise en cache)
  const getBlockWithDeps = async (block) => {
    if (blockDetailsCache.current.has(block.hash)) {
      return { ...block, ...blockDetailsCache.current.get(block.hash) };
    }
    try {
      const details = await getBlockDetails(block.hash);
      blockDetailsCache.current.set(block.hash, details);
      return { ...block, ...details };
    } catch (e) {
      // Si erreur, retourne le bloc de base (pas bloquant)
      return { ...block, blockDeps: [] };
    }
  };

  // Fetch + enrichissement blockDeps sur les X derniers blocs (BLOCKS_TO_ENRICH)
  const fetchBlocksWithDeps = async () => {
    setLoading(true);
    try {
      const latestBlocks = await getLatestBlocks(BLOCK_FETCH_LIMIT);
      const blocksToEnrich = latestBlocks.slice(0, BLOCKS_TO_ENRICH);
      const blocksWithDeps = await Promise.all(
        blocksToEnrich.map(getBlockWithDeps)
      );
      // Remplace dans latestBlocks les N premiers par leurs versions enrichies
      const enrichedBlocks = [...blocksWithDeps, ...latestBlocks.slice(BLOCKS_TO_ENRICH)];
      const updated = mergeAndSortBlocks(enrichedBlocks, blocksRef.current);

      setBlocks(updated);
      blocksRef.current = updated;
      if (updated.length > 0) {
        // last block height previously used here
      }
      setError(null);
    } catch (err) {
      setError('Failed to fetch blocks: ' + err.message);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBlock && detailsRef.current) {
      detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedBlock]);

  useEffect(() => {
    fetchBlocksWithDeps();
  }, []);

  useEffect(() => {
    connectWebSocket(
      (block) => {
        setBlocks(prev => mergeAndSortBlocks([block], prev));
      },
      setWsStatus
    );
    return () => closeWebSocket(setWsStatus);
  }, []);

  // Polling automatique toutes les X secondes
  useEffect(() => {
    const interval = setInterval(async () => {
      setRealTimeIndicator(true);
      try {
        await fetchBlocksWithDeps();
      } catch (err) {
        // déjà géré
      } finally {
        setRealTimeIndicator(false);
      }
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Détection nouveaux blocs
  useEffect(() => {
    if (!blocksRef.current || !blocksRef.current.length) return;
    const oldHashes = new Set(blocksRef.current.map(b => b.hash));
    const uniques = blocks.filter(b => !oldHashes.has(b.hash));
    setNewBlocks(uniques);
    if (uniques.length > 0) {
      setTimeout(() => setNewBlocks([]), 5000);
    }
  }, [blocks]);


  useEffect(() => {
    // Les 10 premiers blocs du tableau (visible)
    const visible = blocks.slice(0, 10).map(b => b.hash);

    if (firstLoad.current) {
      // Première fois : on ne surligne rien
      firstLoad.current = false;
      previousHashes.current = visible;
      setHighlightedBlocks([]);
      return;
    }

    // Les nouveaux à surligner (présents dans visible mais pas dans l'ancien tableau)
    const newToHighlight = visible.filter(hash => !previousHashes.current.includes(hash));
    previousHashes.current = visible;

    if (newToHighlight.length > 0) {
      setHighlightedBlocks(prev => [...prev, ...newToHighlight]);
      // Retire le highlight au bout de 2s pour chaque nouveau
      newToHighlight.forEach(hash => {
        setTimeout(() => {
          setHighlightedBlocks(prev => prev.filter(h => h !== hash));
        }, 2000);
      });
    }
  }, [blocks]);


  // Affiche les détails d'un bloc dans une fenêtre d'impression
  const printBlockDetails = (block) => {
    try {
      // Fonction pour formater les données du hashrate
      const getHashrateDetails = (block) => {
        return [
          { label: 'Parent Hash', value: block.parent || block.parentBlockHash?.[0] || 'N/A' },
          { label: 'Merkle root', value: block.txsHash || 'N/A' },
          { label: 'DeepStateHash', value: block.depStateHash || 'N/A' },
          { label: 'Timestamp', value: new Date(block.timestamp).toLocaleString() || 'N/A' },
          { label: 'Nonce', value: block.nonce || 'N/A' },
          { label: 'Chaîne', value: `${block.chainFrom} → ${block.chainTo}` },
        ];
      };

      const hashrateFields = getHashrateDetails(block);

      // Création du contenu HTML
      const printContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #3a2e5a; border-bottom: 2px solid #3a2e5a; padding-bottom: 10px; margin-bottom: 20px;">
            Détails du Bloc #${block.height}
          </h1>
          
          <h2 style="color: #3a2e5a; font-size: 18px; margin: 25px 0 15px 0;">Informations de base</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #eee;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 150px; background-color: #f8f8f8;">Hauteur</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${block.height}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; background-color: #f8f8f8;">Hash</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace; word-break: break-all;">${block.hash}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; background-color: #f8f8f8;">Date</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${new Date(block.timestamp).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; background-color: #f8f8f8;">Transactions</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${block.txNumber || '0'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; background-color: #f8f8f8;">Taille</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${block.size ? `${block.size} octets` : 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; background-color: #f8f8f8;">Chaîne</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${block.chainFrom || 'N/A'} → ${block.chainTo || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; background-color: #f8f8f8;">Confirmations</td>
              <td style="padding: 10px;">${block.confirmations || 'N/A'}</td>
            </tr>
          </table>

          <h2 style="color: #3a2e5a; font-size: 18px; margin: 25px 0 15px 0;">Détails du Hashrate</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #eee;">
            ${hashrateFields.map(field => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 150px; background-color: #f8f8f8;">${field.label}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace; word-break: break-all;">${field.value}</td>
              </tr>
            `).join('')}
          </table>
          
          <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px;">
            Généré le ${new Date().toLocaleString()} via Alephium Explorer
          </div>
        </div>
      `;

      // Ouverture d'une nouvelle fenêtre pour l'impression
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Détails du Bloc #${block.height}</title>
            <style>
              @media print {
                @page { margin: 1cm; }
                body { -webkit-print-color-adjust: exact; }
                table { page-break-inside: avoid; }
                h2 { page-break-after: avoid; }
              }
              @page {
                size: A4;
                margin: 1cm;
              }
            </style>
          </head>
          <body>
            ${printContent}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() { window.close(); }, 100);
                }, 200);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

    } catch (error) {
      console.error('Erreur lors de la préparation de l\'impression:', error);
      showToast('Erreur lors de la préparation de l\'impression', 'error');
    }
  };

  // Sélection d'un bloc
  const handleBlockSelect = (block) => setSelectedBlock(block);

  // Données et logique pour le tableau de minage
  const devices = [
    { model: 'Bitmain Antminer AL1 Pro', hashrate: '16.6', power: '3 500 W', efficiency: '211 J/TH', cooling: 'Air', manufacturer: 'Bitmain' },
    { model: 'IceRiver AL3', hashrate: '15', power: '3 500 W', efficiency: '233 J/TH', cooling: 'Air', manufacturer: 'IceRiver' },
    { model: 'Bitmain Antminer AL3', hashrate: '8', power: '3 200 W', efficiency: '400 J/TH', cooling: 'Air', manufacturer: 'Bitmain' },
    { model: 'Goldshell AL MAX', hashrate: '8.3', power: '3 000 W', efficiency: '361 J/TH', cooling: 'Air', manufacturer: 'Goldshell' },
    { model: 'IceRiver AL2 Lite', hashrate: '2', power: '1 200 W', efficiency: '600 J/TH', cooling: 'Air', manufacturer: 'IceRiver' },
    { model: 'Goldshell AL-BOX III', hashrate: '1.25', power: '800 W', efficiency: '640 J/TH', cooling: 'Air', manufacturer: 'Goldshell' },
  ];
  function getCategory(hashrate) {
    const value = parseFloat(hashrate);
    if (value > 15) return 'Très haut';
    if (value >= 8) return 'Haut';
    if (value >= 2) return 'Moyen';
    return 'Faible';
  }

  return (
    <div>
      <div class="latest-blocks-container">
        <div className="toolbar">
          <div style={{ display: 'flex', gap: '12px' }}>
            <img
              src="/src/assets/logo alephium.png"
              alt="Alephium Logo"
              style={{
                width: '50px',
                height: '50px',
                objectFit: 'contain',
              }}
            />
            <div className="title">
              <span style={{ fontWeight: '800' }}>Alephium</span>
              <span style={{ fontWeight: '400' }}> Explorer</span>
            </div>
          </div>
          <div className="controls" style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <div className="real-time-indicator toolbar-button" title="Mise à jour en temps réel">
              <div className={`indicator ${realTimeIndicator ? 'active' : ''}`}></div>
              <span>Real Time</span>
            </div>
            <div className="ws-status-indicator toolbar-button" title="WebSocket status">
              <div className={`indicator ${wsStatus === 'connected' ? 'active' : ''}`}></div>
              <span>{wsStatus}</span>
            </div>
            {/* <div className="refresh-control">
                <label htmlFor="refresh-interval">Refresh every : <span className='refresh-interval-value'>{refreshInterval} seconds</span></label>
              </div> */}
            <button
              className="toolbar-button"
              onClick={() => setShowSearch(s => !s)}
            >
              {/* <span style={{fontSize: 20, lineHeight: 1}}>🔍</span> */}
              <span>Rechercher un bloc</span>
            </button>
            <button
              className="toolbar-button"
              onClick={() => setShowWatchlist(s => !s)}
              title="Watchlist"
            >
              {theme === 'light' ? (

                <svg opacity="0.7" width="25" height="25" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M11.2691 4.41115C11.5006 3.89177 11.6164 3.63208 11.7776 3.55211C11.9176 3.48263 12.082 3.48263 12.222 3.55211C12.3832 3.63208 12.499 3.89177 12.7305 4.41115L14.5745 8.54808C14.643 8.70162 14.6772 8.77839 14.7302 8.83718C14.777 8.8892 14.8343 8.93081 14.8982 8.95929C14.9705 8.99149 15.0541 9.00031 15.2213 9.01795L19.7256 9.49336C20.2911 9.55304 20.5738 9.58288 20.6997 9.71147C20.809 9.82316 20.8598 9.97956 20.837 10.1342C20.8108 10.3122 20.5996 10.5025 20.1772 10.8832L16.8125 13.9154C16.6877 14.0279 16.6252 14.0842 16.5857 14.1527C16.5507 14.2134 16.5288 14.2807 16.5215 14.3503C16.5132 14.429 16.5306 14.5112 16.5655 14.6757L17.5053 19.1064C17.6233 19.6627 17.6823 19.9408 17.5989 20.1002C17.5264 20.2388 17.3934 20.3354 17.2393 20.3615C17.0619 20.3915 16.8156 20.2495 16.323 19.9654L12.3995 17.7024C12.2539 17.6184 12.1811 17.5765 12.1037 17.56C12.0352 17.5455 11.9644 17.5455 11.8959 17.56C11.8185 17.5765 11.7457 17.6184 11.6001 17.7024L7.67662 19.9654C7.18404 20.2495 6.93775 20.3915 6.76034 20.3615C6.60623 20.3354 6.47319 20.2388 6.40075 20.1002C6.31736 19.9408 6.37635 19.6627 6.49434 19.1064L7.4341 14.6757C7.46898 14.5112 7.48642 14.429 7.47814 14.3503C7.47081 14.2807 7.44894 14.2134 7.41394 14.1527C7.37439 14.0842 7.31195 14.0279 7.18708 13.9154L3.82246 10.8832C3.40005 10.5025 3.18884 10.3122 3.16258 10.1342C3.13978 9.97956 3.19059 9.82316 3.29993 9.71147C3.42581 9.58288 3.70856 9.55304 4.27406 9.49336L8.77835 9.01795C8.94553 9.00031 9.02911 8.99149 9.10139 8.95929C9.16534 8.93081 9.2226 8.8892 9.26946 8.83718C9.32241 8.77839 9.35663 8.70162 9.42508 8.54808L11.2691 4.41115Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
              ) : (
                // <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79Z" stroke="#ffe066" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <svg opacity="0.7" width="25" height="25" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M11.2691 4.41115C11.5006 3.89177 11.6164 3.63208 11.7776 3.55211C11.9176 3.48263 12.082 3.48263 12.222 3.55211C12.3832 3.63208 12.499 3.89177 12.7305 4.41115L14.5745 8.54808C14.643 8.70162 14.6772 8.77839 14.7302 8.83718C14.777 8.8892 14.8343 8.93081 14.8982 8.95929C14.9705 8.99149 15.0541 9.00031 15.2213 9.01795L19.7256 9.49336C20.2911 9.55304 20.5738 9.58288 20.6997 9.71147C20.809 9.82316 20.8598 9.97956 20.837 10.1342C20.8108 10.3122 20.5996 10.5025 20.1772 10.8832L16.8125 13.9154C16.6877 14.0279 16.6252 14.0842 16.5857 14.1527C16.5507 14.2134 16.5288 14.2807 16.5215 14.3503C16.5132 14.429 16.5306 14.5112 16.5655 14.6757L17.5053 19.1064C17.6233 19.6627 17.6823 19.9408 17.5989 20.1002C17.5264 20.2388 17.3934 20.3354 17.2393 20.3615C17.0619 20.3915 16.8156 20.2495 16.323 19.9654L12.3995 17.7024C12.2539 17.6184 12.1811 17.5765 12.1037 17.56C12.0352 17.5455 11.9644 17.5455 11.8959 17.56C11.8185 17.5765 11.7457 17.6184 11.6001 17.7024L7.67662 19.9654C7.18404 20.2495 6.93775 20.3915 6.76034 20.3615C6.60623 20.3354 6.47319 20.2388 6.40075 20.1002C6.31736 19.9408 6.37635 19.6627 6.49434 19.1064L7.4341 14.6757C7.46898 14.5112 7.48642 14.429 7.47814 14.3503C7.47081 14.2807 7.44894 14.2134 7.41394 14.1527C7.37439 14.0842 7.31195 14.0279 7.18708 13.9154L3.82246 10.8832C3.40005 10.5025 3.18884 10.3122 3.16258 10.1342C3.13978 9.97956 3.19059 9.82316 3.29993 9.71147C3.42581 9.58288 3.70856 9.55304 4.27406 9.49336L8.77835 9.01795C8.94553 9.00031 9.02911 8.99149 9.10139 8.95929C9.16534 8.93081 9.2226 8.8892 9.26946 8.83718C9.32241 8.77839 9.35663 8.70162 9.42508 8.54808L11.2691 4.41115Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>


              )}



            </button>
            <button
              className="toolbar-button"
              onClick={() => {
                const isLight = document.body.classList.toggle('light-theme');
                localStorage.setItem('alfx_theme', isLight ? 'light' : 'dark');
                setTheme(isLight ? 'light' : 'dark');
              }}
              title={theme === 'light' ? 'Passer en sombre' : 'Passer en clair'}
              onMouseOver={e => e.currentTarget.style.background = theme === 'light' ? '' : ''}
              onMouseOut={e => e.currentTarget.style.background = theme === 'light' ? '' : ''}
            >
              {theme === 'light' ? (

                <svg width="30px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M7.28451 10.3333C7.10026 10.8546 7 11.4156 7 12C7 14.7614 9.23858 17 12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C11.4156 7 10.8546 7.10026 10.3333 7.28451" stroke="#000000" stroke-width="1.5" stroke-linecap="round"></path> <path d="M12 2V4" stroke="#000000" stroke-width="1.5" stroke-linecap="round"></path> <path d="M12 20V22" stroke="#000000" stroke-width="1.5" stroke-linecap="round"></path> <path d="M4 12L2 12" stroke="#000000" stroke-width="1.5" stroke-linecap="round"></path> <path d="M22 12L20 12" stroke="#000000" stroke-width="1.5" stroke-linecap="round"></path> <path d="M19.7778 4.22266L17.5558 6.25424" stroke="#000000" stroke-width="1.5" stroke-linecap="round"></path> <path d="M4.22217 4.22266L6.44418 6.25424" stroke="#000000" stroke-width="1.5" stroke-linecap="round"></path> <path d="M6.44434 17.5557L4.22211 19.7779" stroke="#000000" stroke-width="1.5" stroke-linecap="round"></path> <path d="M19.7778 19.7773L17.5558 17.5551" stroke="#000000" stroke-width="1.5" stroke-linecap="round"></path> </g></svg>) : (
                // <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79Z" stroke="#ffe066" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <svg opacity="0.7" width="25px" height="25px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">

                  <g id="SVGRepo_bgCarrier" stroke-width="0" />

                  <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" />

                  <g id="SVGRepo_iconCarrier"> <path d="M3.32031 11.6835C3.32031 16.6541 7.34975 20.6835 12.3203 20.6835C16.1075 20.6835 19.3483 18.3443 20.6768 15.032C19.6402 15.4486 18.5059 15.6834 17.3203 15.6834C12.3497 15.6834 8.32031 11.654 8.32031 6.68342C8.32031 5.50338 8.55165 4.36259 8.96453 3.32996C5.65605 4.66028 3.32031 7.89912 3.32031 11.6835Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /> </g>

                </svg>

              )}
            </button>

          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div>
          <h2 className='visualization-title'>10 Derniers blocs créés</h2>
          <div className="latest-blocks-table">
            <div className="table-header">
              <div className="table-cell">Hauteur</div>
              <div className="table-cell">Date</div>
              <div className="table-cell">Txn</div>
              <div className="table-cell">Indice de chaîne</div>
              <div className="table-cell">Statut</div>
              <div className="table-cell"></div>

            </div>
            {loading && blocks.length === 0 ? (
              // Skeleton loader simple
              Array.from({ length: 10 }).map((_, idx) => (
                <div key={idx} className="table-row skeleton-row" style={{ height: 42, opacity: 0.5 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="table-cell">
                      <div style={{ height: 18, width: '80%', background: '#39324f', borderRadius: 6, margin: '0 auto' }}></div>
                    </div>
                  ))}
                  <div style={{ height: 18, width: 28, background: '#39324f', borderRadius: 6, margin: '0 8px' }}></div>
                  <div style={{ height: 18, width: 28, background: '#39324f', borderRadius: 6, margin: '0 8px' }}></div>
                </div>
              ))
            ) : blocks.slice(0, 10).map(block => (
              <div
                key={block.hash}
                className={`table-row ${highlightedBlocks.includes(block.hash) ? 'new-block' : ''} ${watchlist.includes(block.hash) ? 'watchlisted-block' : ''}`}
                onClick={() => handleBlockSelect(block)}
                style={{ transition: 'box-shadow 0.28s, background 0.22s' }}
              >
                {/* Badge étoile si surveillé */}
                {watchlist.includes(block.hash) && (
                  <img src={StarIcon} alt="Surveillé" title="Bloc surveillé" style={{ width: 18, height: 18, marginRight: 6, verticalAlign: 'middle' }} />
                )}
                {/* Hauteur */}
                <div className="table-cell height" style={{ color: 'var(--primary-color)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {block.height}
                  {/* Badge confirmé */}

                </div>
                <div className="table-cell">{new Date(block.timestamp).toLocaleTimeString()}</div>
                <div className="table-cell">{block.txNumber ?? 0}</div>
                <div className="table-cell">{block.chainFrom} → {block.chainTo}</div>
                {/* Bouton copier hash */}
                <div className="table-cell" style={{ display: 'flex', gap: '8px' }}>
                  <span style={{
                    display: 'inline-block',
                    fontWeight: 700,
                    fontSize: 13,
                    borderRadius: 8,
                    padding: '4px 8px',
                    marginLeft: 4,
                    background: block.mainChain !== false ? '#0f3b396b' : '#ffb347',
                    color: block.mainChain !== false ? '#b2dae2' : '#222',
                    letterSpacing: 0.2,
                    height: 'fit-content'
                  }}>{block.mainChain !== false ? 'Confirmé' : 'Non confirmé'}</span>


                </div>
                <div className="table-cell" style={{ display: "flex" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(block.hash);
                      showToast('Hash copié !');
                    }}
                    className="icon-table-button"
                    title="Copier le hash"
                  >
                    <svg opacity={0.6} width="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M10 8V7C10 6.05719 10 5.58579 10.2929 5.29289C10.5858 5 11.0572 5 12 5H17C17.9428 5 18.4142 5 18.7071 5.29289C19 5.58579 19 6.05719 19 7V12C19 12.9428 19 13.4142 18.7071 13.7071C18.4142 14 17.9428 14 17 14H16M7 19H12C12.9428 19 13.4142 19 13.7071 18.7071C14 18.4142 14 17.9428 14 17V12C14 11.0572 14 10.5858 13.7071 10.2929C13.4142 10 12.9428 10 12 10H7C6.05719 10 5.58579 10 5.29289 10.2929C5 10.5858 5 11.0572 5 12V17C5 17.9428 5 18.4142 5.29289 18.7071C5.58579 19 6.05719 19 7 19Z" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      printBlockDetails(block);
                    }}
                    className="icon-table-button"
                    title="Imprimer les détails"
                    style={{ color: '#666' }}
                  >
                    <svg opacity="0.6" width="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#000000" stroke-width="0.8879999999999999"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M18 13.5H18.5C19.4428 13.5 19.9142 13.5 20.2071 13.2071C20.5 12.9142 20.5 12.4428 20.5 11.5V10.5C20.5 8.61438 20.5 7.67157 19.9142 7.08579C19.3284 6.5 18.3856 6.5 16.5 6.5H7.5C5.61438 6.5 4.67157 6.5 4.08579 7.08579C3.5 7.67157 3.5 8.61438 3.5 10.5V12.5C3.5 12.9714 3.5 13.2071 3.64645 13.3536C3.79289 13.5 4.0286 13.5 4.5 13.5H6" stroke="#ffffff"></path> <path d="M6.5 19.8063L6.5 11.5C6.5 10.5572 6.5 10.0858 6.79289 9.79289C7.08579 9.5 7.55719 9.5 8.5 9.5L15.5 9.5C16.4428 9.5 16.9142 9.5 17.2071 9.79289C17.5 10.0858 17.5 10.5572 17.5 11.5L17.5 19.8063C17.5 20.1228 17.5 20.2811 17.3962 20.356C17.2924 20.4308 17.1422 20.3807 16.8419 20.2806L14.6738 19.5579C14.5878 19.5293 14.5448 19.5149 14.5005 19.5162C14.4561 19.5175 14.4141 19.5344 14.3299 19.568L12.1857 20.4257C12.094 20.4624 12.0481 20.4807 12 20.4807C11.9519 20.4807 11.906 20.4624 11.8143 20.4257L9.67005 19.568C9.58592 19.5344 9.54385 19.5175 9.49952 19.5162C9.45519 19.5149 9.41221 19.5293 9.32625 19.5579L7.15811 20.2806C6.8578 20.3807 6.70764 20.4308 6.60382 20.356C6.5 20.2811 6.5 20.1228 6.5 19.8063Z" stroke="#ffffff"></path> <path d="M9.5 13.5L13.5 13.5" stroke="#ffffff" stroke-linecap="round"></path> <path d="M9.5 16.5L14.5 16.5" stroke="#ffffff" stroke-linecap="round"></path> <path d="M17.5 6.5V6.1C17.5 4.40294 17.5 3.55442 16.9728 3.02721C16.4456 2.5 15.5971 2.5 13.9 2.5H10.1C8.40294 2.5 7.55442 2.5 7.02721 3.02721C6.5 3.55442 6.5 4.40294 6.5 6.1V6.5" stroke="#ffffff"></path> </g></svg>
                  </button>
                  <a
                    className='icon-table-button'
                    href={`https://explorer.alephium.org/blocks/${block.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    // style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }}
                    title="Voir sur explorer officiel"
                    tabIndex={0}
                    onClick={e => e.stopPropagation()}
                  >
                    <svg opacity={0.6} width="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M13.1667 5H6C5.44772 5 5 5.44772 5 6V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V10.8333M15.5 5H19M19 5V8.5M19 5L9.66667 14.3333" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>                  </a>
                </div>

                {/* Lien explorer officiel */}

              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Affichage du détail du bloc sélectionné sous la table */}
      {selectedBlock && (
        <BlockDetails
          block={selectedBlock}
          allBlocks={blocks}
          watchlist={watchlist}
          addToWatchlist={addToWatchlist}
          removeFromWatchlist={removeFromWatchlist}
        />
      )}

      <div className="full-width-visualization">

        <h2 className='visualization-title'>Visualisation des blocs</h2>
        {loading && blocks.length === 0 ? (
          <div className="loading">Chargement...</div>
        ) : blocks.length > 0 ? (
          <BlockchainGraph
            blocks={blocks}
            onBlockSelect={handleBlockSelect}
            newBlocks={newBlocks}
            selectedBlock={selectedBlock}
          >
            {selectedBlock && (
              <BlockDetails
                block={selectedBlock}
                allBlocks={blocks}
                watchlist={watchlist}
                addToWatchlist={addToWatchlist}
                removeFromWatchlist={removeFromWatchlist}
              />
            )}
          </BlockchainGraph>
        ) : (
          <div className="error-message">
            <p>Aucun bloc disponible</p>
            <pre>{JSON.stringify({ error }, null, 2)}</pre>
          </div>
        )}
      </div>

      <h2 className='block-details-title'>{selectedBlock ? 'Détails du bloc' : 'Sélectionnez un bloc'}</h2>



      {showRawData && (
        <div className="debug-info">
          <h4>Données brutes :</h4>
          <pre style={{ maxHeight: 300, overflow: 'auto' }}>
            {JSON.stringify(blocks.slice(0, 5), null, 2)}
          </pre>
          {selectedBlock && (
            <>
              <h4>Bloc sélectionné :</h4>
              <pre>{JSON.stringify(selectedBlock, null, 2)}</pre>
            </>
          )}
        </div>
      )}
      {/* Modal Recherche Bloc */}
      {showSearch && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#201c2d', borderRadius: 14, padding: '36px 28px', minWidth: 340, boxShadow: '0 4px 32px #0008', position: 'relative' }}>
            <button onClick={() => setShowSearch(false)} style={{ position: 'absolute', top: 13, right: 16, fontSize: 22, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>×</button>
            <h2 style={{ color: '#fff', marginBottom: 18, fontSize: 22 }}>🔍 Rechercher un bloc</h2>
            <input
              type="text"
              placeholder="Hash ou hauteur..."
              value={searchInput}
              onChange={e => { setSearchInput(e.target.value); setSearchError(""); }}
              style={{ width: '100%', padding: '10px 13px', fontSize: 17, borderRadius: 7, border: '1px solid #333', background: '#2a223e', color: '#fff', marginBottom: 12 }}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { handleBlockSearch(); } }}
            />
            <button
              style={{ background: '#3e2c77', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 16, cursor: 'pointer', marginTop: 4, width: '100%' }}
              onClick={handleBlockSearch}
            >Rechercher</button>
            {searchError && <div style={{ color: '#ff6b6b', marginTop: 8 }}>{searchError}</div>}
          </div>
        </div>
      )}
      {/* Modal Watchlist */}
      {showWatchlist && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'linear-gradient(135deg,#232c1d 60%,#2a223e 100%)', borderRadius: 18, padding: '40px 32px', minWidth: 370, boxShadow: '0 8px 48px #000a', position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowWatchlist(false)} style={{ position: 'absolute', top: 13, right: 16, fontSize: 24, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', transition: 'color 0.2s' }} title="Fermer">×</button>
            <h2 style={{ color: '#fff', marginBottom: 18, fontSize: 23, letterSpacing: 1 }}>⭐ Watchlist</h2>
            {watchlist.length === 0 ? (
              <div style={{ color: '#fff', opacity: 0.7, fontSize: 17 }}>Aucun bloc dans la watchlist.</div>
            ) : (
              <ul style={{ padding: 0, margin: 0, listStyle: 'none', background: 'rgba(54,36,80,0.18)', borderRadius: 10, boxShadow: '0 2px 12px #0002', overflow: 'hidden' }}>
                {watchlist.map(hash => {
                  const block = blocks.find(b => b.hash === hash);
                  const isSelected = selectedBlock && selectedBlock.hash === hash;
                  return (
                    <li key={hash} style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #312d40', background: isSelected ? '#2d2248' : 'transparent', transition: 'background 0.2s' }}>
                      <span style={{ fontSize: 18, marginRight: 2, display: 'inline-block', transform: 'scale(1.2)', animation: 'star-pop 0.9s cubic-bezier(.7,1.8,.3,1)' }}>⭐</span>
                      <a
                        href="#"
                        style={{
                          fontFamily: 'monospace', color: '#b0eaff', fontSize: 16, textDecoration: 'underline', transition: 'color 0.2s',
                          fontWeight: isSelected ? 'bold' : 'normal',
                          background: isSelected ? '#3e2c77' : 'none',
                          borderRadius: 5, padding: '2px 7px',
                          boxShadow: isSelected ? '0 2px 8px #3e2c7740' : 'none',
                          position: 'relative',
                        }}
                        onClick={e => {
                          e.preventDefault();
                          if (block) setSelectedBlock(block);
                        }}
                        onMouseOver={e => e.currentTarget.style.color = '#fff'}
                        onMouseOut={e => e.currentTarget.style.color = '#b0eaff'}
                        title={block ? `Bloc #${block.height}` : hash}
                      >{block ? `#${block.height}` : `${hash.slice(0, 12)}...${hash.slice(-6)}`}</a>
                      <span style={{ fontFamily: 'monospace', color: '#a7a7c1', fontSize: 14, opacity: 0.8 }}>{hash.slice(0, 8)}...{hash.slice(-6)}</span>
                      <button
                        style={{ background: 'none', border: 'none', padding: 0, marginLeft: 4, cursor: 'pointer', verticalAlign: 'middle' }}
                        onClick={() => { navigator.clipboard.writeText(hash); if (typeof showToast === 'function') { showToast('Hash copié !', 'info'); } }}
                        title="Copier le hash"
                        tabIndex={0}
                      >
                        <img src={CopyIcon} alt="Copier" style={{ width: 22, height: 22, filter: 'drop-shadow(0 1px 2px #0008)' }} />
                      </button>
                      <a
                        href={`https://explorer.alephium.org/blocks/${hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }}
                        title="Voir sur explorer officiel"
                        tabIndex={0}
                        onClick={e => e.stopPropagation()}
                      >
                        <img src={ExternalLinkIcon} alt="Voir sur explorer" style={{ width: 22, height: 22, filter: 'drop-shadow(0 1px 2px #0008)' }} />
                      </a>
                      {isSelected && <span style={{ background: '#51e1ff', color: '#18142a', fontWeight: 700, borderRadius: 6, padding: '2px 7px', fontSize: 13, marginLeft: 6 }}>Sélectionné</span>}
                      <button onClick={() => { removeFromWatchlist(hash); if (typeof showToast === 'function') { showToast('Retiré de la Watchlist !', 'error'); } }} style={{ background: '#ff6b6b', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', marginLeft: 'auto', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}>Retirer</button>
                    </li>
                  );
                })}
              </ul>
            )}
            {toast && (
              <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', background: '#3e2c77', color: '#fff', padding: '13px 30px', borderRadius: 10, boxShadow: '0 4px 18px #0008', fontWeight: 600, fontSize: 18, zIndex: 1200, animation: 'fadein 0.8s' }}>{toast.text}</div>
            )}
            <style>{`
              @keyframes star-pop{0%{transform:scale(0.7) rotate(-10deg);}60%{transform:scale(1.3) rotate(8deg);}100%{transform:scale(1.2) rotate(0deg);}}
              @keyframes fadein{0%{opacity:0;transform:translateY(30px) scale(0.95);}100%{opacity:1;transform:translateY(0) scale(1);}}
            `}</style>
          </div>
        </div>
      )}


      {/* Tableau appareils de minage Alephium */}
      <div className="mining-table-section">
        <h2 className="mining-table-title">Appareils de minage Alephium</h2>
        <p className="mining-table-desc">
          <strong>Hashrate</strong> : Le hashrate correspond à la puissance de calcul d'un appareil de minage, exprimée en TH/s (térahash par seconde). Plus le hashrate est élevé, plus l'appareil réalise d'opérations de hachage par seconde et donc plus il est efficace pour sécuriser le réseau et trouver des blocs.
        </p>
        <div className="mining-table-wrapper">
          <table className="mining-table">
            <thead>
              <tr>
                <th>Modèle</th>
                <th>Hashrate</th>
                <th>Consommation</th>
                <th>Efficacité</th>
                <th>Refroidissement</th>
                <th>Fabricant</th>
                <th>Catégorie</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d, i) => (
                <tr key={i}>
                  <td>{d.model}</td>
                  <td>{d.hashrate} TH/s</td>
                  <td>{d.power}</td>
                  <td>{d.efficiency}</td>
                  <td>{d.cooling}</td>
                  <td>{d.manufacturer}</td>
                  <td><span className={`cat-badge cat-${getCategory(d.hashrate).toLowerCase().replace(' ', '-')}`}>{getCategory(d.hashrate)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Encart JJPool Alephium */}
        <div className="jjpool-section">
          <h3 className="jjpool-title">Pool de minage JJPool (Alephium)</h3>
          <p className="jjpool-desc">
            JJPool est un pool de minage français pour Alephium. Retrouvez les statistiques en temps réel et rejoignez le pool sur leur site officiel.
          </p>
          <a href="https://jjpool.fr/" className="jjpool-link" target="_blank" rel="noopener noreferrer">Accéder à JJPool Alephium</a>
        </div>
      </div>
      <style>{`
      .mining-table-section {
        background: #201c2d !important;
        border-radius: 16px;
        box-shadow: 0 6px 32px #000a, 0 1.5px 8px #2a223e99;
        padding: 32px 24px 24px 24px;
        margin: 32px auto 0 auto;
        max-width: 950px;
        border: 1.5px solid #3e2c77;
      }
      .mining-table-title {
        color: #c678dd;
        font-size: 2rem;
        margin-bottom: 10px;
        letter-spacing: 0.5px;
        font-weight: 800;
      }
      .mining-table-desc {
        color: #c678dd;
        font-size: 1.08rem;
        margin-bottom: 18px;
        line-height: 1.5;
        background: #292040;
        padding: 12px 18px;
        border-radius: 8px;
        border-left: 4px solid #c678dd;
      }
      .mining-table-wrapper {
        overflow-x: auto;
      }
      .mining-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 1rem;
        background: #201c2d;
      }
      .mining-table th {
        background: #2a223e;
        color: #c678dd;
        font-weight: 700;
        padding: 12px 10px;
        border-bottom: 2px solid #3e2c77;
        text-align: left;
      }
      .mining-table td {
        padding: 10px 10px;
        border-bottom: 1px solid #3e2c77;
        color: #d4d4d4;
      }
      .mining-table tr:last-child td {
        border-bottom: none;
      }
      .cat-badge {
        display: inline-block;
        padding: 4px 12px;
        font-size: 0.97em;
        font-weight: 600;
        border-radius: 20px;
        background: #f1f5f9;
        color: #2563eb;
        border: 1px solid #e2e8f0;
      }
      .cat-très-haut {
        background: #dbeafe;
        color: #1e40af;
        border-color: #2563eb;
      }
      .cat-haut {
        background: #bbf7d0;
        color: #047857;
        border-color: #10b981;
      }
      .cat-moyen {
        background: #fef9c3;
        color: #b45309;
        border-color: #fde68a;
      }
      .cat-faible {
        background: #fee2e2;
        color: #b91c1c;
        border-color: #f87171;
      }
      @media (max-width: 700px) {
        .mining-table-section {padding: 18px 4px 12px 4px;}
        .mining-table-title {font-size: 1.2rem;}
        .mining-table-desc {font-size: 0.98rem;padding: 8px 8px;}
        .mining-table th, .mining-table td {padding: 7px 4px;}
      }
      .jjpool-section {
        background: #201c2d;
        border: 1.5px solid #3e2c77;
        border-radius: 14px;
        margin: 32px auto 0 auto;
        max-width: 950px;
        padding: 24px 24px 18px 24px;
        box-shadow: 0 4px 24px #0006;
        text-align: center;
      }
      .jjpool-title {
        color: #c678dd;
        font-size: 1.3rem;
        margin-bottom: 8px;
        font-weight: 700;
      }
      .jjpool-desc {
        color: #d4d4d4;
        font-size: 1.04rem;
        margin-bottom: 16px;
      }
      .jjpool-link {
        display: inline-block;
        background: #c678dd;
        color: #201c2d;
        font-weight: 700;
        border-radius: 8px;
        padding: 10px 22px;
        text-decoration: none;
        font-size: 1.08rem;
        transition: background 0.15s, color 0.15s;
        box-shadow: 0 2px 8px #0003;
      }
      .jjpool-link:hover {
        background: #a259c2;
        color: #fff;
      }
    `}</style>
    </div>
  );
};

export default BlockchainExplorer;
