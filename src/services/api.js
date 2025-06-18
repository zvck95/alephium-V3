// src/services/api.js

const BASE_URL = '/api';

// Récupère les derniers blocs (limit par défaut à 10)
export async function getLatestBlocks(limit = BLOCK_FETCH_LIMIT) {
  const response = await fetch(`${BASE_URL}/blocks?limit=${limit}`);
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
  const result = await response.json();
  return result.blocks || result; // s'adapte au retour possible
}

// Vérifie s’il y a de nouveaux blocs depuis la dernière hauteur connue
export async function checkForNewBlocks(lastHeight, limit = 100) {
  const response = await fetch(`${BASE_URL}/blocks?limit=${limit}`);
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
  const result = await response.json();
  const newBlocks = (result.blocks || result).filter(block => block.height > lastHeight);
  return newBlocks; // <-- important
}

// Récupère les détails d'un bloc par son hash (inclut blockDeps)
export async function getBlockDetails(hash) {
  const response = await fetch(`${BASE_URL}/blocks/${hash}`);
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
  return await response.json();
}


