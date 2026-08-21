-- ==========================================================
-- Base de données MySQL pour Suivi Assurance (SALFA)
-- Compatible WAMP / XAMPP / MariaDB / MySQL 5.7+ & 8.0+
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `suivi_assurance` 
DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `suivi_assurance`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `lignes_paiements`;
DROP TABLE IF EXISTS `lignes_prestations`;
DROP TABLE IF EXISTS `paiements`;
DROP TABLE IF EXISTS `prestations`;
DROP TABLE IF EXISTS `personnes`;
DROP TABLE IF EXISTS `familles`;
DROP TABLE IF EXISTS `societes`;
SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------
-- Table: societes (Compagnies d'assurance et tiers-payant)
-- --------------------------------------------------------
CREATE TABLE `societes` (
  `id` VARCHAR(50) NOT NULL,
  `nom` VARCHAR(150) NOT NULL,
  `tauxAssurance` DECIMAL(5,2) DEFAULT 80.00,
  `typePriseEnCharge` ENUM('PAR_ACTE', 'GLOBAL') DEFAULT 'PAR_ACTE',
  `adresse` VARCHAR(255) NULL,
  `telephone` VARCHAR(50) NULL,
  `email` VARCHAR(100) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: familles (Familles d'actes et barèmes de soins)
-- --------------------------------------------------------
CREATE TABLE `familles` (
  `code` VARCHAR(20) NOT NULL,
  `libelle` VARCHAR(150) NOT NULL,
  `tauxPriseEnCharge` DECIMAL(5,2) DEFAULT 80.00,
  `plafondAnnuel` DECIMAL(15,2) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: personnes (Assurés, adhérents et ayants droit)
-- --------------------------------------------------------
CREATE TABLE `personnes` (
  `id` VARCHAR(50) NOT NULL,
  `matricule` VARCHAR(50) NOT NULL,
  `nomPrenom` VARCHAR(150) NOT NULL,
  `qualite` VARCHAR(50) DEFAULT 'Adhérent',
  `dateNaissance` DATE NULL,
  `sexe` VARCHAR(10) NULL,
  `societeId` VARCHAR(50) NULL,
  `sousSociete` VARCHAR(100) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_personnes_matricule` (`matricule`),
  KEY `idx_personnes_societeId` (`societeId`),
  CONSTRAINT `fk_personnes_societe` FOREIGN KEY (`societeId`) REFERENCES `societes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: prestations (Factures médicales de soins)
-- --------------------------------------------------------
CREATE TABLE `prestations` (
  `id` VARCHAR(50) NOT NULL,
  `numeroFacture` VARCHAR(50) NOT NULL,
  `date` DATE NOT NULL,
  `societeId` VARCHAR(50) NOT NULL,
  `societeNom` VARCHAR(150) NULL,
  `sousSociete` VARCHAR(100) NULL,
  `personneId` VARCHAR(50) NULL,
  `matricule` VARCHAR(50) NULL,
  `nomAgent` VARCHAR(150) NULL,
  `totalPrestation` DECIMAL(15,2) DEFAULT 0.00,
  `participation` DECIMAL(15,2) DEFAULT 0.00,
  `montantARembourser` DECIMAL(15,2) DEFAULT 0.00,
  `totalPaye` DECIMAL(15,2) DEFAULT 0.00,
  `resteAPayer` DECIMAL(15,2) DEFAULT 0.00,
  `statut` ENUM('En attente', 'Partiellement payé', 'Payé', 'Rejeté') DEFAULT 'En attente',
  `commentaires` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_prestations_numeroFacture` (`numeroFacture`),
  KEY `idx_prestations_date` (`date`),
  KEY `idx_prestations_societeId` (`societeId`),
  KEY `idx_prestations_personneId` (`personneId`),
  CONSTRAINT `fk_prestations_societe` FOREIGN KEY (`societeId`) REFERENCES `societes` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_prestations_personne` FOREIGN KEY (`personneId`) REFERENCES `personnes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: lignes_prestations (Actes individuels par facture)
-- --------------------------------------------------------
CREATE TABLE `lignes_prestations` (
  `id` VARCHAR(50) NOT NULL,
  `prestationId` VARCHAR(50) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `libelle` VARCHAR(200) NOT NULL,
  `totalPrestation` DECIMAL(15,2) DEFAULT 0.00,
  `ticketModerateur` DECIMAL(15,2) DEFAULT 0.00,
  `montantARembourser` DECIMAL(15,2) DEFAULT 0.00,
  `totalPaye` DECIMAL(15,2) DEFAULT 0.00,
  `statut` ENUM('En attente', 'Partiellement payé', 'Payé', 'Rejeté') DEFAULT 'En attente',
  `motifRejet` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lignes_prestationId` (`prestationId`),
  KEY `idx_lignes_code` (`code`),
  CONSTRAINT `fk_lignes_prestation` FOREIGN KEY (`prestationId`) REFERENCES `prestations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: paiements (Bordereaux de décomptes et règlements)
-- --------------------------------------------------------
CREATE TABLE `paiements` (
  `id` VARCHAR(50) NOT NULL,
  `numeroBordereau` VARCHAR(100) NOT NULL,
  `datePaiement` DATE NOT NULL,
  `dateSaisie` DATE NULL,
  `societeId` VARCHAR(50) NOT NULL,
  `matricule` VARCHAR(50) NULL,
  `nomAgent` VARCHAR(150) NULL,
  `modePaiement` VARCHAR(50) DEFAULT 'Virement bancaire',
  `referencePaiement` VARCHAR(100) NULL,
  `totalReclame` DECIMAL(15,2) DEFAULT 0.00,
  `totalPaye` DECIMAL(15,2) DEFAULT 0.00,
  `totalModerateur` DECIMAL(15,2) DEFAULT 0.00,
  `totalExclu` DECIMAL(15,2) DEFAULT 0.00,
  `remise` DECIMAL(15,2) DEFAULT 0.00,
  `statut` ENUM('Brouillon', 'Validé', 'Annulé') DEFAULT 'Validé',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_paiements_numeroBordereau` (`numeroBordereau`),
  KEY `idx_paiements_datePaiement` (`datePaiement`),
  KEY `idx_paiements_societeId` (`societeId`),
  CONSTRAINT `fk_paiements_societe` FOREIGN KEY (`societeId`) REFERENCES `societes` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: lignes_paiements (Lignes détaillées de bordereau)
-- --------------------------------------------------------
CREATE TABLE `lignes_paiements` (
  `id` VARCHAR(50) NOT NULL,
  `paiementId` VARCHAR(50) NOT NULL,
  `prestationId` VARCHAR(50) NULL,
  `lignePrestationId` VARCHAR(50) NULL,
  `prestationNumero` VARCHAR(50) NULL,
  `immatriculation` VARCHAR(50) NULL,
  `nomBaseAssurance` VARCHAR(150) NULL,
  `nomAgent` VARCHAR(150) NULL,
  `totalPaye` DECIMAL(15,2) DEFAULT 0.00,
  `montantPaye` DECIMAL(15,2) DEFAULT 0.00,
  `ticketModerateur` DECIMAL(15,2) DEFAULT 0.00,
  `montantExclu` DECIMAL(15,2) DEFAULT 0.00,
  `montantReclame` DECIMAL(15,2) DEFAULT 0.00,
  `codeActe` VARCHAR(20) NULL,
  `libelleActe` VARCHAR(200) NULL,
  `commentaire` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lp_paiementId` (`paiementId`),
  KEY `idx_lp_prestationId` (`prestationId`),
  CONSTRAINT `fk_lp_paiement` FOREIGN KEY (`paiementId`) REFERENCES `paiements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================
-- Données initiales par défaut (Assurances & Familles d'actes)
-- ==========================================================

INSERT INTO `societes` (`id`, `nom`, `tauxAssurance`, `typePriseEnCharge`, `telephone`, `email`) VALUES
('soc-1', 'BSA ASSURANCES', 80.00, 'PAR_ACTE', '+261 20 22 000 01', 'contact@bsa.mg'),
('soc-2', 'ASCOMA MADAGASCAR', 85.00, 'PAR_ACTE', '+261 20 22 000 02', 'contact@ascoma.mg'),
('soc-3', 'MCI CARE MADAGASCAR', 80.00, 'PAR_ACTE', '+261 20 22 000 03', 'claims@mcicare.mg'),
('soc-4', 'AROM ASSURANCES', 75.00, 'PAR_ACTE', '+261 20 22 000 04', 'contact@arom.mg'),
('soc-5', 'NY HAVANA', 80.00, 'PAR_ACTE', '+261 20 22 000 05', 'santeprive@nyhavana.mg'),
('soc-6', 'SANLAM MADAGASCAR', 80.00, 'PAR_ACTE', '+261 20 22 000 06', 'sante@sanlam.mg');

INSERT INTO `familles` (`code`, `libelle`, `tauxPriseEnCharge`) VALUES
('CONS', 'Consultation Médicale Généraliste / Spécialiste', 80.00),
('PHAR', 'Pharmacie / Médicaments Essentiels', 80.00),
('LABO', 'Analyses Médicales & Biologiques', 80.00),
('RADIO', 'Imagerie Médicale (Radio, Écho, Scanner)', 80.00),
('DENT', 'Soins Dentaires & Prothèses', 70.00),
('OPHT', 'Ophtalmologie & Optique Médicale', 75.00),
('HOSP', 'Séjour Hospitalier & Soins Intensifs', 85.00),
('CHIR', 'Actes Chirurgicaux & Bloc Opératoire', 85.00),
('KINE', 'Kinésithérapie & Rééducation', 70.00),
('MATER', 'Maternité & Accouchement', 90.00);
