import React from 'react';
import PropTypes from 'prop-types';

const HashrateDetails = ({ block, onClose }) => {
  if (!block) return null;
  const fields = [
    { label: 'Parent Hash', value: block.parent || block.parentBlockHash?.[0] || 'N/A' },
    { label: 'Merkle root', value: block.txsHash || 'N/A' },
    { label: 'DeepStateHash', value: block.depStateHash || 'N/A' },
    { label: 'Timestamp', value: block.timestamp || 'N/A' },
    { label: 'Nonce', value: block.nonce || 'N/A' },
    { label: 'Chaîne', value: `${block.chainFrom} → ${block.chainTo}` },
  ];

  return (
    <div className="hashrate-modal-overlay">
      <div className="hashrate-modal">
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2 style={{ color: '#bdb4ec', marginBottom: 16 }}>Comment le hash du bloc est calculé ?</h2>
        <table className="hashrate-table">
          <thead>
            <tr><th>Champ</th><th>Valeur</th></tr>
          </thead>
          <tbody>
            {fields.map(f => (
              <tr key={f.label}>
                <td style={{ fontWeight: 600 }}>{f.label}</td>
                <td style={{ fontFamily: 'monospace', color: '#b0eaff' }}>{f.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hashrate-steps" style={{ marginTop: 24, color: '#e2e2e2', fontSize: 15 }}>
          <ol>
            <li><b>Assemblage du header</b> (dans l'ordre ci-dessus).</li>
            <li><b>Encodage binaire canonique</b> (little-endian + varints). Chaque champ est converti en bytes. Les longueurs sont préfixées si nécessaire.</li>
            <li><b>deepStateHash</b> est calculé à partir du DAG d'états et ajouté au header.</li>
            <li>Le tout est passé à la fonction <b>Blake2b-256</b>.</li>
            <li>Le résultat est le hash du bloc courant.</li>
          </ol>
          <div style={{ marginTop: 12, fontStyle: 'italic', color: '#a0a0e0' }}>
            Pourquoi <b>Blake2b-256</b> ? Rapide, sécurisé, et déjà utilisé dans Alephium.<br />
            <b>Relations Parent / Enfant :</b> Chaque bloc fait référence au hash du parent. Modifier un bloc change son hash, impactant la chaîne de confiance et invalidant tous les blocs enfants.
          </div>
        </div>
      </div>
      <style>{`
        .hashrate-modal-overlay {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(20,16,32,0.92); z-index: 1000; display: flex; align-items: center; justify-content: center;
        }
        .hashrate-modal {
          background: #181521; border-radius: 16px; padding: 34px 38px 28px 38px; min-width: 480px; max-width: 700px; box-shadow: 0 8px 40px #0008; position: relative;
        }
        .close-btn {
          position: absolute; top: 14px; right: 18px; background: transparent; border: none; color: #fff; font-size: 22px; cursor: pointer;
        }
        .hashrate-table {
          width: 100%; margin-bottom: 18px; border-collapse: collapse;
        }
        .hashrate-table th, .hashrate-table td {
          border: 1px solid #322c4d; padding: 7px 13px;
        }
        .hashrate-table th {
          background: #221a35; color: #e2c6ee; font-size: 15px;
        }
      `}</style>
    </div>
  );
};

HashrateDetails.propTypes = {
  block: PropTypes.object,
  onClose: PropTypes.func
};

export default HashrateDetails;
