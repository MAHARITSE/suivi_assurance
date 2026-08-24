-- ====================================================================
-- BASE DE DONNÉES MYSQL - SUIVI ASSURANCE SALFA (WAMP SERVER)
-- ====================================================================
-- Description: Schéma complet et données initiales
-- Serveur cible: MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+
-- Encodage: UTF-8 Unicode (utf8mb4)
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `suivi_assurance_salfa` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `suivi_assurance_salfa`;

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- 1. Table `societes` (Assurances / Organismes Payeurs / Sociétés)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `societes`;
CREATE TABLE `societes` (
  `id` VARCHAR(50) NOT NULL,
  `nom` VARCHAR(255) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `contact` VARCHAR(255) DEFAULT NULL,
  `telephone` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `adresse` TEXT DEFAULT NULL,
  `taux_couverture_defaut` DECIMAL(5,2) DEFAULT 80.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_societes_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertion des 4 assurances/organismes payeurs de référence
INSERT INTO `societes` (`id`, `nom`, `code`, `contact`, `telephone`, `email`, `adresse`, `taux_couverture_defaut`) VALUES
('SOC-MCI', 'MCI CARE', 'MCI', 'Service Tiers Payant MCI', '+261 20 22 123 45', 'contact@mcicare.mg', 'Antananarivo, Madagascar', 80.00),
('SOC-HAVANA', 'NY HAVANA', 'HAVANA', 'Service Sante NY HAVANA', '+261 20 22 543 21', 'sante@nyhavana.mg', 'Antananarivo, Madagascar', 80.00),
('SOC-BSA', 'BSA', 'BSA', 'ASK GS / Gras Savoye BSA', '+261 20 22 999 88', 'contact@bsa.mg', 'Antananarivo, Madagascar', 80.00),
('SOC-ASCOMA', 'ASCOMA', 'ASCOMA', 'Service Sante ASCOMA', '+261 20 22 777 66', 'sante@ascoma.mg', 'Antananarivo, Madagascar', 80.00);

-- --------------------------------------------------------------------
-- 2. Table `personnes` (Bénéficiaires / Patients / Affiliés)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `personnes`;
CREATE TABLE `personnes` (
  `id` VARCHAR(50) NOT NULL,
  `nom_prenom` VARCHAR(255) NOT NULL,
  `matricule` VARCHAR(100) NOT NULL,
  `societe_id` VARCHAR(50) NOT NULL,
  `sous_societe` VARCHAR(255) DEFAULT NULL,
  `qualite` VARCHAR(100) DEFAULT 'Adhérent Principal',
  `famille_code` VARCHAR(50) DEFAULT NULL,
  `date_naissance` VARCHAR(20) DEFAULT NULL,
  `telephone` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `taux_couverture` DECIMAL(5,2) DEFAULT NULL,
  `statut` VARCHAR(50) DEFAULT 'Actif',
  PRIMARY KEY (`id`),
  KEY `idx_personnes_societe` (`societe_id`),
  KEY `idx_personnes_matricule` (`matricule`),
  CONSTRAINT `fk_personnes_societe` FOREIGN KEY (`societe_id`) REFERENCES `societes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exemples de bénéficiaires
INSERT INTO `personnes` (`id`, `nom_prenom`, `matricule`, `societe_id`, `sous_societe`, `qualite`, `famille_code`, `date_naissance`, `telephone`, `email`, `taux_couverture`, `statut`) VALUES
('PERS-001', 'RAKOTO JEAN BAPTISTE', '10405', 'SOC-MCI', 'BRED MADAGASIKARA', 'Adhérent Principal', 'CONS', '1982-05-14', '+261 34 11 222 33', 'jean.rakoto@bred.mg', 80.00, 'Actif'),
('PERS-002', 'RABEMANANJARA MARIE', '20150', 'SOC-HAVANA', 'STAR MADAGASCAR', 'Adhérent Principal', 'PHAR', '1990-11-20', '+261 32 44 555 66', 'm.rabemananjara@star.mg', 80.00, 'Actif'),
('PERS-003', 'RANAIVO HARILALA', '30990', 'SOC-BSA', 'TOTALENERGIES', 'Adhérent Principal', 'LABO', '1988-03-08', '+261 33 77 888 99', 'harilala.ranaivo@total.mg', 80.00, 'Actif'),
('PERS-004', 'RAZAFINDRAKOTO PAUL', '40550', 'SOC-ASCOMA', 'ORANGE MADAGASCAR', 'Adhérent Principal', 'CONS', '1975-09-30', '+261 34 99 000 11', 'paul.razaf@orange.mg', 80.00, 'Actif');

-- --------------------------------------------------------------------
-- 3. Table `familles` (Familles d'actes médicaux / Nomenclatures)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `familles`;
CREATE TABLE `familles` (
  `id` VARCHAR(50) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `libelle` VARCHAR(255) NOT NULL,
  `plafond_annuel` DECIMAL(15,2) DEFAULT NULL,
  `taux_standard` DECIMAL(5,2) DEFAULT 80.00,
  `tarif_conventionne` DECIMAL(15,2) DEFAULT NULL,
  `ticket_moderateur_defaut` DECIMAL(15,2) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `aliases` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_familles_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertion des familles d'actes standards
INSERT INTO `familles` (`id`, `code`, `libelle`, `plafond_annuel`, `taux_standard`, `tarif_conventionne`, `ticket_moderateur_defaut`, `description`, `aliases`) VALUES
('FAM-01', 'CONS', 'Consultation & Soins', 500000.00, 80.00, 25000.00, 5000.00, 'Consultations médicales générales et spécialisées', '["CG","CONSULTATION","SOINS","CONSULT"]'),
('FAM-02', 'PHAR', 'Pharmacie & Médicaments', 1000000.00, 80.00, NULL, NULL, 'Achat de médicaments prescrits sur ordonnance', '["PH","PHARMACIE","MEDICAMENTS","PHSB"]'),
('FAM-03', 'LABO', 'Analyses & Laboratoire', 800000.00, 80.00, NULL, NULL, 'Analyses biologiques, bilans de sang et d urine', '["LAB","LABORATOIRE","ANALYSES","BIO"]'),
('FAM-04', 'DENT', 'Soins Dentaires', 600000.00, 80.00, NULL, NULL, 'Soins dentaires, prothèses et détartrage', '["DENTAIRE","ODONTOLOGIE"]'),
('FAM-05', 'HOSP', 'Hospitalisation', 2000000.00, 80.00, NULL, NULL, 'Frais de séjour hospitalier et interventions', '["HOSPITALISATION","SEJOUR","SUP 90"]'),
('FAM-06', 'ECH', 'Echographie & Imagerie', 500000.00, 80.00, NULL, NULL, 'Examens échographiques et radiographies', '["ECHOGRAPHIE","RADIO","IMAGERIE"]');

-- --------------------------------------------------------------------
-- 4. Table `prestations` (Factures de Soins / Prescriptions)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `prestations`;
CREATE TABLE `prestations` (
  `id` VARCHAR(50) NOT NULL,
  `numero_facture` VARCHAR(100) NOT NULL,
  `date` VARCHAR(20) DEFAULT NULL,
  `societe_id` VARCHAR(50) NOT NULL,
  `societe_nom` VARCHAR(255) DEFAULT NULL,
  `sous_societe` VARCHAR(255) DEFAULT NULL,
  `personne_id` VARCHAR(50) NOT NULL,
  `nom_agent` VARCHAR(255) DEFAULT NULL,
  `matricule` VARCHAR(100) DEFAULT NULL,
  `total_prestation` DECIMAL(15,2) DEFAULT 0.00,
  `participation` DECIMAL(15,2) DEFAULT 0.00,
  `montant_a_rembourser` DECIMAL(15,2) DEFAULT 0.00,
  `total_paye` DECIMAL(15,2) DEFAULT 0.00,
  `montant_exclu` DECIMAL(15,2) DEFAULT 0.00,
  `motif_exclusion` VARCHAR(255) DEFAULT NULL,
  `reste_a_payer` DECIMAL(15,2) DEFAULT 0.00,
  `statut` VARCHAR(50) DEFAULT 'En attente',
  `date_creation` VARCHAR(30) DEFAULT NULL,
  `commentaires` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_prestations_facture` (`numero_facture`),
  KEY `idx_prestations_societe` (`societe_id`),
  KEY `idx_prestations_personne` (`personne_id`),
  CONSTRAINT `fk_prestations_societe` FOREIGN KEY (`societe_id`) REFERENCES `societes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_prestations_personne` FOREIGN KEY (`personne_id`) REFERENCES `personnes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 5. Table `lignes_prestation` (Détails des actes prescrits)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `lignes_prestation`;
CREATE TABLE `lignes_prestation` (
  `id` VARCHAR(50) NOT NULL,
  `prestation_id` VARCHAR(50) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `libelle` VARCHAR(255) DEFAULT NULL,
  `total_prestation` DECIMAL(15,2) DEFAULT 0.00,
  `ticket_moderateur` DECIMAL(15,2) DEFAULT 0.00,
  `montant_a_rembourser` DECIMAL(15,2) DEFAULT 0.00,
  `total_paye` DECIMAL(15,2) DEFAULT 0.00,
  `montant_exclu` DECIMAL(15,2) DEFAULT 0.00,
  `motif_exclusion` VARCHAR(255) DEFAULT NULL,
  `statut` VARCHAR(50) DEFAULT 'En attente',
  PRIMARY KEY (`id`),
  KEY `idx_lp_prestation` (`prestation_id`),
  CONSTRAINT `fk_lp_prestation` FOREIGN KEY (`prestation_id`) REFERENCES `prestations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 6. Table `paiements` (Bordereaux de Règlement / Décomptes)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `paiements`;
CREATE TABLE `paiements` (
  `id` VARCHAR(50) NOT NULL,
  `numero_bordereau` VARCHAR(100) NOT NULL,
  `date_paiement` VARCHAR(20) DEFAULT NULL,
  `date_soins` VARCHAR(20) DEFAULT NULL,
  `date_saisie` VARCHAR(30) DEFAULT NULL,
  `societe_id` VARCHAR(50) NOT NULL,
  `societe_nom` VARCHAR(255) DEFAULT NULL,
  `sous_societe` VARCHAR(255) DEFAULT NULL,
  `nom_agent` VARCHAR(255) DEFAULT NULL,
  `matricule` VARCHAR(100) DEFAULT NULL,
  `prestation_id` VARCHAR(50) DEFAULT NULL,
  `prestation_numero` VARCHAR(100) DEFAULT NULL,
  `mode_paiement` VARCHAR(50) DEFAULT NULL,
  `reference_paiement` VARCHAR(100) DEFAULT NULL,
  `total_reclame` DECIMAL(15,2) DEFAULT 0.00,
  `total_paye` DECIMAL(15,2) DEFAULT 0.00,
  `total_moderateur` DECIMAL(15,2) DEFAULT 0.00,
  `total_exclu` DECIMAL(15,2) DEFAULT 0.00,
  `remise` DECIMAL(15,2) DEFAULT 0.00,
  `statut` VARCHAR(50) DEFAULT 'Validé',
  `notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_paiements_bordereau` (`numero_bordereau`),
  KEY `idx_paiements_societe` (`societe_id`),
  CONSTRAINT `fk_paiements_societe` FOREIGN KEY (`societe_id`) REFERENCES `societes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 7. Table `lignes_paiement` (Lignes de décompte de paiement)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `lignes_paiement`;
CREATE TABLE `lignes_paiement` (
  `id` VARCHAR(50) NOT NULL,
  `paiement_id` VARCHAR(50) NOT NULL,
  `ligne_prestation_id` VARCHAR(50) DEFAULT NULL,
  `prestation_id` VARCHAR(50) DEFAULT NULL,
  `immatriculation` VARCHAR(100) DEFAULT NULL,
  `nom_base_assurance` VARCHAR(255) DEFAULT NULL,
  `nom_agent` VARCHAR(255) DEFAULT NULL,
  `prestation_numero` VARCHAR(100) DEFAULT NULL,
  `date_soins` VARCHAR(20) DEFAULT NULL,
  `total_paye` DECIMAL(15,2) DEFAULT 0.00,
  `ticket_moderateur` DECIMAL(15,2) DEFAULT 0.00,
  `montant_exclu` DECIMAL(15,2) DEFAULT 0.00,
  `montant_reclame` DECIMAL(15,2) DEFAULT 0.00,
  `code_acte` VARCHAR(50) DEFAULT NULL,
  `libelle_acte` VARCHAR(255) DEFAULT NULL,
  `actes_payes` LONGTEXT DEFAULT NULL,
  `commentaire` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lp_paiement` (`paiement_id`),
  CONSTRAINT `fk_lp_paiement` FOREIGN KEY (`paiement_id`) REFERENCES `paiements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 8. Table `entete_config` (Configuration de l'en-tête de document)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `entete_config`;
CREATE TABLE `entete_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nom_etablissement` VARCHAR(255) DEFAULT 'HOPITALY LOTERANA TOLIARY TANAMBAO',
  `sous_titre` VARCHAR(255) DEFAULT 'Département de la Santé / SALFA Madagascar',
  `adresse` VARCHAR(255) DEFAULT 'Tanambao, B.P. 112',
  `ville` VARCHAR(100) DEFAULT 'Toliara (601), Madagascar',
  `telephone` VARCHAR(100) DEFAULT '+261 34 00 000 00 / +261 20 94 410 00',
  `email` VARCHAR(255) DEFAULT 'hopitaly.toliara@salfa.mg',
  `nif` VARCHAR(100) DEFAULT 'NIF: 3000123456',
  `stat` VARCHAR(100) DEFAULT 'STAT: 85110 21 1998 0 10123',
  `logo_base64` LONGTEXT DEFAULT NULL,
  `couleur_principale` VARCHAR(20) DEFAULT '#1e3a8a',
  `couleur_secondaire` VARCHAR(20) DEFAULT '#0d9488',
  `style_alignement` VARCHAR(20) DEFAULT 'center',
  `pied_de_page` TEXT DEFAULT 'Document généré automatiquement par le logiciel Suivi Assurance SALFA.'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `entete_config` (`id`, `nom_etablissement`, `sous_titre`, `adresse`, `ville`, `telephone`, `email`) VALUES
(1, 'HOPITALY LOTERANA TOLIARY TANAMBAO', 'Département de la Santé / SALFA Madagascar', 'Tanambao, B.P. 112', 'Toliara (601), Madagascar', '+261 34 00 000 00 / +261 20 94 410 00', 'hopitaly.toliara@salfa.mg');

SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
-- FIN DU SCHEMA DE BASE DE DONNEES MYSQL
-- ====================================================================
