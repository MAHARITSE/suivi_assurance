-- =====================================================================
--  SUIVI ASSURANCE SALFA — Schéma de la base de données MySQL
--  Déploiement WAMP (Apache + MySQL/MariaDB + PHP)
-- =====================================================================
--  Compatible avec : MySQL 5.7+ / MySQL 8.x / MariaDB 10.4+ / phpMyAdmin
--
--  ⚠️  Ce script RÉCRÉE les tables (DROP TABLE IF EXISTS) :
--      les données existantes de ces tables seront effacées.
--      Pensez à exporter une sauvegarde avant si nécessaire.
--
--  Import : phpMyAdmin → sélectionnez la base → onglet « Importer »
--           → choisissez ce fichier « schema.sql » → « Exécuter ».
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `suivi_assurance_salfa`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `suivi_assurance_salfa`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- Table `lignes_paiement` (d'abord : dépend conceptuellement de paiements)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `lignes_paiement`;
CREATE TABLE `lignes_paiement` (
  `id`                  VARCHAR(50)  NOT NULL,
  `paiement_id`         VARCHAR(50)  NOT NULL,
  `ligne_prestation_id` VARCHAR(50)  DEFAULT NULL,
  `prestation_id`       VARCHAR(50)  DEFAULT NULL,
  `immatriculation`     VARCHAR(100) DEFAULT NULL,
  `nom_base_assurance`  VARCHAR(255) DEFAULT NULL,
  `nom_agent`           VARCHAR(255) DEFAULT NULL,
  `prestation_numero`   VARCHAR(100) DEFAULT NULL,
  `date_soins`          VARCHAR(20)  DEFAULT NULL,
  `total_paye`          DECIMAL(15,2) DEFAULT 0.00,
  `ticket_moderateur`   DECIMAL(15,2) DEFAULT 0.00,
  `montant_exclu`       DECIMAL(15,2) DEFAULT 0.00,
  `montant_reclame`     DECIMAL(15,2) DEFAULT 0.00,
  `code_acte`           VARCHAR(50)  DEFAULT NULL,
  `libelle_acte`        VARCHAR(255) DEFAULT NULL,
  `actes_payes`         LONGTEXT     DEFAULT NULL,
  `commentaire`         TEXT         DEFAULT NULL,
  `position`            INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_lgp_paiement` (`paiement_id`),
  KEY `idx_lgp_prestation` (`prestation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table `paiements` (bordereaux de règlement)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `paiements`;
CREATE TABLE `paiements` (
  `id`                 VARCHAR(50)  NOT NULL,
  `numero_bordereau`   VARCHAR(100) NOT NULL,
  `date_paiement`      VARCHAR(20)  DEFAULT NULL,
  `date_soins`         VARCHAR(20)  DEFAULT NULL,
  `date_saisie`        VARCHAR(30)  DEFAULT NULL,
  `societe_id`         VARCHAR(50)  NOT NULL,
  `societe_nom`        VARCHAR(255) DEFAULT NULL,
  `sous_societe`       VARCHAR(255) DEFAULT NULL,
  `nom_agent`          VARCHAR(255) DEFAULT NULL,
  `matricule`          VARCHAR(100) DEFAULT NULL,
  `prestation_id`      VARCHAR(50)  DEFAULT NULL,
  `prestation_numero`  VARCHAR(100) DEFAULT NULL,
  `mode_paiement`      VARCHAR(50)  DEFAULT 'Virement bancaire',
  `reference_paiement` VARCHAR(100) DEFAULT NULL,
  `total_reclame`      DECIMAL(15,2) DEFAULT 0.00,
  `total_paye`         DECIMAL(15,2) DEFAULT 0.00,
  `total_moderateur`   DECIMAL(15,2) DEFAULT 0.00,
  `total_exclu`        DECIMAL(15,2) DEFAULT 0.00,
  `remise`             DECIMAL(15,2) DEFAULT 0.00,
  `statut`             VARCHAR(50)  DEFAULT 'Validé',
  `notes`              TEXT         DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_paiements_societe` (`societe_id`),
  KEY `idx_paiements_date` (`date_paiement`),
  KEY `idx_paiements_bordereau` (`numero_bordereau`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table `lignes_prestation` (actes médicaux d'une prestation)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `lignes_prestation`;
CREATE TABLE `lignes_prestation` (
  `id`                   VARCHAR(50)  NOT NULL,
  `prestation_id`        VARCHAR(50)  NOT NULL,
  `code`                 VARCHAR(50)  NOT NULL,
  `libelle`              VARCHAR(255) DEFAULT NULL,
  `total_prestation`     DECIMAL(15,2) DEFAULT 0.00,
  `ticket_moderateur`    DECIMAL(15,2) DEFAULT 0.00,
  `montant_a_rembourser` DECIMAL(15,2) DEFAULT 0.00,
  `total_paye`           DECIMAL(15,2) DEFAULT 0.00,
  `montant_exclu`        DECIMAL(15,2) DEFAULT 0.00,
  `motif_exclusion`      TEXT         DEFAULT NULL,
  `statut`               VARCHAR(50)  DEFAULT 'En attente',
  `position`             INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_lpp_prestation` (`prestation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table `prestations` (factures / décomptes médicaux)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `prestations`;
CREATE TABLE `prestations` (
  `id`                   VARCHAR(50)  NOT NULL,
  `numero_facture`       VARCHAR(100) NOT NULL,
  `date`                 VARCHAR(20)  DEFAULT NULL,
  `societe_id`           VARCHAR(50)  NOT NULL,
  `societe_nom`          VARCHAR(255) DEFAULT NULL,
  `sous_societe`         VARCHAR(255) DEFAULT NULL,
  `personne_id`          VARCHAR(50)  NOT NULL,
  `nom_agent`            VARCHAR(255) DEFAULT NULL,
  `matricule`            VARCHAR(100) DEFAULT NULL,
  `total_prestation`     DECIMAL(15,2) DEFAULT 0.00,
  `participation`        DECIMAL(15,2) DEFAULT 0.00,
  `montant_a_rembourser` DECIMAL(15,2) DEFAULT 0.00,
  `total_paye`           DECIMAL(15,2) DEFAULT 0.00,
  `montant_exclu`        DECIMAL(15,2) DEFAULT 0.00,
  `motif_exclusion`      TEXT         DEFAULT NULL,
  `reste_a_payer`        DECIMAL(15,2) DEFAULT 0.00,
  `statut`               VARCHAR(50)  DEFAULT 'En attente',
  `date_creation`        VARCHAR(30)  DEFAULT NULL,
  `date_paiement`        VARCHAR(20)  DEFAULT NULL,
  `numero_bordereau`     VARCHAR(100) DEFAULT NULL,
  `commentaires`         TEXT         DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_prestations_societe` (`societe_id`),
  KEY `idx_prestations_personne` (`personne_id`),
  KEY `idx_prestations_numero` (`numero_facture`),
  KEY `idx_prestations_date` (`date`),
  KEY `idx_prestations_statut` (`statut`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table `personnes` (adhérents, conjoints, enfants, ayants droit)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `personnes`;
CREATE TABLE `personnes` (
  `id`              VARCHAR(50)  NOT NULL,
  `nom_prenom`      VARCHAR(255) NOT NULL,
  `matricule`       VARCHAR(100) NOT NULL,
  `societe_id`      VARCHAR(50)  NOT NULL,
  `sous_societe`    VARCHAR(255) DEFAULT NULL,
  `qualite`         VARCHAR(100) DEFAULT 'Adhérent Principal',
  `famille_code`    VARCHAR(50)  DEFAULT NULL,
  `date_naissance`  VARCHAR(20)  DEFAULT NULL,
  `telephone`       VARCHAR(100) DEFAULT NULL,
  `email`           VARCHAR(255) DEFAULT NULL,
  `taux_couverture` DECIMAL(5,2) DEFAULT NULL,
  `statut`          VARCHAR(50)  DEFAULT 'Actif',
  PRIMARY KEY (`id`),
  KEY `idx_personnes_societe` (`societe_id`),
  KEY `idx_personnes_matricule` (`matricule`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table `societes` (organismes d'assurance / sociétés affiliées)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `societes`;
CREATE TABLE `societes` (
  `id`                     VARCHAR(50)  NOT NULL,
  `nom`                    VARCHAR(255) NOT NULL,
  `code`                   VARCHAR(50)  NOT NULL,
  `contact`                VARCHAR(255) DEFAULT NULL,
  `telephone`              VARCHAR(100) DEFAULT NULL,
  `email`                  VARCHAR(255) DEFAULT NULL,
  `adresse`                TEXT         DEFAULT NULL,
  `taux_couverture_defaut` DECIMAL(5,2) DEFAULT 100.00,
  PRIMARY KEY (`id`),
  KEY `idx_societes_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table `familles` (familles de prestations : codes, plafonds, tarifs)
-- --------------------------------------------------------
DROP TABLE IF EXISTS `familles`;
CREATE TABLE `familles` (
  `id`                       VARCHAR(50)   NOT NULL,
  `code`                     VARCHAR(50)   NOT NULL,
  `libelle`                  VARCHAR(255)  NOT NULL,
  `plafond_annuel`           DECIMAL(15,2) DEFAULT NULL,
  `taux_standard`            DECIMAL(5,2)  DEFAULT NULL,
  `tarif_conventionne`       DECIMAL(15,2) DEFAULT NULL,
  `ticket_moderateur_defaut` DECIMAL(15,2) DEFAULT NULL,
  `description`              TEXT          DEFAULT NULL,
  `aliases`                  TEXT          DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_familles_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Données initiales : Sociétés d'assurance principales
-- --------------------------------------------------------
INSERT INTO `societes` (`id`, `nom`, `code`, `contact`, `telephone`, `email`, `adresse`, `taux_couverture_defaut`) VALUES
('soc-mcicare', 'MCI CARE', 'MCI CARE', 'Direction Santé & Tiers-Payant', '+261 20 22 200 00', 'contact@mcicare.mg', 'Antananarivo, Madagascar', 100.00),
('soc-bsa', 'BSA', 'BSA', 'Direction Médicale & ASK GS', '+261 20 22 300 00', 'contact@bsa.mg', 'Andraharo, Antananarivo, Madagascar', 100.00),
('soc-ascoma', 'ASCOMA', 'ASCOMA', 'Direction Santé & Tiers-Payant', '+261 20 22 400 00', 'sante@ascoma.mg', 'Antananarivo, Madagascar', 100.00),
('soc-sanlam', 'SANLAMALLIANZ', 'SANLAM', 'Direction Santé & Sinistres', '+261 20 22 200 01', 'sante@sanlam.mg', 'Antananarivo, Madagascar', 100.00),
('soc-nyhavana', 'NY HAVANA', 'NY HAVANA', 'Direction Santé & Sinistres', '+261 20 22 211 44', 'sante@nyhavana.mg', 'Antananarivo, Madagascar', 100.00)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `code` = VALUES(`code`),
  `contact` = VALUES(`contact`),
  `telephone` = VALUES(`telephone`),
  `email` = VALUES(`email`),
  `adresse` = VALUES(`adresse`),
  `taux_couverture_defaut` = VALUES(`taux_couverture_defaut`);

-- --------------------------------------------------------
-- Données initiales : Familles de prestations & alias de reconnaissance
-- --------------------------------------------------------
INSERT INTO `familles` (`id`, `code`, `libelle`, `plafond_annuel`, `taux_standard`, `tarif_conventionne`, `ticket_moderateur_defaut`, `description`, `aliases`) VALUES
('fam-cons', 'CONS', 'Consultations & Visites Médicales', NULL, NULL, 20000.00, 0.00, 'Consultations de médecine générale et spécialisée', '["CONS","CG","C","CS","CONSULTATION","CONSULT","VISITE","VISITE MEDICALE","MEDECIN","CONSULT. GENERALISTE","GENERALISTE"]'),
('fam-medic', 'MEDIC', 'Pharmacie & Médicaments', NULL, NULL, 0.00, 0.00, 'Médicaments prescrits, spécialités pharmaceutiques et consommables', '["MEDIC","PH","PHSB","PHAR","PHARMACIE","STOCK","PRODUITS PHARMACEUTIQUES","DROGUERIE","MEDICAMENTS","AMLOZAAR","AMOXICILLINE","AMOXICLAV","DOLIPRANE","ZERODOL","MAXILASE","HERBOKOF","MAG 2","BACTOCLAV","DOLOWIN","VITAMINE C"]'),
('fam-labo', 'LABO', 'Analyses & Biologie Médicale', NULL, NULL, 0.00, 0.00, 'Examens de laboratoire, hématologie, biochimie, sérologie', '["LABO","EB","ANALYSES","BIOLOGIE","EXAMENS","TDR","TDR PALU","NFS","BIO","ANALYSE DE LABORATOIRE","SERVICE BIOLOGIE","BIOLOGISTE"]'),
('fam-soins', 'SOINS', 'Soins Infirmiers & Actes Externes', NULL, NULL, 0.00, 0.00, 'Injections, pansements, perfusions, aérosols et soins ambulatoires', '["SOINS","SI","PANSEMENT","INJECTION","PERFUSION","ACTES INFIRMIERS","SOIN","AMI"]'),
('fam-dent', 'DENT', 'Soins & Prothèses Dentaires', NULL, NULL, 50000.00, 0.00, 'Soins conservateurs, extractions, détartrage et prothèses dentaires', '["DENT","DC","DK","CD","DETAR","DSC","SUP 90","DENTAIRE","EXTRACTION","DETARTRAGE","ODONTOLOGIE","RADICULAIRE","PROTHESE DENTAIRE"]'),
('fam-hosp', 'HOSP', 'Hospitalisation & Séjour', NULL, NULL, 60000.00, 0.00, 'Séjours en clinique, frais de chambre, soins intensifs et chirurgie', '["HOSP","HOSPITALISATION","SEJOUR","CHIRURGIE","CHIRURG","ACCOUCHEMENT","BLOC"]'),
('fam-echo', 'ECHO', 'Échographie & Imagerie Médicale', NULL, NULL, 30000.00, 0.00, 'Échographies abdominales, pelviennes, radiographies standard', '["ECHO","ECH","ECHOGRAPHIE","ECHOGRAPHIE PELVIENNE","RADI","RADIO","RADIOLOGIE","SCANNER","IRM","IMAGERIE"]'),
('fam-opht', 'OPHT', 'Ophtalmologie & Optique', NULL, NULL, 25000.00, 0.00, 'Consultations ophtalmologiques, verres correcteurs et montures', '["OPHT","OPHTALMOLOGIE","OPHTA","LUNETTES","VERRES","OPTIQUE","MONTURE"]')
ON DUPLICATE KEY UPDATE
  `libelle` = VALUES(`libelle`),
  `description` = VALUES(`description`),
  `tarif_conventionne` = VALUES(`tarif_conventionne`),
  `aliases` = VALUES(`aliases`);

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
--  FIN DU SCHÉMA — base « suivi_assurance_salfa » prête à l'emploi.
-- =====================================================================
