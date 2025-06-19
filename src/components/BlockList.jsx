import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// Couleurs pour chaque chaîne
const CHAIN_COLORS = {
  0: '#6c5ce7',  // Violet
  1: '#00b894',  // Vert
  2: '#0984e3',  // Bleu
  3: '#e17055'   // Orange
};

// Composant de badge pour les indicateurs
const Badge = ({ children, color, icon }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: `${color}15`,
    color: color,
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    marginRight: '6px',
    marginBottom: '4px'
  }}>
    {icon && <span>{icon}</span>}
    {children}
  </span>
);

// Composant de carte de bloc
const BlockCard = ({ block, isNew = false, onClick }) => {
  const timeAgo = formatDistanceToNow(new Date(block.timestamp), { 
    addSuffix: true, 
    locale: fr 
  });

  // Couleur basée sur la chaîne
  const chainColor = CHAIN_COLORS[block.chainFrom] || '#6c5ce7';
  
  return (
    <div 
      onClick={onClick}
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        borderLeft: `4px solid ${chainColor}`,
        transform: isNew ? 'translateX(0)' : 'translateX(0)',
        animation: isNew ? 'highlight 1.5s ease-out' : 'none',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }
      }}
    >
      {/* En-tête de la carte */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: '1px solid #f1f2f6',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: chainColor,
            flexShrink: 0
          }} />
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: '#2d3436'
          }}>
            Bloc #{block.height}
          </h3>
          {isNew && (
            <Badge color="#00b894">
              <span>🆕</span> Nouveau
            </Badge>
          )}
        </div>
        <div style={{
          fontSize: '12px',
          color: '#636e72',
          backgroundColor: '#f8f9fa',
          padding: '2px 8px',
          borderRadius: '10px'
        }}>
          {timeAgo}
        </div>
      </div>

      {/* Corps de la carte */}
      <div style={{ padding: '16px' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <Badge color="#6c5ce7" icon="🔗">
            Chaîne {block.chainFrom} → {block.chainTo}
          </Badge>
          
          <Badge color="#00b894" icon="↗️">
            {block.transactions?.length || 0} transactions
          </Badge>
          
          {block.size && (
            <Badge color="#0984e3" icon="📏">
              {(block.size / 1024).toFixed(2)} KB
            </Badge>
          )}
        </div>

        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '10px',
          borderRadius: '8px',
          marginTop: '8px',
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#2d3436',
          wordBreak: 'break-all',
          maxHeight: '60px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {block.hash}
        </div>
      </div>
    </div>
  );
};

// Style global pour les animations
const globalStyles = `
  @keyframes highlight {
    0% { box-shadow: 0 0 0 0 rgba(108, 92, 231, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(108, 92, 231, 0); }
    100% { box-shadow: 0 0 0 0 rgba(108, 92, 231, 0); }
  }
`;

const BlockList = ({ blocks, loading, error, onBlockClick, newBlockHashes = [] }) => {
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        color: '#636e72',
        fontSize: '16px'
      }}>
        <div style={{
          display: 'inline-block',
          width: '24px',
          height: '24px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #6c5ce7',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginRight: '10px'
        }} />
        Chargement des blocs...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: '#ffebee',
        color: '#c62828',
        padding: '16px',
        borderRadius: '8px',
        margin: '10px 0',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>⚠️</span>
        <div>
          <strong>Erreur :</strong> {error.message || 'Impossible de charger les blocs'}
        </div>
      </div>
    );
  }

  if (!blocks || blocks.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px 20px',
        color: '#636e72',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        margin: '10px 0'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔍</div>
        <h3 style={{ margin: '0 0 8px 0', color: '#2d3436' }}>Aucun bloc trouvé</h3>
        <p style={{ margin: 0 }}>Aucun bloc n'a été trouvé dans la blockchain.</p>
      </div>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      <div style={{
        display: 'grid',
        gap: '12px',
        padding: '16px',
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: '#6c5ce7 #f1f2f6',
        '&::-webkit-scrollbar': {
          width: '6px'
        },
        '&::-webkit-scrollbar-track': {
          background: '#f1f2f6',
          borderRadius: '10px'
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: '#6c5ce7',
          borderRadius: '10px'
        }
      }}>
        {blocks.map((block) => (
          <BlockCard 
            key={block.hash}
            block={block}
            isNew={newBlockHashes.includes(block.hash)}
            onClick={() => onBlockClick && onBlockClick(block)}
          />
        ))}
      </div>
    </>
  );
};

export default BlockList;
