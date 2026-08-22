-- ========================================================
-- SCHEMA BASE DE DONNEES MYSQL POUR WAMP SERVER
-- Application : Suivi Assurances & Tiers-Payant SALFA
-- Base de données : suivi_assurance_salfa
-- Compatible : MySQL 5.7+, MySQL 8.0+, MariaDB, WAMP Server
-- ========================================================

CREATE DATABASE IF NOT EXISTS `suivi_assurance_salfa` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `suivi_assurance_salfa`;

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- Table : societes
-- --------------------------------------------------------
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table : personnes
-- --------------------------------------------------------
DROP TABLE IF EXISTS `personnes`;
CREATE TABLE `personnes` (
  `id` VARCHAR(50) NOT NULL,
  `nom_prenom` VARCHAR(255) NOT NULL,
  `matricule` VARCHAR(100) NOT NULL,
  `societe_id` VARCHAR(50) NOT NULL,
  `sous_societe` VARCHAR(255) DEFAULT NULL,
  `qualite` VARCHAR(100) DEFAULT NULL,
  `famille_code` VARCHAR(50) DEFAULT NULL,
  `date_naissance` VARCHAR(20) DEFAULT NULL,
  `telephone` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `taux_couverture` DECIMAL(5,2) DEFAULT NULL,
  `statut` VARCHAR(50) DEFAULT 'Actif',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table : familles
-- --------------------------------------------------------
DROP TABLE IF EXISTS `familles`;
CREATE TABLE `familles` (
  `id` VARCHAR(50) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `libelle` VARCHAR(255) NOT NULL,
  `plafond_annuel` DECIMAL(15,2) DEFAULT NULL,
  `taux_standard` DECIMAL(5,2) DEFAULT NULL,
  `tarif_conventionne` DECIMAL(15,2) DEFAULT NULL,
  `ticket_moderateur_defaut` DECIMAL(15,2) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `aliases` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table : prestations
-- --------------------------------------------------------
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
  `reste_a_payer` DECIMAL(15,2) DEFAULT 0.00,
  `statut` VARCHAR(50) DEFAULT 'En attente',
  `date_creation` VARCHAR(30) DEFAULT NULL,
  `commentaires` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table : lignes_prestation
-- --------------------------------------------------------
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
  `statut` VARCHAR(50) DEFAULT 'En attente',
  PRIMARY KEY (`id`),
  KEY `idx_lp_prestation` (`prestation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table : paiements
-- --------------------------------------------------------
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table : lignes_paiement
-- --------------------------------------------------------
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
  KEY `idx_lp_paiement` (`paiement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
