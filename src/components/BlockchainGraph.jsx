import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';

// Constantes de configuration
const VERTICAL_GAP = 150;
const GROUP_LINE_Y0 = 130;
const NODE_RADIUS = 24; // Légèrement augmenté pour une meilleure visibilité
const BLOCK_GAP_X = 140; // Espacement accru entre les blocs
const HEIGHT = 850; // Hauteur légèrement augmentée pour la légende
const LABEL_WIDTH = 100;
const TRANSITION_DURATION = 300;

// Couleurs et thème
const THEME = {
  chains: {
    0: { color: '#6c5ce7', gradient: ['#6c5ce7', '#a29bfe'] },
    1: { color: '#00b894', gradient: ['#00b894', '#55efc4'] },
    2: { color: '#0984e3', gradient: ['#0984e3', '#74b9ff'] },
    3: { color: '#e17055', gradient: ['#e17055', '#fab1a0'] },
  },
  links: {
    parent: { color: '#6c5ce7', width: 1.5, opacity: 0.8 },
    child: { color: '#b5c7e1', width: 0.5, opacity: 0.4 },
  },
  node: {
    selected: { fill: '#83d1ff', stroke: '#4fa8e0' },
    new: { fill: '#ff7675', stroke: '#d63031' },
    default: { fill: '#f8f9fa', stroke: '#dfe6e9' },
    text: { color: '#2d3436', size: 11 },
  },
  background: '#ffffff',
  grid: { color: '#f1f2f6', width: 1 },
  legend: {
    background: 'rgba(255, 255, 255, 0.9)',
    border: '1px solid #dfe6e9',
    borderRadius: '8px',
    padding: '10px',
  },
};

// Styles en ligne pour remplacer styled-components
const graphContainerStyle = {
  display: 'flex',
  width: '100%',
  minHeight: `${HEIGHT}px`,
  background: THEME.background,
  borderRadius: '12px',
  overflow: 'hidden',
  position: 'relative',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
};

const stickyLabelsStyle = {
  width: `${LABEL_WIDTH}px`,
  minWidth: `${LABEL_WIDTH}px`,
  background: THEME.background,
  borderRight: '1px solid #eee',
  position: 'sticky',
  left: 0,
  top: 0,
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: `${GROUP_LINE_Y0 - 80}px`,
  paddingRight: '15px',
  pointerEvents: 'none'
};

const scrollContainerStyle = {
  overflowX: 'auto',
  overflowY: 'hidden',
  width: '100%',
  minHeight: `${HEIGHT}px`,
  position: 'relative',
  scrollBehavior: 'smooth',
  '&::-webkit-scrollbar': {
    height: '8px'
  },
  '&::-webkit-scrollbar-track': {
    background: '#f1f2f6'
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#6c5ce7',
    borderRadius: '4px'
  }
};

const legendContainerStyle = {
  position: 'absolute',
  bottom: '20px',
  right: '20px',
  background: THEME.legend.background,
  border: THEME.legend.border,
  borderRadius: THEME.legend.borderRadius,
  padding: THEME.legend.padding,
  zIndex: 100,
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
};

const legendItemStyle = {
  display: 'flex',
  alignItems: 'center',
  margin: '5px 0',
  fontSize: '12px',
  color: '#2d3436'
};

const legendColorStyle = (color, border = 'transparent') => ({
  width: '12px',
  height: '12px',
  borderRadius: '3px',
  marginRight: '8px',
  backgroundColor: color,
  border: `1px solid ${border}`,
  borderColor: border === 'transparent' ? 'transparent' : border
});

// Fonction utilitaire pour arrondir les timestamps
function roundTimestamp(ts) {
  return Math.round(ts / 1000);
}

// Fonction pour générer un dégradé SVG
const generateGradient = (defs, id, colors) => {
  const gradient = defs.append('linearGradient')
    .attr('id', id)
    .attr('gradientUnits', 'userSpaceOnUse')
    .attr('x1', 0).attr('y1', -NODE_RADIUS)
    .attr('x2', 0).attr('y2', NODE_RADIUS);

  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', colors[0]);
    
  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', colors[1]);
    
  return gradient;
};

const BlockchainGraph = ({ blocks, onBlockSelect, newBlocks, selectedBlock }) => {
  const svgRef = useRef();
  const wrapperRef = useRef();
  const [autoFollow, setAutoFollow] = React.useState(true);
  const [hoveredBlock, setHoveredBlock] = React.useState(null);
  const [visibleChains, setVisibleChains] = React.useState({ 0: true, 1: true, 2: true, 3: true });
  const [tooltip, setTooltip] = React.useState({ visible: false, x: 0, y: 0, content: null });

  // Gestion du défilement
  const handleScroll = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const nearRight = wrapper.scrollWidth - wrapper.scrollLeft - wrapper.clientWidth < 10;
    setAutoFollow(nearRight);
  };
  
  // Gestion du survol des blocs
  const handleNodeMouseOver = (event, d) => {
    setHoveredBlock(d);
    
    // Mise à jour du style du nœud survolé
    d3.select(event.currentTarget)
      .select('rect')
      .transition()
      .duration(200)
      .attr('stroke-width', 3)
      .attr('filter', 'url(#glow)');
    
    // Affichage du tooltip
    const tooltipContent = `
      <div style="padding: 8px 12px; background: white; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.15);">
        <div style="font-weight: 600; margin-bottom: 4px;">Bloc #${d.height}</div>
        <div style="font-size: 12px; color: #636e72;">
          <div>Chaîne: ${d.chainFrom} → ${d.chainTo}</div>
          <div>Transactions: ${d.transactions?.length || 0}</div>
          <div>Hash: ${d.hash.substring(0, 12)}...${d.hash.substring(d.hash.length - 6)}</div>
        </div>
      </div>
    `;
    
    setTooltip({
      visible: true,
      x: event.pageX,
      y: event.pageY - 10,
      content: tooltipContent
    });
  };
  
  const handleNodeMouseOut = (event) => {
    setHoveredBlock(null);
    
    // Réinitialisation du style du nœud
    d3.select(event.currentTarget)
      .select('rect')
      .transition()
      .duration(200)
      .attr('stroke-width', 2)
      .attr('filter', null);
    
    setTooltip(prev => ({ ...prev, visible: false }));
  };
  
  // Gestion du clic sur une chaîne dans la légende
  const toggleChainVisibility = (chainId) => {
    setVisibleChains(prev => ({
      ...prev,
      [chainId]: !prev[chainId]
    }));
  };
  
  // Filtrage des blocs selon les chaînes visibles
  const filteredBlocks = useMemo(() => {
    if (!blocks) return [];
    return blocks.filter(block => visibleChains[block.chainFrom]);
  }, [blocks, visibleChains]);
  

  // Calcul des dimensions et des données pour le rendu
  const { groups, uniqueTimestamps, svgWidth, nodeData, links } = useMemo(() => {
    const groups = Array.from(new Set(filteredBlocks.map(b => b.chainFrom))).sort((a, b) => a - b);
    const uniqueTimestamps = Array.from(new Set(filteredBlocks.map(b => roundTimestamp(b.timestamp)))).sort((a, b) => a - b);
    const svgWidth = Math.max(BLOCK_GAP_X * uniqueTimestamps.length + 150, 900);
    
    // Préparation des données des nœuds
    const nodeData = [];
    const timestampPositions = {};
    const groupTimestampMap = {};
    
    // Calcul des positions des timestamps
    uniqueTimestamps.forEach((ts, i) => {
      timestampPositions[ts] = BLOCK_GAP_X * i + 80;
    });
    
    // Regroupement des blocs par chaîne et timestamp
    filteredBlocks.forEach(block => {
      const key = `${block.chainFrom}_${roundTimestamp(block.timestamp)}`;
      if (!groupTimestampMap[key]) groupTimestampMap[key] = [];
      groupTimestampMap[key].push(block);
    });
    
    // Calcul des positions des nœuds
    Object.entries(groupTimestampMap).forEach(([key, nodeBlocks]) => {
      const [group, ts] = key.split('_').map(Number);
      const yBase = GROUP_LINE_Y0 + groups.indexOf(group) * VERTICAL_GAP;
      const x = timestampPositions[ts];
      const n = nodeBlocks.length;
      
      nodeBlocks.forEach((block, idx) => {
        const stackOffset = (idx - (n - 1) / 2) * (NODE_RADIUS * 2.2);
        nodeData.push({
          ...block,
          x,
          y: yBase + stackOffset,
          isNew: newBlocks?.some(nb => nb.hash === block.hash),
          isSelected: selectedBlock?.hash === block.hash
        });
      });
    });
    
    // Calcul des liens entre les blocs
    const links = [];
    const parentMap = new Map();
    
    // 1. D'abord, on identifie tous les parents directs
    nodeData.forEach(block => {
      const parentHash = block.parent || (block.parentBlockHash && block.parentBlockHash[0]);
      if (parentHash) {
        const parentNode = nodeData.find(n => n.hash === parentHash);
        if (parentNode) {
          parentMap.set(block.hash, parentHash);
        }
      }
    });

    // 2. Ensuite, on crée tous les liens
    nodeData.forEach(block => {
      // Liens parents directs (même chaîne, hauteur -1)
      const parentHash = parentMap.get(block.hash);
      if (parentHash) {
        const parentNode = nodeData.find(n => n.hash === parentHash);
        if (parentNode) {
          links.push({
            source: parentNode,
            target: block,
            isParent: true,
            isSameChain: parentNode.chainFrom === block.chainFrom
          });
        }
      }

      // Liens de dépendances (deps)
      if (block.deps && Array.isArray(block.deps)) {
        block.deps.forEach(depHash => {
          // On saute si c'est déjà le parent direct
          if (depHash === parentHash) return;
          
          const depNode = nodeData.find(n => n.hash === depHash);
          if (depNode) {
            // Vérifier si le lien existe déjà (dans un sens ou dans l'autre)
            const linkExists = links.some(l => 
              (l.source.hash === depHash && l.target.hash === block.hash) ||
              (l.source.hash === block.hash && l.target.hash === depHash)
            );
            
            if (!linkExists) {
              links.push({
                source: depNode,
                target: block,
                isParent: false,
                isSameChain: depNode.chainFrom === block.chainFrom
              });
            }
          }
        });
      }
    });
    
    return { groups, uniqueTimestamps, svgWidth, nodeData, links };
  }, [filteredBlocks, newBlocks, selectedBlock]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.addEventListener('scroll', handleScroll);
    return () => wrapper.removeEventListener('scroll', handleScroll);
  }, []); 

  useEffect(() => {
    if (!nodeData || nodeData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    // Définition des filtres, dégradés et marqueurs
    const defs = svg.append('defs');
    
    // Filtre de lueur pour les nœuds survolés
    const glowFilter = defs.append('filter')
      .attr('id', 'glow')
      .attr('width', '300%')
      .attr('height', '300%')
      .attr('x', '-100%')
      .attr('y', '-100%');
      
    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '3.5')
      .attr('result', 'coloredBlur');
      
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'coloredBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');
    
    // Flèche pour les liens parents
    defs.append('marker')
      .attr('id', 'arrowhead-parent')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 15)
      .attr('refY', 3)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', THEME.links.parent.color);

    // Flèche pour les dépendances croisées
    defs.append('marker')
      .attr('id', 'arrowhead-cross')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 15)
      .attr('refY', 3)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', '#636e72');
    
    // Création des dégradés pour chaque chaîne
    Object.entries(THEME.chains).forEach(([chainId, chain]) => {
      generateGradient(defs, `gradient-${chainId}`, chain.gradient);
    });
    
    // Lignes de groupe
    svg.append('g')
      .selectAll('line')
      .data(groups)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', svgWidth)
      .attr('y1', (d, i) => GROUP_LINE_Y0 + i * VERTICAL_GAP)
      .attr('y2', (d, i) => GROUP_LINE_Y0 + i * VERTICAL_GAP)
      .attr('stroke', THEME.grid.color)
      .attr('stroke-width', THEME.grid.width)
      .attr('stroke-dasharray', '2,2');

    // Étiquettes de temps
    svg.append('g')
      .selectAll('text')
      .data(uniqueTimestamps)
      .enter()
      .append('text')
      .attr('x', (ts, i) => BLOCK_GAP_X * i + 80)
      .attr('y', HEIGHT - 30)
      .attr('font-size', 12)
      .attr('fill', '#636e72')
      .attr('text-anchor', 'middle')
      .text(ts => new Date(ts * 1000).toLocaleTimeString());

    // Lignes de repère pour les timestamps
    svg.append('g')
      .selectAll('line')
      .data(uniqueTimestamps)
      .enter()
      .append('line')
      .attr('x1', (ts, i) => BLOCK_GAP_X * i + 80)
      .attr('x2', (ts, i) => BLOCK_GAP_X * i + 80)
      .attr('y1', 0)
      .attr('y2', HEIGHT - 40)
      .attr('stroke', '#f1f2f6')
      .attr('stroke-width', 1);

    // Groupe pour les liens
    const linksGroup = svg.append('g');
    
    // 1. Liens parents (pleins, avec flèche)
    const parentLinks = linksGroup
      .selectAll('.parent-link')
      .data(links.filter(link => link.isParent), d => `${d.source.hash}-${d.target.hash}`);

    parentLinks.enter()
      .append('line')
      .attr('class', 'parent-link')
      .attr('stroke', THEME.links.parent.color)
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.9)
      .attr('marker-end', 'url(#arrowhead-parent)')
      .merge(parentLinks)
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    // 2. Liens de dépendances croisées (pointillés fins, gris)
    const crossLinks = linksGroup
      .selectAll('.cross-link')
      .data(links.filter(link => !link.isParent && !link.isSameChain), 
            d => `${d.source.hash}-${d.target.hash}`);

    crossLinks.enter()
      .append('line')
      .attr('class', 'cross-link')
      .attr('stroke', '#95a5a6')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,2')
      .attr('opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead-cross)')
      .merge(crossLinks)
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
      
    // 3. Liens de même chaîne (non parents) - plus discrets
    const sameChainLinks = linksGroup
      .selectAll('.same-chain-link')
      .data(links.filter(link => !link.isParent && link.isSameChain), 
            d => `${d.source.hash}-${d.target.hash}`);

    sameChainLinks.enter()
      .append('line')
      .attr('class', 'same-chain-link')
      .attr('stroke', '#bdc3c7')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.4)
      .merge(sameChainLinks)
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    // Nœuds (blocs)
    const nodeGroups = svg.append('g')
      .selectAll('g')
      .data(nodeData)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => onBlockSelect && onBlockSelect(d))
      .on('mouseover', handleNodeMouseOver)
      .on('mouseout', handleNodeMouseOut);

    // Ajout d'un fond pour l'effet de survol
    nodeGroups.append('rect')
      .attr('x', -NODE_RADIUS - 5)
      .attr('y', -NODE_RADIUS - 5)
      .attr('width', NODE_RADIUS * 2 + 10)
      .attr('height', NODE_RADIUS * 2 + 10)
      .attr('rx', 12)
      .attr('ry', 12)
      .attr('fill', 'transparent')
      .attr('pointer-events', 'none');

    // Cercle extérieur pour l'effet de sélection
    nodeGroups.append('circle')
      .attr('r', NODE_RADIUS + 2)
      .attr('fill', 'none')
      .attr('stroke', d => d.isSelected ? THEME.node.selected.stroke : 'transparent')
      .attr('stroke-width', 3)
      .attr('pointer-events', 'none');

    // Rectangle principal du bloc
    nodeGroups.append('rect')
      .attr('x', -NODE_RADIUS)
      .attr('y', -NODE_RADIUS)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('width', NODE_RADIUS * 2)
      .attr('height', NODE_RADIUS * 2)
      .attr('fill', d => {
        if (d.isSelected) return THEME.node.selected.fill;
        if (d.isNew) return THEME.node.new.fill;
        return `url(#gradient-${d.chainFrom})`;
      })
      .attr('stroke', d => {
        if (d.isSelected) return THEME.node.selected.stroke;
        if (d.isNew) return THEME.node.new.stroke;
        return THEME.node.default.stroke;
      })
      .attr('stroke-width', 2)
      .attr('class', d => d.isNew ? 'node-new-block' : '')
      .attr('filter', null);

    // Texte du numéro de bloc
    nodeGroups.append('text')
      .attr('y', -2)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.isNew || d.isSelected ? 'white' : THEME.node.text.color)
      .attr('font-size', THEME.node.text.size)
      .attr('font-weight', '600')
      .text(d => d.height);

    // Texte de la chaîne source et cible
    nodeGroups.append('text')
      .attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.isNew || d.isSelected ? 'rgba(255,255,255,0.9)' : '#636e72')
      .attr('font-size', THEME.node.text.size - 1)
      .text(d => `${d.chainFrom}→${d.chainTo}`);
      
    // Animation pour les nouveaux blocs
    if (newBlocks && newBlocks.length > 0) {
      svg.selectAll('.node-new-block')
        .transition()
        .duration(1000)
        .attr('transform', d => `translate(${d.x},${d.y}) scale(1.1)`)
        .transition()
        .duration(500)
        .attr('transform', d => `translate(${d.x},${d.y})`);
    }


    
  }, [blocks, newBlocks, onBlockSelect, svgWidth]);

  function scrollToRightSmooth(elem, duration = 800) {
    if (!elem) return;
    const start = elem.scrollLeft;
    const end = elem.scrollWidth - elem.clientWidth;
    const change = end - start;
    const startTime = performance.now();
  
    function animateScroll(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      elem.scrollLeft = start + change * easeOutCubic(progress);
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    }
  
    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }
  
    requestAnimationFrame(animateScroll);
  }
  

  useEffect(() => {
    if (autoFollow && wrapperRef.current && blocks.length > 0) {
      setTimeout(() => {
        scrollToRightSmooth(wrapperRef.current);
      }); // 50ms laisse à React/D3 le temps de peindre les nouveaux nœuds
    }
  }, [blocks, autoFollow]);
  
  
  
  // Affichage principal avec légende interactive
  return (
    <div style={graphContainerStyle}>
      {/* Colonne des labels de groupe à gauche */}
      <div style={stickyLabelsStyle}>
        {groups.map((g) => (
          <div
            key={g}
            style={{
              height: VERTICAL_GAP,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              fontSize: 14,
              color: THEME.chains[g]?.color || '#b3b3b3',
              fontWeight: 600,
              marginBottom: 2,
              width: '100%',
              paddingRight: 10,
              position: 'relative',
              cursor: 'pointer',
              pointerEvents: 'auto',
              opacity: visibleChains[g] ? 1 : 0.4,
              transition: 'opacity 0.2s ease',
            }}
            onClick={() => toggleChainVisibility(g)}
            onMouseEnter={(e) => {
              if (!visibleChains[g]) {
                e.currentTarget.style.opacity = '0.7';
              }
            }}
            onMouseLeave={(e) => {
              if (!visibleChains[g]) {
                e.currentTarget.style.opacity = '0.4';
              }
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: THEME.chains[g]?.color || '#b3b3b3',
              marginRight: '8px',
              flexShrink: 0,
              opacity: visibleChains[g] ? 1 : 0.6,
            }} />
            <span>Groupe {g}</span>
          </div>
        ))}
      </div>

      {/* Zone de défilement du graphe */}
      <div 
        ref={wrapperRef}
        onScroll={handleScroll}
        style={scrollContainerStyle}
      >
        <svg 
          ref={svgRef} 
          height={HEIGHT} 
          style={{ display: 'block' }} 
          width={svgWidth}
        />
      </div>

      {/* Légende interactive */}
      <div style={legendContainerStyle}>
        <div style={{ 
          marginBottom: '8px', 
          fontWeight: '600',
          color: '#2d3436',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>Légende</span>
          <span style={{ 
            fontSize: '10px', 
            color: '#636e72',
            fontWeight: 'normal'
          }}>
            Cliquez pour filtrer
          </span>
        </div>
        
        <div style={legendItemStyle} onClick={() => toggleChainVisibility(0)}>
          <div 
            style={{
              ...legendColorStyle(
                THEME.chains[0].gradient[0], 
                THEME.chains[0].gradient[1]
              ),
              background: `linear-gradient(135deg, ${THEME.chains[0].gradient[0]}, ${THEME.chains[0].gradient[1]})`
            }}
          />
          <span style={{ opacity: visibleChains[0] ? 1 : 0.5 }}>Chaîne 0</span>
        </div>
        
        <div style={legendItemStyle} onClick={() => toggleChainVisibility(1)}>
          <div 
            style={{
              ...legendColorStyle(
                THEME.chains[1].gradient[0], 
                THEME.chains[1].gradient[1]
              ),
              background: `linear-gradient(135deg, ${THEME.chains[1].gradient[0]}, ${THEME.chains[1].gradient[1]})`
            }}
          />
          <span style={{ opacity: visibleChains[1] ? 1 : 0.5 }}>Chaîne 1</span>
        </div>
        
        <div style={legendItemStyle} onClick={() => toggleChainVisibility(2)}>
          <div 
            style={{
              ...legendColorStyle(
                THEME.chains[2].gradient[0], 
                THEME.chains[2].gradient[1]
              ),
              background: `linear-gradient(135deg, ${THEME.chains[2].gradient[0]}, ${THEME.chains[2].gradient[1]})`
            }}
          />
          <span style={{ opacity: visibleChains[2] ? 1 : 0.5 }}>Chaîne 2</span>
        </div>
        
        <div style={legendItemStyle} onClick={() => toggleChainVisibility(3)}>
          <div 
            style={{
              ...legendColorStyle(
                THEME.chains[3].gradient[0], 
                THEME.chains[3].gradient[1]
              ),
              background: `linear-gradient(135deg, ${THEME.chains[3].gradient[0]}, ${THEME.chains[3].gradient[1]})`
            }}
          />
          <span style={{ opacity: visibleChains[3] ? 1 : 0.5 }}>Chaîne 3</span>
        </div>
        
        <div style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
          <div style={legendItemStyle}>
            <div style={legendColorStyle('transparent', '#6c5ce7')} />
            <span>Lien parent</span>
          </div>
          <div style={legendItemStyle}>
            <div style={{ ...legendColorStyle('transparent', '#ff4757'), borderStyle: 'dashed' }} />
            <span style={{ color: '#ff4757' }}>Lien enfant</span>
          </div>
          <div style={legendItemStyle}>
            <div style={legendColorStyle('#ff7675', '#d63031')} />
            <span>Nouveau bloc</span>
          </div>
          <div style={legendItemStyle}>
            <div style={legendColorStyle('#83d1ff', '#4fa8e0')} />
            <span>Sélectionné</span>
          </div>
        </div>
      </div>

      {/* Tooltip pour les blocs */}
      {tooltip.visible && (
        <div style={{
          position: 'fixed',
          left: `${tooltip.x + 15}px`,
          top: `${tooltip.y}px`,
          zIndex: 1000,
          pointerEvents: 'none',
          transition: 'opacity 0.2s',
          opacity: tooltip.visible ? 1 : 0,
          transform: 'translateY(-50%)',
          background: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          border: '1px solid #eee',
          maxWidth: '300px',
          fontSize: '12px',
          lineHeight: '1.4',
        }} dangerouslySetInnerHTML={{ __html: tooltip.content }} />
      )}
    </div>
  );
};

export default BlockchainGraph;