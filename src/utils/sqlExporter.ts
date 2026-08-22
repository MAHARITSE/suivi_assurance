import { Societe, Personne, Famille, Prestation, Paiement } from '../types';

function escapeSQL(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (Array.isArray(val) || typeof val === 'object') {
    val = JSON.stringify(val);
  }
  const str = String(val);
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  return `'${escaped}'`;
}

export function generateMySQLDump(data: {
  societes: Societe[];
  personnes: Personne[];
  familles: Famille[];
  prestations: Prestation[];
  paiements: Paiement[];
}): string {
  const lines: string[] = [];

  lines.push(`-- ========================================================`);
  lines.push(`-- EXPORT BASE DE DONNÉES MYSQL - SUIVI ASSURANCE SALFA`);
  lines.push(`-- Date d'export : ${new Date().toISOString()}`);
  lines.push(`-- Compatible avec : WAMP Server / MySQL 5.7+ / MySQL 8.0+ / MariaDB / phpMyAdmin`);
  lines.push(`-- ========================================================`);
  lines.push(``);
  lines.push(`CREATE DATABASE IF NOT EXISTS \`suivi_assurance_salfa\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  lines.push(`USE \`suivi_assurance_salfa\`;`);
  lines.push(``);
  lines.push(`SET FOREIGN_KEY_CHECKS = 0;`);
  lines.push(``);

  // Table societes
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`-- Structure de la table \`societes\``);
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`DROP TABLE IF EXISTS \`societes\`;`);
  lines.push(`CREATE TABLE \`societes\` (`);
  lines.push(`  \`id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`nom\` VARCHAR(255) NOT NULL,`);
  lines.push(`  \`code\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`contact\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`telephone\` VARCHAR(100) DEFAULT NULL,`);
  lines.push(`  \`email\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`adresse\` TEXT DEFAULT NULL,`);
  lines.push(`  \`taux_couverture_defaut\` DECIMAL(5,2) DEFAULT 80.00,`);
  lines.push(`  PRIMARY KEY (\`id\`)`);
  lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push(``);

  if (data.societes && data.societes.length > 0) {
    lines.push(`-- Contenu de la table \`societes\``);
    lines.push(`INSERT INTO \`societes\` (\`id\`, \`nom\`, \`code\`, \`contact\`, \`telephone\`, \`email\`, \`adresse\`, \`taux_couverture_defaut\`) VALUES`);
    const values = data.societes.map(s => 
      `(${escapeSQL(s.id)}, ${escapeSQL(s.nom)}, ${escapeSQL(s.code)}, ${escapeSQL(s.contact)}, ${escapeSQL(s.telephone)}, ${escapeSQL(s.email)}, ${escapeSQL(s.adresse)}, ${escapeSQL(s.tauxCouvertureDefaut ?? 80)})`
    );
    lines.push(values.join(',\n') + ';');
    lines.push(``);
  }

  // Table personnes
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`-- Structure de la table \`personnes\``);
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`DROP TABLE IF EXISTS \`personnes\`;`);
  lines.push(`CREATE TABLE \`personnes\` (`);
  lines.push(`  \`id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`nom_prenom\` VARCHAR(255) NOT NULL,`);
  lines.push(`  \`matricule\` VARCHAR(100) NOT NULL,`);
  lines.push(`  \`societe_id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`sous_societe\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`qualite\` VARCHAR(100) DEFAULT NULL,`);
  lines.push(`  \`famille_code\` VARCHAR(50) DEFAULT NULL,`);
  lines.push(`  \`date_naissance\` VARCHAR(20) DEFAULT NULL,`);
  lines.push(`  \`telephone\` VARCHAR(100) DEFAULT NULL,`);
  lines.push(`  \`email\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`taux_couverture\` DECIMAL(5,2) DEFAULT NULL,`);
  lines.push(`  \`statut\` VARCHAR(50) DEFAULT 'Actif',`);
  lines.push(`  PRIMARY KEY (\`id\`)`);
  lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push(``);

  if (data.personnes && data.personnes.length > 0) {
    lines.push(`-- Contenu de la table \`personnes\``);
    lines.push(`INSERT INTO \`personnes\` (\`id\`, \`nom_prenom\`, \`matricule\`, \`societe_id\`, \`sous_societe\`, \`qualite\`, \`famille_code\`, \`date_naissance\`, \`telephone\`, \`email\`, \`taux_couverture\`, \`statut\`) VALUES`);
    const values = data.personnes.map(p => 
      `(${escapeSQL(p.id)}, ${escapeSQL(p.nomPrenom)}, ${escapeSQL(p.matricule)}, ${escapeSQL(p.societeId)}, ${escapeSQL(p.sousSociete)}, ${escapeSQL(p.qualite)}, ${escapeSQL(p.familleCode)}, ${escapeSQL(p.dateNaissance)}, ${escapeSQL(p.telephone)}, ${escapeSQL(p.email)}, ${escapeSQL(p.tauxCouverture)}, ${escapeSQL(p.statut || 'Actif')})`
    );
    lines.push(values.join(',\n') + ';');
    lines.push(``);
  }

  // Table familles
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`-- Structure de la table \`familles\``);
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`DROP TABLE IF EXISTS \`familles\`;`);
  lines.push(`CREATE TABLE \`familles\` (`);
  lines.push(`  \`id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`code\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`libelle\` VARCHAR(255) NOT NULL,`);
  lines.push(`  \`plafond_annuel\` DECIMAL(15,2) DEFAULT NULL,`);
  lines.push(`  \`taux_standard\` DECIMAL(5,2) DEFAULT NULL,`);
  lines.push(`  \`tarif_conventionne\` DECIMAL(15,2) DEFAULT NULL,`);
  lines.push(`  \`ticket_moderateur_defaut\` DECIMAL(15,2) DEFAULT NULL,`);
  lines.push(`  \`description\` TEXT DEFAULT NULL,`);
  lines.push(`  \`aliases\` TEXT DEFAULT NULL,`);
  lines.push(`  PRIMARY KEY (\`id\`)`);
  lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push(``);

  if (data.familles && data.familles.length > 0) {
    lines.push(`-- Contenu de la table \`familles\``);
    lines.push(`INSERT INTO \`familles\` (\`id\`, \`code\`, \`libelle\`, \`plafond_annuel\`, \`taux_standard\`, \`tarif_conventionne\`, \`ticket_moderateur_defaut\`, \`description\`, \`aliases\`) VALUES`);
    const values = data.familles.map(f => 
      `(${escapeSQL(f.id)}, ${escapeSQL(f.code)}, ${escapeSQL(f.libelle)}, ${escapeSQL(f.plafondAnnuel)}, ${escapeSQL(f.tauxStandard)}, ${escapeSQL(f.tarifConventionne)}, ${escapeSQL(f.ticketModerateurDefaut)}, ${escapeSQL(f.description)}, ${escapeSQL(f.aliases ? JSON.stringify(f.aliases) : '[]')})`
    );
    lines.push(values.join(',\n') + ';');
    lines.push(``);
  }

  // Table prestations
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`-- Structure de la table \`prestations\``);
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`DROP TABLE IF EXISTS \`prestations\`;`);
  lines.push(`CREATE TABLE \`prestations\` (`);
  lines.push(`  \`id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`numero_facture\` VARCHAR(100) NOT NULL,`);
  lines.push(`  \`date\` VARCHAR(20) DEFAULT NULL,`);
  lines.push(`  \`societe_id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`societe_nom\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`sous_societe\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`personne_id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`nom_agent\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`matricule\` VARCHAR(100) DEFAULT NULL,`);
  lines.push(`  \`total_prestation\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`participation\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`montant_a_rembourser\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`total_paye\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`reste_a_payer\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`statut\` VARCHAR(50) DEFAULT 'En attente',`);
  lines.push(`  \`date_creation\` VARCHAR(30) DEFAULT NULL,`);
  lines.push(`  \`commentaires\` TEXT DEFAULT NULL,`);
  lines.push(`  PRIMARY KEY (\`id\`)`);
  lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push(``);

  if (data.prestations && data.prestations.length > 0) {
    lines.push(`-- Contenu de la table \`prestations\``);
    lines.push(`INSERT INTO \`prestations\` (\`id\`, \`numero_facture\`, \`date\`, \`societe_id\`, \`societe_nom\`, \`sous_societe\`, \`personne_id\`, \`nom_agent\`, \`matricule\`, \`total_prestation\`, \`participation\`, \`montant_a_rembourser\`, \`total_paye\`, \`reste_a_payer\`, \`statut\`, \`date_creation\`, \`commentaires\`) VALUES`);
    const values = data.prestations.map(p => {
      const brut = p.totalPrestation ?? p.montantTotal ?? 0;
      const part = p.participation ?? p.ticketModerateur ?? 0;
      const remb = p.montantARembourser ?? Math.max(0, brut - part);
      const paye = p.totalPaye ?? 0;
      const reste = p.resteAPayer ?? Math.max(0, remb - paye);
      return `(${escapeSQL(p.id)}, ${escapeSQL(p.numeroFacture)}, ${escapeSQL(p.date)}, ${escapeSQL(p.societeId)}, ${escapeSQL(p.societeNom)}, ${escapeSQL(p.sousSociete)}, ${escapeSQL(p.personneId)}, ${escapeSQL(p.nomAgent)}, ${escapeSQL(p.matricule)}, ${escapeSQL(brut)}, ${escapeSQL(part)}, ${escapeSQL(remb)}, ${escapeSQL(paye)}, ${escapeSQL(reste)}, ${escapeSQL(p.statut || 'En attente')}, ${escapeSQL(p.dateCreation)}, ${escapeSQL(p.commentaires)})`;
    });
    lines.push(values.join(',\n') + ';');
    lines.push(``);
  }

  // Table lignes_prestation
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`-- Structure de la table \`lignes_prestation\``);
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`DROP TABLE IF EXISTS \`lignes_prestation\`;`);
  lines.push(`CREATE TABLE \`lignes_prestation\` (`);
  lines.push(`  \`id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`prestation_id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`code\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`libelle\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`total_prestation\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`ticket_moderateur\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`montant_a_rembourser\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`total_paye\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`statut\` VARCHAR(50) DEFAULT 'En attente',`);
  lines.push(`  PRIMARY KEY (\`id\`),`);
  lines.push(`  KEY \`idx_lp_prestation\` (\`prestation_id\`)`);
  lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push(``);

  const allLignesPrestation = (data.prestations || []).flatMap(p => p.lignes || []);
  if (allLignesPrestation.length > 0) {
    lines.push(`-- Contenu de la table \`lignes_prestation\``);
    lines.push(`INSERT INTO \`lignes_prestation\` (\`id\`, \`prestation_id\`, \`code\`, \`libelle\`, \`total_prestation\`, \`ticket_moderateur\`, \`montant_a_rembourser\`, \`total_paye\`, \`statut\`) VALUES`);
    const values = allLignesPrestation.map(l => 
      `(${escapeSQL(l.id)}, ${escapeSQL(l.prestationId)}, ${escapeSQL(l.code)}, ${escapeSQL(l.libelle)}, ${escapeSQL(l.totalPrestation ?? l.montant ?? 0)}, ${escapeSQL(l.ticketModerateur ?? 0)}, ${escapeSQL(l.montantARembourser ?? 0)}, ${escapeSQL(l.totalPaye ?? 0)}, ${escapeSQL(l.statut || 'En attente')})`
    );
    lines.push(values.join(',\n') + ';');
    lines.push(``);
  }

  // Table paiements
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`-- Structure de la table \`paiements\``);
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`DROP TABLE IF EXISTS \`paiements\`;`);
  lines.push(`CREATE TABLE \`paiements\` (`);
  lines.push(`  \`id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`numero_bordereau\` VARCHAR(100) NOT NULL,`);
  lines.push(`  \`date_paiement\` VARCHAR(20) DEFAULT NULL,`);
  lines.push(`  \`date_soins\` VARCHAR(20) DEFAULT NULL,`);
  lines.push(`  \`date_saisie\` VARCHAR(30) DEFAULT NULL,`);
  lines.push(`  \`societe_id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`societe_nom\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`sous_societe\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`nom_agent\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`matricule\` VARCHAR(100) DEFAULT NULL,`);
  lines.push(`  \`prestation_id\` VARCHAR(50) DEFAULT NULL,`);
  lines.push(`  \`prestation_numero\` VARCHAR(100) DEFAULT NULL,`);
  lines.push(`  \`mode_paiement\` VARCHAR(50) DEFAULT NULL,`);
  lines.push(`  \`reference_paiement\` VARCHAR(100) DEFAULT NULL,`);
  lines.push(`  \`total_reclame\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`total_paye\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`total_moderateur\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`total_exclu\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`remise\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`statut\` VARCHAR(50) DEFAULT 'Validé',`);
  lines.push(`  \`notes\` TEXT DEFAULT NULL,`);
  lines.push(`  PRIMARY KEY (\`id\`)`);
  lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push(``);

  if (data.paiements && data.paiements.length > 0) {
    lines.push(`-- Contenu de la table \`paiements\``);
    lines.push(`INSERT INTO \`paiements\` (\`id\`, \`numero_bordereau\`, \`date_paiement\`, \`date_soins\`, \`date_saisie\`, \`societe_id\`, \`societe_nom\`, \`sous_societe\`, \`nom_agent\`, \`matricule\`, \`prestation_id\`, \`prestation_numero\`, \`mode_paiement\`, \`reference_paiement\`, \`total_reclame\`, \`total_paye\`, \`total_moderateur\`, \`total_exclu\`, \`remise\`, \`statut\`, \`notes\`) VALUES`);
    const values = data.paiements.map(p => 
      `(${escapeSQL(p.id)}, ${escapeSQL(p.numeroBordereau)}, ${escapeSQL(p.datePaiement)}, ${escapeSQL(p.dateSoins)}, ${escapeSQL(p.dateSaisie)}, ${escapeSQL(p.societeId)}, ${escapeSQL(p.societeNom)}, ${escapeSQL(p.sousSociete)}, ${escapeSQL(p.nomAgent)}, ${escapeSQL(p.matricule)}, ${escapeSQL(p.prestationId)}, ${escapeSQL(p.prestationNumero)}, ${escapeSQL(p.modePaiement)}, ${escapeSQL(p.referencePaiement)}, ${escapeSQL(p.totalReclame ?? p.montantAPayer ?? 0)}, ${escapeSQL(p.totalPaye ?? p.sommePayee ?? 0)}, ${escapeSQL(p.totalModerateur ?? p.ticketModerateur ?? 0)}, ${escapeSQL(p.totalExclu ?? p.montantExclu ?? 0)}, ${escapeSQL(p.remise ?? 0)}, ${escapeSQL(p.statut || 'Validé')}, ${escapeSQL(p.notes)})`
    );
    lines.push(values.join(',\n') + ';');
    lines.push(``);
  }

  // Table lignes_paiement
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`-- Structure de la table \`lignes_paiement\``);
  lines.push(`-- --------------------------------------------------------`);
  lines.push(`DROP TABLE IF EXISTS \`lignes_paiement\`;`);
  lines.push(`CREATE TABLE \`lignes_paiement\` (`);
  lines.push(`  \`id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`paiement_id\` VARCHAR(50) NOT NULL,`);
  lines.push(`  \`ligne_prestation_id\` VARCHAR(50) DEFAULT NULL,`);
  lines.push(`  \`prestation_id\` VARCHAR(50) DEFAULT NULL,`);
  lines.push(`  \`immatriculation\` VARCHAR(100) DEFAULT NULL,`);
  lines.push(`  \`nom_base_assurance\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`nom_agent\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`prestation_numero\` VARCHAR(100) DEFAULT NULL,`);
  lines.push(`  \`date_soins\` VARCHAR(20) DEFAULT NULL,`);
  lines.push(`  \`total_paye\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`ticket_moderateur\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`montant_exclu\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`montant_reclame\` DECIMAL(15,2) DEFAULT 0.00,`);
  lines.push(`  \`code_acte\` VARCHAR(50) DEFAULT NULL,`);
  lines.push(`  \`libelle_acte\` VARCHAR(255) DEFAULT NULL,`);
  lines.push(`  \`actes_payes\` LONGTEXT DEFAULT NULL,`);
  lines.push(`  \`commentaire\` TEXT DEFAULT NULL,`);
  lines.push(`  PRIMARY KEY (\`id\`),`);
  lines.push(`  KEY \`idx_lp_paiement\` (\`paiement_id\`)`);
  lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  lines.push(``);

  const allLignesPaiement = (data.paiements || []).flatMap(p => p.lignes || []);
  if (allLignesPaiement.length > 0) {
    lines.push(`-- Contenu de la table \`lignes_paiement\``);
    lines.push(`INSERT INTO \`lignes_paiement\` (\`id\`, \`paiement_id\`, \`ligne_prestation_id\`, \`prestation_id\`, \`immatriculation\`, \`nom_base_assurance\`, \`nom_agent\`, \`prestation_numero\`, \`date_soins\`, \`total_paye\`, \`ticket_moderateur\`, \`montant_exclu\`, \`montant_reclame\`, \`code_acte\`, \`libelle_acte\`, \`actes_payes\`, \`commentaire\`) VALUES`);
    const values = allLignesPaiement.map(l => 
      `(${escapeSQL(l.id)}, ${escapeSQL(l.paiementId)}, ${escapeSQL(l.lignePrestationId)}, ${escapeSQL(l.prestationId)}, ${escapeSQL(l.immatriculation)}, ${escapeSQL(l.nomBaseAssurance)}, ${escapeSQL(l.nomAgent)}, ${escapeSQL(l.prestationNumero)}, ${escapeSQL(l.dateSoins)}, ${escapeSQL(l.totalPaye ?? l.montantPaye ?? 0)}, ${escapeSQL(l.ticketModerateur ?? 0)}, ${escapeSQL(l.montantExclu ?? 0)}, ${escapeSQL(l.montantReclame ?? 0)}, ${escapeSQL(l.codeActe)}, ${escapeSQL(l.libelleActe)}, ${escapeSQL(l.actesPayes || [])}, ${escapeSQL(l.commentaire)})`
    );
    lines.push(values.join(',\n') + ';');
    lines.push(``);
  }

  lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
  lines.push(`-- ========================================================`);
  lines.push(`-- FIN DE DUMP SQL MYSQL`);
  lines.push(`-- ========================================================`);

  return lines.join('\n');
}
