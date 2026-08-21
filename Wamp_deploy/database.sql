-- ==========================================================
-- BASE DE DONNEES MYSQL : SUIVI DES PRESTATIONS & REGLEMENTS ASSURANCE
-- Compatible WampServer (MySQL 5.7+, MySQL 8.0+, MariaDB 10+)
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `suivi_assurance` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `suivi_assurance`;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------
-- Table : societes (Compagnies d'assurance et garants)
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `societes`;
CREATE TABLE `societes` (
  `id` VARCHAR(64) NOT NULL,
  `nom` VARCHAR(150) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `adresse` VARCHAR(255) DEFAULT NULL,
  `telephone` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `tauxCouvertureDefaut` DECIMAL(5,2) DEFAULT 80.00,
  `dateCreation` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table : familles (Familles d'actes médicaux)
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `familles`;
CREATE TABLE `familles` (
  `id` VARCHAR(64) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `libelle` VARCHAR(150) NOT NULL,
  `tauxDefaut` DECIMAL(5,2) DEFAULT 80.00,
  `plafondAnnuel` DECIMAL(15,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fam_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table : actes (Nomenclature et barèmes des actes)
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `actes`;
CREATE TABLE `actes` (
  `id` VARCHAR(64) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `libelle` VARCHAR(255) NOT NULL,
  `familleCode` VARCHAR(50) DEFAULT 'CONS',
  `tarifConventionnel` DECIMAL(15,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_acte_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table : personnes (Assurés principaux et ayants-droit)
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `personnes`;
CREATE TABLE `personnes` (
  `id` VARCHAR(64) NOT NULL,
  `matricule` VARCHAR(100) NOT NULL,
  `nomPrenom` VARCHAR(150) NOT NULL,
  `societeId` VARCHAR(64) NOT NULL,
  `qualite` VARCHAR(50) DEFAULT 'Adhérent Principal',
  `dateNaissance` DATE DEFAULT NULL,
  `genre` VARCHAR(10) DEFAULT NULL,
  `telephone` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `plafondConsomme` DECIMAL(15,2) DEFAULT 0.00,
  `dateCreation` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_matricule` (`matricule`),
  KEY `idx_personne_soc` (`societeId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table : prestations (Dossiers et factures de soins)
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `prestations`;
CREATE TABLE `prestations` (
  `id` VARCHAR(64) NOT NULL,
  `numeroFacture` VARCHAR(100) NOT NULL,
  `date` DATE NOT NULL,
  `societeId` VARCHAR(64) NOT NULL,
  `societeNom` VARCHAR(150) DEFAULT NULL,
  `sousSociete` VARCHAR(150) DEFAULT 'Département',
  `personneId` VARCHAR(64) NOT NULL,
  `nomAgent` VARCHAR(150) DEFAULT NULL,
  `matricule` VARCHAR(100) DEFAULT NULL,
  `totalPrestation` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `montantTotal` DECIMAL(15,2) DEFAULT 0.00,
  `participation` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `ticketModerateur` DECIMAL(15,2) DEFAULT 0.00,
  `montantARembourser` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `totalPaye` DECIMAL(15,2) DEFAULT 0.00,
  `resteAPayer` DECIMAL(15,2) DEFAULT 0.00,
  `statut` ENUM('En attente', 'Partiellement payé', 'Payé', 'Rejeté') NOT NULL DEFAULT 'En attente',
  `dateCreation` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `commentaires` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_num_facture` (`numeroFacture`),
  KEY `idx_prest_date` (`date`),
  KEY `idx_prest_soc` (`societeId`),
  KEY `idx_prest_pers` (`personneId`),
  KEY `idx_prest_statut` (`statut`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table : prestation_lignes (Détail des actes d'une facture)
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `prestation_lignes`;
CREATE TABLE `prestation_lignes` (
  `id` VARCHAR(64) NOT NULL,
  `prestationId` VARCHAR(64) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `libelle` VARCHAR(255) NOT NULL,
  `totalPrestation` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `ticketModerateur` DECIMAL(15,2) DEFAULT 0.00,
  `montantARembourser` DECIMAL(15,2) DEFAULT 0.00,
  `totalPaye` DECIMAL(15,2) DEFAULT 0.00,
  `statut` ENUM('En attente', 'Partiellement payé', 'Payé', 'Rejeté') DEFAULT 'En attente',
  PRIMARY KEY (`id`),
  KEY `idx_ligne_prest` (`prestationId`),
  KEY `idx_ligne_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table : paiements (Bordereaux de règlements et rejets)
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `paiements`;
CREATE TABLE `paiements` (
  `id` VARCHAR(64) NOT NULL,
  `numeroBordereau` VARCHAR(100) NOT NULL,
  `datePaiement` DATE NOT NULL,
  `dateSaisie` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `societeId` VARCHAR(64) NOT NULL,
  `nomAgent` VARCHAR(150) DEFAULT NULL,
  `matricule` VARCHAR(100) DEFAULT NULL,
  `modePaiement` VARCHAR(50) DEFAULT 'Virement bancaire',
  `referencePaiement` VARCHAR(100) DEFAULT NULL,
  `totalReclame` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `totalPaye` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `totalModerateur` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `totalExclu` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `remise` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `statut` VARCHAR(50) DEFAULT 'Validé',
  `notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_num_bordereau` (`numeroBordereau`),
  KEY `idx_pai_date` (`datePaiement`),
  KEY `idx_pai_soc` (`societeId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table : paiement_lignes (Lettrage des actes payés ou rejetés)
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `paiement_lignes`;
CREATE TABLE `paiement_lignes` (
  `id` VARCHAR(64) NOT NULL,
  `paiementId` VARCHAR(64) NOT NULL,
  `lignePrestationId` VARCHAR(64) DEFAULT NULL,
  `prestationId` VARCHAR(64) DEFAULT NULL,
  `prestationNumero` VARCHAR(100) DEFAULT NULL,
  `dateSoins` DATE DEFAULT NULL,
  `immatriculation` VARCHAR(100) DEFAULT NULL,
  `nomBaseAssurance` VARCHAR(150) DEFAULT NULL,
  `nomAgent` VARCHAR(150) DEFAULT NULL,
  `totalPaye` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `montantPaye` DECIMAL(15,2) DEFAULT 0.00,
  `ticketModerateur` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `montantExclu` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `montantReclame` DECIMAL(15,2) DEFAULT 0.00,
  `actesPayes` JSON DEFAULT NULL,
  `commentaire` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pl_paiement` (`paiementId`),
  KEY `idx_pl_prestation` (`prestationId`),
  KEY `idx_pl_ligne_prest` (`lignePrestationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================================
-- DONNEES INITIALES (SEED DATA)
-- ==========================================================

-- Sociétés d'assurance
INSERT INTO `societes` (`id`, `nom`, `code`, `adresse`, `telephone`, `email`, `tauxCouvertureDefaut`) VALUES
('soc-1', 'ASCOMA Madagascar', 'ASCOMA', 'Immeuble ARO, Antananarivo 101', '+261 20 22 201 01', 'contact@ascoma.mg', 80.00),
('soc-2', 'MCI CARE Madagascar', 'MCICARE', 'Zone Galaxy Andraharo, Antananarivo', '+261 20 23 300 00', 'reclamations@mcicare.mg', 80.00),
('soc-3', 'BSA Assurances & Santé', 'BSA', 'Analakely, Antananarivo 101', '+261 20 22 555 12', 'tiers-payant@bsa-sante.mg', 80.00),
('soc-4', 'Ny Havana Assurances', 'HAVANA', '67 Ha, Antananarivo', '+261 20 22 222 00', 'sante@nyhavana.mg', 75.00),
('soc-5', 'ARO Assurances', 'ARO', 'Antsahavola, Antananarivo', '+261 20 22 201 54', 'prestations@aro.mg', 80.00);

-- Familles d'actes
INSERT INTO `familles` (`id`, `code`, `libelle`, `tauxDefaut`, `plafondAnnuel`) VALUES
('fam-1', 'CONS', 'Consultations Généralistes & Spécialistes', 80.00, 500000.00),
('fam-2', 'PHAR', 'Pharmacie & Médicaments', 80.00, 1500000.00),
('fam-3', 'LABO', 'Analyses Médicales & Biologie', 80.00, 1000000.00),
('fam-4', 'RADIO', 'Imagerie Médicale & Échographie', 80.00, 1200000.00),
('fam-5', 'CHIR', 'Actes Chirurgicaux & Bloc', 80.00, 5000000.00),
('fam-6', 'DENT', 'Soins Dentaires & Prothèses', 70.00, 800000.00),
('fam-7', 'OPHT', 'Optique Médicale & Verres', 70.00, 600000.00),
('fam-8', 'ACCOUCH', 'Maternité & Accouchement', 80.00, 3000000.00),
('fam-9', 'HOSP', 'Séjour Hospitalier & Chambre', 80.00, 2500000.00);

-- Nomenclature des actes
INSERT INTO `actes` (`id`, `code`, `libelle`, `familleCode`, `tarifConventionnel`) VALUES
('act-1', 'C-MED', 'Consultation Médecine Générale', 'CONS', 25000.00),
('act-2', 'C-SPE', 'Consultation Médecin Spécialiste', 'CONS', 45000.00),
('act-3', 'NFS', 'Numération Formule Sanguine (NFS)', 'LABO', 35000.00),
('act-4', 'GLYC', 'Glycémie à jeun', 'LABO', 15000.00),
('act-5', 'LIPID', 'Bilan Lipidique complet', 'LABO', 45000.00),
('act-6', 'ECG', 'Électrocardiogramme de repos', 'CONS', 40000.00),
('act-7', 'RX-THOR', 'Radiographie Thoracique face/profil', 'RADIO', 55000.00),
('act-8', 'ECHO-ABD', 'Échographie Abdomino-pelvienne', 'RADIO', 85000.00),
('act-9', 'DETAR', 'Détartrage et soins parodontaux', 'DENT', 60000.00),
('act-10', 'PANOR-DENT', 'Panoramique Dentaire Numérique', 'DENT', 75000.00),
('act-11', 'APP-CHIR', 'Appendicectomie sous coelioscopie', 'CHIR', 1200000.00),
('act-12', 'ACCOUCH-NORM', 'Accouchement normal par voie basse', 'ACCOUCH', 900000.00),
('act-13', 'CESAR', 'Césarienne programmée / urgence', 'ACCOUCH', 1800000.00),
('act-14', 'HOSP-JOUR', 'Journée d''hospitalisation médicale', 'HOSP', 80000.00);

-- Assurés / Bénéficiaires
INSERT INTO `personnes` (`id`, `matricule`, `nomPrenom`, `societeId`, `qualite`, `dateNaissance`, `genre`, `telephone`, `email`, `plafondConsomme`) VALUES
('per-1', 'MAT-8041', 'RAZAFINDRABE Jean-Luc', 'soc-1', 'Adhérent Principal', '1984-05-12', 'M', '+261 34 01 234 56', 'jl.razafindrabe@gmail.com', 240000.00),
('per-2', 'MAT-8042', 'RABEMANANJARA Sahondra', 'soc-1', 'Conjoint', '1988-11-23', 'F', '+261 33 12 345 67', 'sahondra.rabe@gmail.com', 125000.00),
('per-3', 'MCI-5520', 'ANDRIANARIVO Hery', 'soc-2', 'Adhérent Principal', '1979-02-18', 'M', '+261 32 45 678 90', 'hery.andriana@orange.mg', 450000.00),
('per-4', 'MCI-5521', 'ANDRIANARIVO Fitia', 'soc-2', 'Enfant', '2015-08-04', 'F', '+261 32 45 678 90', '', 85000.00),
('per-5', 'BSA-1090', 'RAKOTOMALALA Sitraka', 'soc-3', 'Adhérent Principal', '1992-09-30', 'M', '+261 34 88 990 11', 'sitraka.rakoto@telma.mg', 180000.00),
('per-6', 'HAV-3301', 'RAMIARAMANANA Voahirana', 'soc-4', 'Adhérent Principal', '1986-07-14', 'F', '+261 33 05 678 12', 'voahirana.ram@moov.mg', 90000.00);

-- Factures Prestations
INSERT INTO `prestations` (`id`, `numeroFacture`, `date`, `societeId`, `societeNom`, `sousSociete`, `personneId`, `nomAgent`, `matricule`, `totalPrestation`, `montantTotal`, `participation`, `ticketModerateur`, `montantARembourser`, `totalPaye`, `resteAPayer`, `statut`, `dateCreation`, `commentaires`) VALUES
('prest-1', 'FACT-2026-001', '2026-01-10', 'soc-1', 'ASCOMA Madagascar', 'Direction Informatique', 'per-1', 'RAZAFINDRABE Jean-Luc', 'MAT-8041', 120000.00, 120000.00, 24000.00, 24000.00, 96000.00, 96000.00, 0.00, 'Payé', '2026-01-10 09:00:00', 'Bilan complet et consultation spécialisée'),
('prest-2', 'FACT-2026-002', '2026-01-15', 'soc-1', 'ASCOMA Madagascar', 'Ressources Humaines', 'per-2', 'RABEMANANJARA Sahondra', 'MAT-8042', 85000.00, 85000.00, 17000.00, 17000.00, 68000.00, 68000.00, 0.00, 'Payé', '2026-01-15 14:30:00', 'Échographie pelvienne de contrôle'),
('prest-3', 'FACT-2026-003', '2026-01-20', 'soc-2', 'MCI CARE Madagascar', 'Direction Financière', 'per-3', 'ANDRIANARIVO Hery', 'MCI-5520', 210000.00, 210000.00, 42000.00, 42000.00, 168000.00, 168000.00, 0.00, 'Payé', '2026-01-20 11:15:00', 'Bilan sanguin complet et radiographie'),
('prest-4', 'FACT-2026-004', '2026-02-02', 'soc-2', 'MCI CARE Madagascar', 'Direction Financière', 'per-4', 'ANDRIANARIVO Fitia', 'MCI-5521', 65000.00, 65000.00, 13000.00, 13000.00, 52000.00, 0.00, 52000.00, 'En attente', '2026-02-02 16:00:00', 'Consultation pédiatrique'),
('prest-5', 'FACT-2026-005', '2026-02-05', 'soc-3', 'BSA Assurances & Santé', 'Exploitation', 'per-5', 'RAKOTOMALALA Sitraka', 'BSA-1090', 145000.00, 145000.00, 29000.00, 29000.00, 116000.00, 0.00, 116000.00, 'En attente', '2026-02-05 10:45:00', 'Soins dentaires et panoramique');

-- Lignes d'actes des prestations
INSERT INTO `prestation_lignes` (`id`, `prestationId`, `code`, `libelle`, `totalPrestation`, `ticketModerateur`, `montantARembourser`, `totalPaye`, `statut`) VALUES
('lig-1', 'prest-1', 'C-SPE', 'Consultation Médecin Spécialiste', 45000.00, 9000.00, 36000.00, 36000.00, 'Payé'),
('lig-2', 'prest-1', 'ECG', 'Électrocardiogramme de repos', 40000.00, 8000.00, 32000.00, 32000.00, 'Payé'),
('lig-3', 'prest-1', 'NFS', 'Numération Formule Sanguine (NFS)', 35000.00, 7000.00, 28000.00, 28000.00, 'Payé'),
('lig-4', 'prest-2', 'ECHO-ABD', 'Échographie Abdomino-pelvienne', 85000.00, 17000.00, 68000.00, 68000.00, 'Payé'),
('lig-5', 'prest-3', 'LIPID', 'Bilan Lipidique complet', 45000.00, 9000.00, 36000.00, 36000.00, 'Payé'),
('lig-6', 'prest-3', 'GLYC', 'Glycémie à jeun', 15000.00, 3000.00, 12000.00, 12000.00, 'Payé'),
('lig-7', 'prest-3', 'RX-THOR', 'Radiographie Thoracique face/profil', 55000.00, 11000.00, 44000.00, 44000.00, 'Payé'),
('lig-8', 'prest-3', 'NFS', 'Numération Formule Sanguine (NFS)', 35000.00, 7000.00, 28000.00, 28000.00, 'Payé'),
('lig-9', 'prest-3', 'C-MED', 'Consultation Médecine Générale', 25000.00, 5000.00, 20000.00, 20000.00, 'Payé'),
('lig-10', 'prest-3', 'PHAR', 'Médicaments de base', 35000.00, 7000.00, 28000.00, 28000.00, 'Payé'),
('lig-11', 'prest-4', 'C-MED', 'Consultation Médecine Générale', 25000.00, 5000.00, 20000.00, 0.00, 'En attente'),
('lig-12', 'prest-4', 'PHAR', 'Traitement pédiatrique', 40000.00, 8000.00, 32000.00, 0.00, 'En attente'),
('lig-13', 'prest-5', 'PANOR-DENT', 'Panoramique Dentaire Numérique', 75000.00, 15000.00, 60000.00, 0.00, 'En attente'),
('lig-14', 'prest-5', 'DETAR', 'Détartrage et soins parodontaux', 60000.00, 12000.00, 48000.00, 0.00, 'En attente'),
('lig-15', 'prest-5', 'CONS', 'Consultation bucco-dentaire', 10000.00, 2000.00, 8000.00, 0.00, 'En attente');

-- Règlements / Bordereaux de paiement
INSERT INTO `paiements` (`id`, `numeroBordereau`, `datePaiement`, `dateSaisie`, `societeId`, `nomAgent`, `matricule`, `modePaiement`, `referencePaiement`, `totalReclame`, `totalPaye`, `totalModerateur`, `totalExclu`, `remise`, `statut`, `notes`) VALUES
('pai-1', 'BORD-ASC-2026-01', '2026-01-25', '2026-01-25 10:00:00', 'soc-1', 'RAZAFINDRABE Jean-Luc', 'MAT-8041', 'Virement bancaire', 'VIR-BNI-98442', 205000.00, 164000.00, 41000.00, 0.00, 0.00, 'Validé', 'Règlement Décompte ASCOMA Janvier - FACT-2026-001 et FACT-2026-002'),
('pai-2', 'BORD-MCI-2026-01', '2026-01-28', '2026-01-28 15:30:00', 'soc-2', 'ANDRIANARIVO Hery', 'MCI-5520', 'Virement bancaire', 'VIR-BOA-33219', 210000.00, 168000.00, 42000.00, 0.00, 0.00, 'Validé', 'Règlement Décompte MCI CARE Janvier - FACT-2026-003');

-- Lignes des paiements
INSERT INTO `paiement_lignes` (`id`, `paiementId`, `lignePrestationId`, `prestationId`, `prestationNumero`, `dateSoins`, `immatriculation`, `nomBaseAssurance`, `nomAgent`, `totalPaye`, `montantPaye`, `ticketModerateur`, `montantExclu`, `montantReclame`, `actesPayes`, `commentaire`) VALUES
('pl-1', 'pai-1', 'lig-1', 'prest-1', 'FACT-2026-001', '2026-01-10', 'MAT-8041', 'RAZAFINDRABE Jean-Luc', 'RAZAFINDRABE Jean-Luc', 36000.00, 36000.00, 9000.00, 0.00, 45000.00, '[{"code":"C-SPE","libelle":"Consultation Médecin Spécialiste","montant":36000}]', 'Règlement conforme'),
('pl-2', 'pai-1', 'lig-2', 'prest-1', 'FACT-2026-001', '2026-01-10', 'MAT-8041', 'RAZAFINDRABE Jean-Luc', 'RAZAFINDRABE Jean-Luc', 32000.00, 32000.00, 8000.00, 0.00, 40000.00, '[{"code":"ECG","libelle":"Électrocardiogramme de repos","montant":32000}]', 'Règlement conforme'),
('pl-3', 'pai-1', 'lig-3', 'prest-1', 'FACT-2026-001', '2026-01-10', 'MAT-8041', 'RAZAFINDRABE Jean-Luc', 'RAZAFINDRABE Jean-Luc', 28000.00, 28000.00, 7000.00, 0.00, 35000.00, '[{"code":"NFS","libelle":"Numération Formule Sanguine (NFS)","montant":28000}]', 'Règlement conforme'),
('pl-4', 'pai-1', 'lig-4', 'prest-2', 'FACT-2026-002', '2026-01-15', 'MAT-8042', 'RABEMANANJARA Sahondra', 'RABEMANANJARA Sahondra', 68000.00, 68000.00, 17000.00, 0.00, 85000.00, '[{"code":"ECHO-ABD","libelle":"Échographie Abdomino-pelvienne","montant":68000}]', 'Règlement conforme'),
('pl-5', 'pai-2', 'lig-5', 'prest-3', 'FACT-2026-003', '2026-01-20', 'MCI-5520', 'ANDRIANARIVO Hery', 'ANDRIANARIVO Hery', 36000.00, 36000.00, 9000.00, 0.00, 45000.00, '[{"code":"LIPID","libelle":"Bilan Lipidique complet","montant":36000}]', 'Règlement conforme'),
('pl-6', 'pai-2', 'lig-6', 'prest-3', 'FACT-2026-003', '2026-01-20', 'MCI-5520', 'ANDRIANARIVO Hery', 'ANDRIANARIVO Hery', 12000.00, 12000.00, 3000.00, 0.00, 15000.00, '[{"code":"GLYC","libelle":"Glycémie à jeun","montant":12000}]', 'Règlement conforme'),
('pl-7', 'pai-2', 'lig-7', 'prest-3', 'FACT-2026-003', '2026-01-20', 'MCI-5520', 'ANDRIANARIVO Hery', 'ANDRIANARIVO Hery', 44000.00, 44000.00, 11000.00, 0.00, 55000.00, '[{"code":"RX-THOR","libelle":"Radiographie Thoracique face/profil","montant":44000}]', 'Règlement conforme'),
('pl-8', 'pai-2', 'lig-8', 'prest-3', 'FACT-2026-003', '2026-01-20', 'MCI-5520', 'ANDRIANARIVO Hery', 'ANDRIANARIVO Hery', 28000.00, 28000.00, 7000.00, 0.00, 35000.00, '[{"code":"NFS","libelle":"Numération Formule Sanguine (NFS)","montant":28000}]', 'Règlement conforme'),
('pl-9', 'pai-2', 'lig-9', 'prest-3', 'FACT-2026-003', '2026-01-20', 'MCI-5520', 'ANDRIANARIVO Hery', 'ANDRIANARIVO Hery', 20000.00, 20000.00, 5000.00, 0.00, 25000.00, '[{"code":"C-MED","libelle":"Consultation Médecine Générale","montant":20000}]', 'Règlement conforme'),
('pl-10', 'pai-2', 'lig-10', 'prest-3', 'FACT-2026-003', '2026-01-20', 'MCI-5520', 'ANDRIANARIVO Hery', 'ANDRIANARIVO Hery', 28000.00, 28000.00, 7000.00, 0.00, 35000.00, '[{"code":"PHAR","libelle":"Médicaments de base","montant":28000}]', 'Règlement conforme');
