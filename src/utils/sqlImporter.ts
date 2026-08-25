import { Societe, Personne, Famille, Prestation, Paiement, LignePrestation, LignePaiement } from '../types';

export interface SqlImportResult {
  success: boolean;
  message?: string;
  error?: string;
  counts: {
    societes: number;
    personnes: number;
    familles: number;
    prestations: number;
    paiements: number;
    lignesPrestation: number;
    lignesPaiement: number;
  };
  data: {
    societes: Societe[];
    personnes: Personne[];
    familles: Famille[];
    prestations: Prestation[];
    paiements: Paiement[];
  };
}

/**
 * Tokenizer & Parser pour les instructions INSERT INTO de MySQL / phpMyAdmin
 */
function parseSqlInsertValues(sqlText: string, tableName: string): Array<Record<string, any>> {
  const records: Array<Record<string, any>> = [];
  
  // Regex pour trouver tous les blocs INSERT INTO `tableName` ou tableName
  const regex = new RegExp(`INSERT\\s+INTO\\s+[\`"]?${tableName}[\`"]?\\s*(?:\\(([^)]+)\\))?\\s*VALUES\\s*([\\s\\S]*?)(?=INSERT\\s+INTO|DROP\\s+TABLE|CREATE\\s+TABLE|COMMIT|--|\\/\\*|$)`, 'gi');
  
  let match;
  while ((match = regex.exec(sqlText)) !== null) {
    const colNamesRaw = match[1];
    const valuesBlock = match[2];

    let colNames: string[] = [];
    if (colNamesRaw) {
      colNames = colNamesRaw.split(',').map(c => c.trim().replace(/^[`"']|[`"']$/g, '').toLowerCase());
    }

    // Parser les tuples de valeurs: (val1, val2, ...), (val3, val4, ...)
    const rows = parseValueTuples(valuesBlock);
    for (const row of rows) {
      const record: Record<string, any> = {};
      if (colNames.length > 0) {
        colNames.forEach((col, idx) => {
          record[col] = row[idx];
        });
      } else {
        // Sans liste de colonnes explicites
        row.forEach((val, idx) => {
          record[`col_${idx}`] = val;
        });
      }
      records.push(record);
    }
  }

  return records;
}

/**
 * Découpe un bloc de tuples VALUES (...), (...) en tableau de valeurs scalaires/null
 */
function parseValueTuples(block: string): any[][] {
  const results: any[][] = [];
  let inString = false;
  let quoteChar = '';
  let escape = false;
  let inTuple = false;
  let currentTuple: any[] = [];
  let currentVal = '';

  const cleanVal = (valStr: string) => {
    const trimmed = valStr.trim();
    if (trimmed.toUpperCase() === 'NULL') return null;
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    // Supprimer les guillemets englobants
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      let unquoted = trimmed.substring(1, trimmed.length - 1);
      // Remplacer les échappements SQL \' et '' et \\ et \n
      unquoted = unquoted
        .replace(/''/g, "'")
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t');
      return unquoted;
    }
    return trimmed;
  };

  for (let i = 0; i < block.length; i++) {
    const ch = block[i];

    if (escape) {
      currentVal += ch;
      escape = false;
      continue;
    }

    if (ch === '\\') {
      currentVal += ch;
      escape = true;
      continue;
    }

    if (inString) {
      currentVal += ch;
      if (ch === quoteChar) {
        // Vérifier si c'est un double apostrophe standard SQL ''
        if (i + 1 < block.length && block[i + 1] === quoteChar) {
          currentVal += block[i + 1];
          i++; // ignorer le deuxième quote
        } else {
          inString = false;
        }
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = true;
      quoteChar = ch;
      currentVal += ch;
      continue;
    }

    if (ch === '(' && !inTuple) {
      inTuple = true;
      currentTuple = [];
      currentVal = '';
      continue;
    }

    if (ch === ')' && inTuple) {
      currentTuple.push(cleanVal(currentVal));
      results.push(currentTuple);
      currentTuple = [];
      currentVal = '';
      inTuple = false;
      continue;
    }

    if (ch === ',' && inTuple) {
      currentTuple.push(cleanVal(currentVal));
      currentVal = '';
      continue;
    }

    if (ch === ';' && !inTuple) {
      break; // Fin de l'instruction SQL
    }

    if (inTuple) {
      currentVal += ch;
    }
  }

  return results;
}

/**
 * Importe et reconstitue un dump SQL complet en objets métier applicatifs
 */
export function parseMySQLDump(sqlText: string): SqlImportResult {
  try {
    if (!sqlText || typeof sqlText !== 'string' || sqlText.trim().length === 0) {
      return {
        success: false,
        error: 'Le fichier SQL est vide ou illisible.',
        counts: { societes: 0, personnes: 0, familles: 0, prestations: 0, paiements: 0, lignesPrestation: 0, lignesPaiement: 0 },
        data: { societes: [], personnes: [], familles: [], prestations: [], paiements: [] }
      };
    }

    // 1. Parser les tables brutes
    const rawSocietes = parseSqlInsertValues(sqlText, 'societes');
    const rawFamilles = parseSqlInsertValues(sqlText, 'familles');
    const rawPersonnes = parseSqlInsertValues(sqlText, 'personnes');
    const rawLignesPrestation = parseSqlInsertValues(sqlText, 'lignes_prestation');
    const rawPrestations = parseSqlInsertValues(sqlText, 'prestations');
    const rawLignesPaiement = parseSqlInsertValues(sqlText, 'lignes_paiement');
    const rawPaiements = parseSqlInsertValues(sqlText, 'paiements');

    // Indexer les lignes de prestation par prestation_id
    const lignesPrestationByPrestId: Record<string, LignePrestation[]> = {};
    rawLignesPrestation.forEach(r => {
      let lpObj: LignePrestation | null = null;
      if (r.data) {
        try {
          lpObj = JSON.parse(r.data);
        } catch {}
      }
      if (!lpObj) {
        lpObj = {
          id: String(r.id || ''),
          code: String(r.code || 'CONS'),
          libelle: r.libelle || '',
          totalPrestation: Number(r.total_prestation || 0),
          ticketModerateur: Number(r.ticket_moderateur || 0),
          montantARembourser: Number(r.montant_a_rembourser || 0),
          totalPaye: Number(r.total_paye || 0),
          montantExclu: Number(r.montant_exclu || 0),
          motifExclusion: r.motif_exclusion || null,
          statut: (r.statut as any) || 'En attente',
        };
      }
      const pid = String(r.prestation_id || (lpObj as any).prestationId || '');
      if (pid) {
        if (!lignesPrestationByPrestId[pid]) lignesPrestationByPrestId[pid] = [];
        lignesPrestationByPrestId[pid].push(lpObj);
      }
    });

    // Indexer les lignes de paiement par paiement_id
    const lignesPaiementByPaiId: Record<string, LignePaiement[]> = {};
    rawLignesPaiement.forEach(r => {
      let lpObj: LignePaiement | null = null;
      if (r.data) {
        try {
          lpObj = JSON.parse(r.data);
        } catch {}
      }
      if (!lpObj) {
        let actesPayes: any[] = [];
        if (r.actes_payes) {
          try {
            actesPayes = JSON.parse(r.actes_payes);
          } catch {}
        }
        lpObj = {
          id: String(r.id || ''),
          paiementId: String(r.paiement_id || ''),
          lignePrestationId: r.ligne_prestation_id || undefined,
          prestationId: r.prestation_id || undefined,
          immatriculation: r.immatriculation || undefined,
          nomBaseAssurance: r.nom_base_assurance || undefined,
          nomAgent: r.nom_agent || undefined,
          prestationNumero: r.prestation_numero || undefined,
          dateSoins: r.date_soins || undefined,
          totalPaye: Number(r.total_paye || 0),
          montantPaye: Number(r.total_paye || 0),
          ticketModerateur: Number(r.ticket_moderateur || 0),
          montantExclu: Number(r.montant_exclu || 0),
          montantReclame: Number(r.montant_reclame || 0),
          actesPayes: actesPayes.length > 0 ? actesPayes : undefined,
          commentaire: r.commentaire || undefined,
        };
      }
      const pmid = String(r.paiement_id || (lpObj as any).paiementId || '');
      if (pmid) {
        if (!lignesPaiementByPaiId[pmid]) lignesPaiementByPaiId[pmid] = [];
        lignesPaiementByPaiId[pmid].push(lpObj);
      }
    });

    // 2. Reconstituer Sociétés
    const societes: Societe[] = rawSocietes.map(r => {
      if (r.data) {
        try {
          return JSON.parse(r.data);
        } catch {}
      }
      return {
        id: String(r.id || ''),
        nom: String(r.nom || ''),
        code: String(r.code || ''),
        contact: r.contact || '',
        telephone: r.telephone || '',
        email: r.email || '',
        adresse: r.adresse || '',
        tauxCouvertureDefaut: Number(r.taux_couverture_defaut ?? 80),
      };
    });

    // 3. Reconstituer Familles
    const familles: Famille[] = rawFamilles.map(r => {
      if (r.data) {
        try {
          return JSON.parse(r.data);
        } catch {}
      }
      let aliases: string[] = [];
      if (r.aliases) {
        try {
          aliases = JSON.parse(r.aliases);
        } catch {}
      }
      return {
        id: String(r.id || ''),
        code: String(r.code || ''),
        libelle: String(r.libelle || ''),
        plafondAnnuel: r.plafond_annuel ? Number(r.plafond_annuel) : undefined,
        tauxStandard: r.taux_standard ? Number(r.taux_standard) : undefined,
        tarifConventionne: r.tarif_conventionne ? Number(r.tarif_conventionne) : undefined,
        ticketModerateurDefaut: r.ticket_moderateur_defaut ? Number(r.ticket_moderateur_defaut) : undefined,
        description: r.description || '',
        aliases,
      };
    });

    // 4. Reconstituer Personnes
    const personnes: Personne[] = rawPersonnes.map(r => {
      if (r.data) {
        try {
          return JSON.parse(r.data);
        } catch {}
      }
      return {
        id: String(r.id || ''),
        nomPrenom: String(r.nom_prenom || ''),
        matricule: String(r.matricule || ''),
        societeId: String(r.societe_id || ''),
        sousSociete: r.sous_societe || undefined,
        qualite: (r.qualite as any) || 'Adhérent Principal',
        familleCode: r.famille_code || undefined,
        dateNaissance: r.date_naissance || undefined,
        telephone: r.telephone || undefined,
        email: r.email || undefined,
        tauxCouverture: r.taux_couverture ? Number(r.taux_couverture) : undefined,
        statut: (r.statut as any) || 'Actif',
      };
    });

    // 5. Reconstituer Prestations
    const prestations: Prestation[] = rawPrestations.map(r => {
      let pObj: Prestation | null = null;
      if (r.data) {
        try {
          pObj = JSON.parse(r.data);
        } catch {}
      }

      const pId = String(r.id || pObj?.id || '');
      const attachedLignes = lignesPrestationByPrestId[pId] || [];

      if (pObj) {
        if (!pObj.lignes || pObj.lignes.length === 0) {
          pObj.lignes = attachedLignes;
        }
        return pObj;
      }

      const totalPrestation = Number(r.total_prestation || 0);
      const participation = Number(r.participation || 0);
      const montantARembourser = Number(r.montant_a_rembourser || Math.max(0, totalPrestation - participation));
      const totalPaye = Number(r.total_paye || 0);
      const montantExclu = Number(r.montant_exclu || 0);
      const resteAPayer = Number(r.reste_a_payer || Math.max(0, montantARembourser - totalPaye - montantExclu));

      return {
        id: pId,
        numeroFacture: String(r.numero_facture || ''),
        date: String(r.date || ''),
        societeId: String(r.societe_id || ''),
        societeNom: r.societe_nom || undefined,
        sousSociete: r.sous_societe || undefined,
        personneId: r.personne_id || undefined,
        nomAgent: r.nom_agent || undefined,
        matricule: r.matricule || undefined,
        totalPrestation,
        montantTotal: totalPrestation,
        participation,
        ticketModerateur: participation,
        montantARembourser,
        totalPaye,
        montantExclu,
        motifExclusion: r.motif_exclusion || undefined,
        resteAPayer,
        statut: (r.statut as any) || 'En attente',
        dateCreation: r.date_creation || undefined,
        datePaiement: r.date_paiement || undefined,
        numeroBordereau: r.numero_bordereau || undefined,
        commentaires: r.commentaires || undefined,
        lignes: attachedLignes.length > 0 ? attachedLignes : [
          {
            id: `${pId}-lig-1`,
            prestationId: pId,
            code: 'CONS',
            libelle: 'Prestation médicale',
            totalPrestation,
            ticketModerateur: participation,
            montantARembourser,
            totalPaye,
            statut: (r.statut as any) || 'En attente',
          }
        ],
      };
    });

    // 6. Reconstituer Paiements
    const paiements: Paiement[] = rawPaiements.map(r => {
      let pmObj: Paiement | null = null;
      if (r.data) {
        try {
          pmObj = JSON.parse(r.data);
        } catch {}
      }

      const pmId = String(r.id || pmObj?.id || '');
      const attachedLignes = lignesPaiementByPaiId[pmId] || [];

      if (pmObj) {
        if (!pmObj.lignes || pmObj.lignes.length === 0) {
          pmObj.lignes = attachedLignes;
        }
        return pmObj;
      }

      return {
        id: pmId,
        numeroBordereau: String(r.numero_bordereau || ''),
        datePaiement: String(r.date_paiement || ''),
        dateSoins: r.date_soins || undefined,
        dateSaisie: r.date_saisie || undefined,
        societeId: String(r.societe_id || ''),
        societeNom: r.societe_nom || undefined,
        sousSociete: r.sous_societe || undefined,
        nomAgent: r.nom_agent || undefined,
        matricule: r.matricule || undefined,
        prestationId: r.prestation_id || undefined,
        prestationNumero: r.prestation_numero || undefined,
        modePaiement: (r.mode_paiement as any) || 'Virement bancaire',
        referencePaiement: r.reference_paiement || undefined,
        totalReclame: Number(r.total_reclame || 0),
        totalPaye: Number(r.total_paye || 0),
        totalModerateur: Number(r.total_moderateur || 0),
        totalExclu: Number(r.total_exclu || 0),
        remise: Number(r.remise || 0),
        statut: (r.statut as any) || 'Validé',
        notes: r.notes || undefined,
        lignes: attachedLignes,
      };
    });

    return {
      success: true,
      message: `Restauration SQL réussie : ${prestations.length} prestations, ${paiements.length} règlements, ${personnes.length} adhérents, ${societes.length} sociétés.`,
      counts: {
        societes: societes.length,
        personnes: personnes.length,
        familles: familles.length,
        prestations: prestations.length,
        paiements: paiements.length,
        lignesPrestation: rawLignesPrestation.length,
        lignesPaiement: rawLignesPaiement.length,
      },
      data: {
        societes,
        personnes,
        familles,
        prestations,
        paiements,
      }
    };
  } catch (err: any) {
    console.error('Erreur parseMySQLDump:', err);
    return {
      success: false,
      error: `Erreur lors de l'analyse du fichier SQL : ${err.message || err}`,
      counts: { societes: 0, personnes: 0, familles: 0, prestations: 0, paiements: 0, lignesPrestation: 0, lignesPaiement: 0 },
      data: { societes: [], personnes: [], familles: [], prestations: [], paiements: [] }
    };
  }
}
