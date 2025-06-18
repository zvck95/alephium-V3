import PropTypes from 'prop-types';
import React, { useRef, useEffect, useState } from 'react';
import HashrateDetails from './HashrateDetails';

const shorten = (hash, n = 8) =>
  hash && hash.length > 2 * n + 3
    ? `${hash.slice(0, n)}...${hash.slice(-n)}`
    : hash || '';



const formatHashrate = (h) => h ? Number(h).toLocaleString('en-US') : h;

const BlockDetails = ({ block, allBlocks, watchlist = [], addToWatchlist, removeFromWatchlist }) => {
  const [showHashrate, setShowHashrate] = useState(false);
  const detailsRef = useRef();

  // Fonction pour imprimer les détails du bloc
  const printBlockDetails = (block) => {
    if (!block) return;

    // Création du contenu HTML pour l'impression
    const printContent = `
      <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <!-- En-tête avec logo -->
        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #6c5ce7;">
          <div style="width: 50px; height: 50px; flex-shrink: 0;">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="12" fill="#6C5CE7"/>
              <path d="M45.3333 26.6667C45.3333 20.7756 40.5577 16 34.6666 16H16V48H34.6666C40.5577 48 45.3333 43.2244 45.3333 37.3333V26.6667Z" fill="white"/>
              <path d="M48 26.6667C48 20.7756 43.2244 16 37.3333 16H29.3333V48H37.3333C43.2244 48 48 43.2244 48 37.3333V26.6667Z" fill="#E84393"/>
            </svg>
          </div>
          <div>
            <h1 style="color: #2d3436; margin: 0; font-size: 28px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
              <span style="color: #6c5ce7;">Alephium</span>
              <span style="font-weight: 400; color: #636e72; font-size: 0.8em;">Explorer</span>
            </h1>
            <p style="margin: 5px 0 0; color: #636e72; font-size: 14px;">
              Détails du bloc #${block.height}
            </p>
          </div>
        </div>
        
        <div style="margin-top: 20px;">
          <h2>Informations de base</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 200px;">Hauteur</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${block.height}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Hash</td>
              <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${block.hash}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Timestamp</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${new Date(block.timestamp).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Chaîne</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${block.chainFrom} → ${block.chainTo}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Hashrate</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${formatHashrate(block.hashRate)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Nonce</td>
              <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${block.nonce || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Parent Hash</td>
              <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${block.parent || block.parentBlockHash?.[0] || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Merkle Root</td>
              <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${block.txsHash || 'N/A'}</td>
            </tr>
          </table>
          
          <h2>Transactions (${block.txNumber || block.transactions?.length || 0})</h2>
          ${block.transactions && block.transactions.length > 0 ?
        `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left; background: #f5f5f5;">Hash</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left; background: #f5f5f5;">Détails</th>
                </tr>
              </thead>
              <tbody>
                ${block.transactions.map(tx => {
          const txHash = typeof tx === 'string' ? tx : (tx.hash || '');
          return `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">
                        ${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}
                      </td>
                      <td style="padding: 8px; border: 1px solid #ddd;">
                        ${typeof tx === 'string' ? 'Détails non disponibles' : `
                          Entrants: ${tx.inputs?.length || 0}, 
                          Sortants: ${tx.outputs?.length || 0}
                        `}
                      </td>
                    </tr>
                  `;
        }).join('')}
              </tbody>
            </table>` :
        '<p>Aucune transaction</p>'
      }
        </div>
        <div style="margin-top: 20px; font-size: 12px; color: #777; text-align: center;">
          Généré par Alephium Explorer - ${new Date().toLocaleString()}
        </div>
      </div>
    `;

    // Création d'une nouvelle fenêtre pour l'impression
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Détails du Bloc #${block.height} - Alephium Explorer</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #2d3436;
            background-color: #f8f9fa;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          @page {
            margin: 1.5cm;
            @bottom-center {
              content: "Page " counter(page) " sur " counter(pages);
              font-size: 10px;
              color: #95a5a6;
            }
          }
          
          h1, h2, h3 {
            color: #2d3436;
            margin-bottom: 0.5em;
          }
          
          .card {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 14px;
          }
          
          th, td {
            padding: 12px 10px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
          }
          
          th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #2d3436;
          }
          
          tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          
          .monospace {
            font-family: 'Courier New', monospace;
          }
          
          .text-muted {
            color: #95a5a6;
          }
          
          .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
          }
          
          .badge-primary {
            background-color: #e3f2fd;
            color: #1976d2;
          }
          
          .badge-success {
            background-color: #e8f5e9;
            color: #2e7d32;
          }
          
          .text-truncate {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 250px;
            display: inline-block;
            vertical-align: middle;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
            }
            
            .no-print {
              display: none !important;
            }
            
            .card {
              box-shadow: none;
              border: 1px solid #e9ecef;
            }
            
            table {
              font-size: 12px;
            }
            
            th, td {
              padding: 8px 6px;
            }
          }
        </style>
      </head>
      <body>
        ${printContent}
        <script>
          // Ferme la fenêtre après l'impression
          window.onload = function() {
            // Ajout d'un délai pour s'assurer que tout est chargé
            setTimeout(function() {
              window.print();
              // Fermeture après l'impression avec un délai plus long
              setTimeout(function() { 
                window.close(); 
              }, 500);
            }, 300);
          };
          
          // Gestion de la fermeture si l'impression est annulée
          window.onbeforeunload = function() {
            return 'Voulez-vous vraiment quitter cette page ?';
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Scroll to details on block select
  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [block?.hash]);

  if (!block) return null;

  // Dépendances & parent
  const deps = block.deps || [];
  const parent = block.parent || block.parentBlockHash?.[0] || null;
  const ghostUncles = block.ghostUncles || [];
  const isConfirmed = block.mainChain !== false; // true by défaut

  // Relations enfants dynamiques (pour affichage)
  // Correction : Alephium place le parent dans parentBlockHash[0] (ou parent)
  const children = allBlocks
    ? allBlocks.filter(b => {
      const parentHash = b.parentBlockHash?.[0] || b.parent;
      return parentHash === block.hash;
    })
    : (block.children || []);

  return (
    <>
      {showHashrate && (
        <HashrateDetails block={block} onClose={() => setShowHashrate(false)} />
      )}
      <section
        className="block-details-root"
        ref={detailsRef}
        style={{
          width: '100%',
          margin: '0 auto',
          background: '#14141f',
          borderRadius: 15,
          padding: 0,
          boxShadow: 'none',
          border: '1.5px solid #23243a'
        }}
      >
        {/* HEADER RESUME */}
        <div style={{ position: 'absolute', top: 22, right: 32 }}>
          {block && addToWatchlist && removeFromWatchlist && (
            watchlist.includes(block.hash) ? (
              <button
                style={{ background: '#ff6b6b', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginLeft: 8 }}
                onClick={() => removeFromWatchlist(block.hash)}
                title="Retirer de la Watchlist"
              >Retirer ⭐</button>
            ) : (
              <button
                style={{ background: '#3e2c77', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginLeft: 8 }}
                onClick={() => addToWatchlist(block.hash)}
                title="Ajouter à la Watchlist"
              >Ajouter ⭐</button>
            )
          )}
        </div>
        <div
          className="block-header-summary"
          style={{
            background: '#161625',
            color: '#fff',
            padding: '26px 34px 18px 34px',
            borderTopLeftRadius: 15,
            borderTopRightRadius: 15,
            // borderBottom: '1.5px solid #312d40',
            borderBottom: "1.5px solid #23243a",
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 2px 16px #0002',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: "space-between", gap: 18, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--primary-color)',
                letterSpacing: 1
              }}>
                Bloc #{block.height}
              </span>

            </div>
            {watchlist && watchlist.includes(block.hash) && (
              <span title="Bloc surveillé" style={{ color: '#ffe066', fontSize: 22, marginLeft: 2, animation: 'star-pop 0.7s' }}>⭐</span>
            )}
            <div
              style={{
                display: "flex",
                gap: "6px"

              }}>

              <button
                onClick={() => setShowHashrate(true)}
                className='icon-table-button'
                title="Voir comment le hash est calculé"
              >
                <span style={{
                  fontWeight: "400"
                }}>
                  Voir le calcul de hashrate</span>
              </button>
              <button
                onClick={() => printBlockDetails(block)}
                className='icon-table-button'
                title="Imprimer les détails du bloc"
              >
                <span style={{
                  fontWeight: "400"
                }}>
                  Imprimer</span>
              </button>

              <span
                className='icon-table-button'
                style={{
                  background: '#51e1ff',
                  color: '#232c1d',
                  borderRadius: 8,
                  padding: '2px 12px',
                  // marginLeft: 6,
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: 0.5
                }}>
                {block.chainFrom} → {block.chainTo}
              </span>
            </div>

          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 30,

            fontFamily: 'monospace',
            fontSize: 18,
            color: '#b0eaff',
            marginBottom: 2,
          }}>
            <span style={{ fontWeight: 600, letterSpacing: 0.5 }}>{block.hash}</span>
            <div 
            style={{
              display : "flex"
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(block.hash);
                  showToast('Hash copié !');
                }}
                className="icon-table-button"
                title="Copier le hash"
              >
                <svg opacity={0.6} width="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M10 8V7C10 6.05719 10 5.58579 10.2929 5.29289C10.5858 5 11.0572 5 12 5H17C17.9428 5 18.4142 5 18.7071 5.29289C19 5.58579 19 6.05719 19 7V12C19 12.9428 19 13.4142 18.7071 13.7071C18.4142 14 17.9428 14 17 14H16M7 19H12C12.9428 19 13.4142 19 13.7071 18.7071C14 18.4142 14 17.9428 14 17V12C14 11.0572 14 10.5858 13.7071 10.2929C13.4142 10 12.9428 10 12 10H7C6.05719 10 5.58579 10 5.29289 10.2929C5 10.5858 5 11.0572 5 12V17C5 17.9428 5 18.4142 5.29289 18.7071C5.58579 19 6.05719 19 7 19Z" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
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
                <svg opacity={0.6} width="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M13.1667 5H6C5.44772 5 5 5.44772 5 6V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V10.8333M15.5 5H19M19 5V8.5M19 5L9.66667 14.3333" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
              </a>

            </div>



          </div>
          <div style={{ fontSize: 15, marginTop: 4, marginBottom: 14, color: '#fff', opacity: 0.75 }}>
            {new Date(block.timestamp).toLocaleString()}
          </div>
          <span style={{
                    display: 'inline-block',
                    fontWeight: 700,
                    fontSize: 15,
                    borderRadius: 8,
                    padding: '4px 8px',
                    marginLeft: 4,
                    background: block.mainChain !== false ? '#0f3b396b' : '#ffb347',
                    color: block.mainChain !== false ? '#b2dae2' : '#222',
                    letterSpacing: 0.2,
                    height: 'fit-content',
                    width: 'fit-content'
                  }}>{block.mainChain !== false ? 'Confirmé' : 'Non confirmé'}</span>
        </div>

        <div
          className="block-details-columns"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 34,
            padding: '36px 34px 22px 34px',
            background: 'transparent'
          }}
        >
          {/* COLONNE 1 */}
          <div
            style={{
              flex: '1 1 320px',
              minWidth: 320,
              background: 'rgba(60,0,80,0.09)',
              borderRadius: 11,
              padding: '30px 28px 26px 28px',
              marginBottom: 12,
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 16px rgba(40,10,60,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#d6c6eb', marginBottom: 11 }}>Identité & Statistiques</div>
            <Detail label="Timestamp" value={new Date(block.timestamp).toLocaleString()} />
            <Detail label="Hauteur" value={block.height} />
            <Detail label="Chaîne" value={<b>{block.chainFrom} → {block.chainTo}</b>} />
            <Detail label="Version" value={block.version} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Detail label="Hashrate" value={formatHashrate(block.hashRate)} />
            </div>
            <Detail label="Nonce" value={<code style={{ color: "#b0eaff" }}>{block.nonce}</code>} mono />
            <Detail label="Target" value={block.target} mono />
            <Detail label="depStateHash" value={shorten(block.depStateHash, 14)} mono />
          </div>

          {/* COLONNE 2 */}
          <div
            style={{
              flex: '2 1 420px',
              minWidth: 350,
              background: 'rgba(0,100,200,0.04)',
              borderRadius: 11,
              padding: '30px 28px 20px 28px',
              marginBottom: 12,
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 16px rgba(10,90,100,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#51e1ff', marginBottom: 13 }}>Blockflow / DAG</div>
            <Detail label="Parent principal" value={<code style={{ color: "#51e1ff" }}>{parent || "N/A"}</code>} mono />
            <div className="detail-row" style={{ margin: '7px 0 5px 0', fontWeight: 600 }}>
              Dépendances (Blockflow/DAG) :
            </div>
            <div
              className="deps-list"
              style={{
                display: 'inline-block',
                border: "1px solid #2a2936",
                borderRadius: 7,
                background: "#191a22",
                padding: "7px 11px",
                margin: "6px 0 13px 0",
                minHeight: 22,
                maxWidth: 540,
                overflowX: "auto"
              }}>
              {deps.length === 0
                ? <span style={{ color: '#888' }}>Aucune</span>
                : deps.map((dep, idx) =>
                  <code
                    key={dep}
                    className="detail-value"
                    style={{
                      display: 'block',
                      color: parent && dep === parent ? "#fff" : "#83d1ff",
                      fontWeight: parent && dep === parent ? 800 : 400,
                      fontSize: 14,
                      marginBottom: 1,
                    }}>
                    {dep}
                  </code>
                )
              }
            </div>
            <div className="detail-row" style={{ fontWeight: 600 }}>
              Ghost uncles :
              <span style={{ marginLeft: 7, color: "#e2c6ee", fontSize: 14 }}>
                {ghostUncles.length === 0 ? "Aucun" : ghostUncles.map(u => shorten(u.blockHash)).join(", ")}
              </span>
            </div>
          </div>
        </div>

        {/* Relations Parent / Enfant */}
        <div style={{ marginTop: 16, marginBottom: 8, padding: '12px 20px', background: '#191a22', borderRadius: 8, border: '1px solid #2a2936' }}>
          <div style={{ fontWeight: 600, color: '#d6c6eb', marginBottom: 4 }}>Relations Parent / Enfant</div>
          <div style={{ fontSize: 15, color: '#fff' }}>
            <b>Parent :</b> {parent ? <span style={{ color: '#b0eaff' }}>{parent}</span> : 'N/A'}<br />
            <b>Enfants :</b> {children.length > 0 ? children.map((child, idx) => (
              <span key={child.hash} style={{ color: '#b0eaff' }}>
                <a
                  href="#"
                  style={{ color: '#b0eaff', textDecoration: 'underline' }}
                  onClick={e => {
                    e.preventDefault();
                    if (typeof window !== 'undefined') {
                      const ev = new CustomEvent('select-block', { detail: child });
                      window.dispatchEvent(ev);
                    }
                  }}
                >{shorten(child.hash || child, 13)}</a>{idx < children.length - 1 ? ', ' : ''}
              </span>
            )) : <span style={{ color: '#aaa' }}>Aucun</span>}
          </div>
        </div>

        {/* Bouton voir calcul de hashrate */}
        <div style={{ margin: '18px 0 0 0', textAlign: 'right' }}>
          <button
            style={{
              background: 'linear-gradient(90deg,#5e2fff,#b16cff)', color: '#fff', border: 'none', borderRadius: 7, padding: '11px 22px', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 8px #0003', marginBottom: 10
            }}
            onClick={() => setShowHashrate(true)}
          >
            Voir le calcul de hashrate
          </button>
        </div>

        {/* TRANSACTIONS */}
        <div
          style={{
            width: '100%',
            background: 'var(--background-color)',
            borderRadius: '0px 0px 14px 14px',
            margin: '18px 0 0px 0',
            padding: '30px 34px 24px 34px',
            color: '#fff',
            boxShadow: 'none'
          }}
        >
          <div style={{ fontSize: 21, fontWeight: 600, color: "#bdb4ec", marginBottom: 7 }}>
            Transactions
          </div>
          <Detail label="Nombre de transactions" value={block.txNumber ?? (block.transactions?.length || 0)} />
          <Detail label="Merkle root" value={shorten(block.txsHash, 14)} mono />
          {/* Affichage simplifié */}
          {block.transactions && block.transactions.length > 0 && (
            <div className="transactions-list" style={{ marginTop: 11, maxHeight: 320, overflow: "auto" }}>
              {block.transactions.map((tx, idx) => {
                // Supporte string ou objet transaction
                if (typeof tx === 'string') {
                  return (
                    <div key={idx} style={{
                      margin: "8px 0",
                      padding: "10px 16px",
                      background: "#26233a",
                      borderRadius: 8,
                      fontFamily: "monospace",
                      color: "#fff",
                      fontSize: 15
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b>Hash :</b> {shorten(tx, 10)}
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#51e1ff', fontSize: 16, padding: 0 }}
                          title="Copier le hash"
                          onClick={() => { navigator.clipboard.writeText(tx); alert('Hash copié !') }}
                        >📋</button>
                      </div>
                      <div style={{ color: '#888', marginTop: 4 }}>Détails non disponibles</div>
                    </div>
                  );
                }
                const txObj = tx;
                const inputs = txObj.inputs || [];
                const outputs = txObj.outputs || [];
                const total = outputs.reduce((sum, out) => sum + Number(out.value || 0), 0) / 1e18;
                const noDetails = inputs.length === 0 && outputs.length === 0;
                return (
                  <div key={idx} style={{
                    margin: "8px 0",
                    padding: "10px 16px",
                    background: "#26233a",
                    borderRadius: 8,
                    fontFamily: "monospace",
                    color: "#fff",
                    fontSize: 15
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b>Hash :</b> {shorten(txObj.hash || '', 10)}
                      {txObj.hash && (
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#51e1ff', fontSize: 16, padding: 0 }}
                          title="Copier le hash"
                          onClick={() => { navigator.clipboard.writeText(txObj.hash); alert('Hash copié !') }}
                        >📋</button>
                      )}
                    </div>
                    {noDetails ? (
                      <div style={{ color: '#888', marginTop: 4 }}>Détails non disponibles</div>
                    ) : (
                      <>
                        <div>
                          <b>Entrants :</b> {inputs.length > 0
                            ? inputs.map((input, i) => (
                              <span key={i} style={{ color: '#b0eaff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {shorten(input.address || input, 8)}
                                <button
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#51e1ff', fontSize: 14, padding: 0 }}
                                  title="Copier l'adresse"
                                  onClick={() => { navigator.clipboard.writeText(input.address || input); alert('Adresse copiée !') }}
                                >📋</button>
                                {i < inputs.length - 1 ? ', ' : ''}
                              </span>
                            ))
                            : <span style={{ color: '#888' }}>Aucune</span>
                          }
                        </div>
                        <div>
                          <b>Sortants :</b> {outputs.length > 0
                            ? outputs.map((output, i) => (
                              <span key={i} style={{ color: '#77ff99', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {shorten(output.address || output, 8)}
                                <button
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#51e1ff', fontSize: 14, padding: 0 }}
                                  title="Copier l'adresse"
                                  onClick={() => { navigator.clipboard.writeText(output.address || output); alert('Adresse copiée !') }}
                                >📋</button>
                                {i < outputs.length - 1 ? ', ' : ''}
                              </span>
                            ))
                            : <span style={{ color: '#888' }}>Aucune</span>
                          }
                        </div>
                        <div>
                          <b>Montant total :</b> {outputs.length > 0 ? total.toFixed(4) : 'N/A'} ALPH
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
};

function Detail({ label, value, mono }) {
  return (
    <div className="detail-row" style={{
      marginBottom: 6,
      display: 'flex',
      gap: 10,
      alignItems: 'baseline',
      fontFamily: mono ? "monospace" : undefined
    }}>
      <span style={{ color: '#bdb4ec', fontWeight: 500, fontSize: 15, minWidth: 126 }}>{label} :</span>
      <span style={{
        color: mono ? "#b1fff6" : "#da88ff",
        fontWeight: mono ? 500 : 600,
        fontSize: 16,
        wordBreak: 'break-all'
      }}>
        {value}
      </span>
    </div>
  );
}

BlockDetails.propTypes = {
  block: PropTypes.object
};

export default BlockDetails;
