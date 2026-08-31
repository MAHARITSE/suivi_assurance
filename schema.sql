-- ========================================================
-- BASE DE DONNÉES : suivi_assurance_salfa
-- SYSTÈME DE GESTION DES PRESTATIONS & RÈGLEMENTS D'ASSURANCE SALFA
-- Architecture : 100% MySQL Client-Serveur Multi-Poste
-- Compatible MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+ (WAMP / XAMPP)
-- ========================================================

CREATE DATABASE IF NOT EXISTS `suivi_assurance_salfa` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `suivi_assurance_salfa`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- --------------------------------------------------------
-- 1. Table `societes` (Sociétés clientes, Garants & Assurances)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `societes` (
  `id` VARCHAR(100) NOT NULL,
  `nom` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) DEFAULT NULL,
  `contact` VARCHAR(255) DEFAULT NULL,
  `telephone` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `adresse` TEXT DEFAULT NULL,
  `taux_couverture_defaut` DECIMAL(5,2) DEFAULT 80.00,
  `data` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_societes_nom` (`nom`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 2. Table `familles` (Nomenclatures & Familles d'actes)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `familles` (
  `id` VARCHAR(100) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `libelle` VARCHAR(255) NOT NULL,
  `plafond_annuel` DECIMAL(15,2) DEFAULT NULL,
  `taux_standard` DECIMAL(5,2) DEFAULT NULL,
  `tarif_conventionne` DECIMAL(15,2) DEFAULT NULL,
  `ticket_moderateur_defaut` DECIMAL(15,2) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `aliases` LONGTEXT DEFAULT NULL,
  `data` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_familles_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3. Table `personnes` (Adhérents, Assurés & Ayants droit)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `personnes` (
  `id` VARCHAR(100) NOT NULL,
  `nom_prenom` VARCHAR(255) NOT NULL,
  `matricule` VARCHAR(100) DEFAULT NULL,
  `societe_id` VARCHAR(100) NOT NULL,
  `sous_societe` VARCHAR(255) DEFAULT NULL,
  `qualite` VARCHAR(100) DEFAULT 'Adhérent Principal',
  `famille_code` VARCHAR(100) DEFAULT NULL,
  `date_naissance` VARCHAR(100) DEFAULT NULL,
  `telephone` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `taux_couverture` DECIMAL(5,2) DEFAULT NULL,
  `statut` VARCHAR(100) DEFAULT 'Actif',
  `data` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_personnes_matricule` (`matricule`),
  KEY `idx_personnes_societe` (`societe_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 4. Table `prestations` (Factures de Soins & Prises en Charge)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `prestations` (
  `id` VARCHAR(100) NOT NULL,
  `numero_facture` VARCHAR(255) NOT NULL,
  `date` VARCHAR(100) DEFAULT NULL,
  `societe_id` VARCHAR(100) NOT NULL,
  `societe_nom` VARCHAR(255) DEFAULT NULL,
  `sous_societe` VARCHAR(255) DEFAULT NULL,
  `personne_id` VARCHAR(100) DEFAULT NULL,
  `nom_agent` VARCHAR(255) DEFAULT NULL,
  `matricule` VARCHAR(100) DEFAULT NULL,
  `total_prestation` DECIMAL(15,2) DEFAULT 0.00,
  `participation` DECIMAL(15,2) DEFAULT 0.00,
  `montant_a_rembourser` DECIMAL(15,2) DEFAULT 0.00,
  `total_paye` DECIMAL(15,2) DEFAULT 0.00,
  `montant_exclu` DECIMAL(15,2) DEFAULT 0.00,
  `motif_exclusion` TEXT DEFAULT NULL,
  `reste_a_payer` DECIMAL(15,2) DEFAULT 0.00,
  `statut` VARCHAR(100) DEFAULT 'En attente',
  `date_creation` VARCHAR(100) DEFAULT NULL,
  `date_paiement` VARCHAR(100) DEFAULT NULL,
  `numero_bordereau` VARCHAR(255) DEFAULT NULL,
  `commentaires` TEXT DEFAULT NULL,
  `data` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_prestations_facture` (`numero_facture`),
  KEY `idx_prestations_societe` (`societe_id`),
  KEY `idx_prestations_statut` (`statut`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 5. Table `lignes_prestation` (Actes détaillés des prestations)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lignes_prestation` (
  `id` VARCHAR(100) NOT NULL,
  `prestation_id` VARCHAR(100) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `libelle` VARCHAR(255) DEFAULT NULL,
  `total_prestation` DECIMAL(15,2) DEFAULT 0.00,
  `ticket_moderateur` DECIMAL(15,2) DEFAULT 0.00,
  `montant_a_rembourser` DECIMAL(15,2) DEFAULT 0.00,
  `total_paye` DECIMAL(15,2) DEFAULT 0.00,
  `montant_exclu` DECIMAL(15,2) DEFAULT 0.00,
  `motif_exclusion` TEXT DEFAULT NULL,
  `statut` VARCHAR(100) DEFAULT 'En attente',
  `data` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lp_prestation` (`prestation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 6. Table `paiements` (Règlements & Décomptes d'assurance)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `paiements` (
  `id` VARCHAR(100) NOT NULL,
  `numero_bordereau` VARCHAR(255) NOT NULL,
  `date_paiement` VARCHAR(100) DEFAULT NULL,
  `date_soins` VARCHAR(100) DEFAULT NULL,
  `date_saisie` VARCHAR(100) DEFAULT NULL,
  `societe_id` VARCHAR(100) NOT NULL,
  `societe_nom` VARCHAR(255) DEFAULT NULL,
  `sous_societe` VARCHAR(255) DEFAULT NULL,
  `nom_agent` VARCHAR(255) DEFAULT NULL,
  `matricule` VARCHAR(100) DEFAULT NULL,
  `prestation_id` VARCHAR(100) DEFAULT NULL,
  `prestation_numero` VARCHAR(255) DEFAULT NULL,
  `mode_paiement` VARCHAR(100) DEFAULT 'Virement bancaire',
  `reference_paiement` VARCHAR(255) DEFAULT NULL,
  `total_reclame` DECIMAL(15,2) DEFAULT 0.00,
  `total_paye` DECIMAL(15,2) DEFAULT 0.00,
  `total_moderateur` DECIMAL(15,2) DEFAULT 0.00,
  `total_exclu` DECIMAL(15,2) DEFAULT 0.00,
  `remise` DECIMAL(15,2) DEFAULT 0.00,
  `statut` VARCHAR(100) DEFAULT 'Validé',
  `notes` TEXT DEFAULT NULL,
  `data` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_paiements_bordereau` (`numero_bordereau`),
  KEY `idx_paiements_societe` (`societe_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 7. Table `lignes_paiement` (Lignes détaillées des règlements)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lignes_paiement` (
  `id` VARCHAR(100) NOT NULL,
  `paiement_id` VARCHAR(100) NOT NULL,
  `ligne_prestation_id` VARCHAR(100) DEFAULT NULL,
  `prestation_id` VARCHAR(100) DEFAULT NULL,
  `immatriculation` VARCHAR(100) DEFAULT NULL,
  `nom_base_assurance` VARCHAR(255) DEFAULT NULL,
  `nom_agent` VARCHAR(255) DEFAULT NULL,
  `prestation_numero` VARCHAR(255) DEFAULT NULL,
  `date_soins` VARCHAR(100) DEFAULT NULL,
  `total_paye` DECIMAL(15,2) DEFAULT 0.00,
  `ticket_moderateur` DECIMAL(15,2) DEFAULT 0.00,
  `montant_exclu` DECIMAL(15,2) DEFAULT 0.00,
  `montant_reclame` DECIMAL(15,2) DEFAULT 0.00,
  `code_acte` VARCHAR(100) DEFAULT NULL,
  `libelle_acte` VARCHAR(255) DEFAULT NULL,
  `actes_payes` LONGTEXT DEFAULT NULL,
  `commentaire` TEXT DEFAULT NULL,
  `data` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lp_paiement` (`paiement_id`),
  KEY `idx_lp_prestation_ref` (`prestation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 8. Données par Défaut : Sociétés d'Assurance & Tiers-Payeurs
-- --------------------------------------------------------
INSERT INTO `societes` (`id`, `nom`, `code`, `contact`, `telephone`, `email`, `adresse`, `taux_couverture_defaut`, `data`) VALUES
('soc-mcicare', 'MCI CARE', 'MCI CARE', 'Direction Santé & Tiers-Payant', '+261 20 22 200 00', 'contact@mcicare.mg', 'Antananarivo, Madagascar', 100.00, '{"id":"soc-mcicare","nom":"MCI CARE","code":"MCI CARE","contact":"Direction Santé & Tiers-Payant","telephone":"+261 20 22 200 00","email":"contact@mcicare.mg","adresse":"Antananarivo, Madagascar","tauxCouvertureDefaut":100}'),
('soc-bsa', 'BSA', 'BSA', 'Direction Médicale & ASK GS', '+261 20 22 300 00', 'contact@bsa.mg', 'Andraharo, Antananarivo, Madagascar', 100.00, '{"id":"soc-bsa","nom":"BSA","code":"BSA","contact":"Direction Médicale & ASK GS","telephone":"+261 20 22 300 00","email":"contact@bsa.mg","adresse":"Andraharo, Antananarivo, Madagascar","tauxCouvertureDefaut":100}'),
('soc-ascoma', 'ASCOMA', 'ASCOMA', 'Direction Santé & Tiers-Payant', '+261 20 22 400 00', 'sante@ascoma.mg', 'Antananarivo, Madagascar', 100.00, '{"id":"soc-ascoma","nom":"ASCOMA","code":"ASCOMA","contact":"Direction Santé & Tiers-Payant","telephone":"+261 20 22 400 00","email":"sante@ascoma.mg","adresse":"Antananarivo, Madagascar","tauxCouvertureDefaut":100}'),
('soc-sanlam', 'SANLAMALLIANZ', 'SANLAM', 'Direction Santé & Sinistres', '+261 20 22 200 01', 'sante@sanlam.mg', 'Antananarivo, Madagascar', 100.00, '{"id":"soc-sanlam","nom":"SANLAMALLIANZ","code":"SANLAM","contact":"Direction Santé & Sinistres","telephone":"+261 20 22 200 01","email":"sante@sanlam.mg","adresse":"Antananarivo, Madagascar","tauxCouvertureDefaut":100}'),
('soc-nyhavana', 'NY HAVANA', 'NY HAVANA', 'Direction Santé & Sinistres', '+261 20 22 211 44', 'sante@nyhavana.mg', 'Antananarivo, Madagascar', 100.00, '{"id":"soc-nyhavana","nom":"NY HAVANA","code":"NY HAVANA","contact":"Direction Santé & Sinistres","telephone":"+261 20 22 211 44","email":"sante@nyhavana.mg","adresse":"Antananarivo, Madagascar","tauxCouvertureDefaut":100}')
ON DUPLICATE KEY UPDATE 
  `nom` = VALUES(`nom`),
  `code` = VALUES(`code`),
  `contact` = VALUES(`contact`),
  `telephone` = VALUES(`telephone`),
  `email` = VALUES(`email`),
  `adresse` = VALUES(`adresse`),
  `taux_couverture_defaut` = VALUES(`taux_couverture_defaut`),
  `data` = VALUES(`data`);

-- --------------------------------------------------------
-- 9. Données par Défaut : Familles & Nomenclatures d'actes
-- --------------------------------------------------------
INSERT INTO `familles` (`id`, `code`, `libelle`, `tarif_conventionne`, `ticket_moderateur_defaut`, `description`, `aliases`, `data`) VALUES
('fam-cons', 'CONS', 'Consultations & Visites Médicales', 20000.00, 0.00, 'Consultations de médecine générale et spécialisée', '["CONS","CG","C","CS","CONSULTATION","CONSULT","VISITE","VISITE MEDICALE","MEDECIN","CONSULT. GENERALISTE","GENERALISTE"]', '{"id":"fam-cons","code":"CONS","libelle":"Consultations & Visites Médicales","description":"Consultations de médecine générale et spécialisée","tarifConventionne":20000,"ticketModerateurDefaut":0,"aliases":["CONS","CG","C","CS","CONSULTATION","CONSULT","VISITE","VISITE MEDICALE","MEDECIN","CONSULT. GENERALISTE","GENERALISTE"]}'),
('fam-medic', 'MEDIC', 'Pharmacie & Médicaments', 0.00, 0.00, 'Médicaments prescrits, spécialités pharmaceutiques et consommables', '["MEDIC","PH","PHSB","PHAR","PHARMACIE","STOCK","PRODUITS PHARMACEUTIQUES","DROGUERIE","MEDICAMENTS","AMLOZAAR","AMOXICILLINE","AMOXICLAV","DOLIPRANE","ZERODOL","MAXILASE","HERBOKOF","MAG 2","BACTOCLAV","DOLOWIN","VITAMINE C"]', '{"id":"fam-medic","code":"MEDIC","libelle":"Pharmacie & Médicaments","description":"Médicaments prescrits, spécialités pharmaceutiques et consommables","tarifConventionne":0,"ticketModerateurDefaut":0,"aliases":["MEDIC","PH","PHSB","PHAR","PHARMACIE","STOCK","PRODUITS PHARMACEUTIQUES","DROGUERIE","MEDICAMENTS","AMLOZAAR","AMOXICILLINE","AMOXICLAV","DOLIPRANE","ZERODOL","MAXILASE","HERBOKOF","MAG 2","BACTOCLAV","DOLOWIN","VITAMINE C"]}'),
('fam-labo', 'LABO', 'Analyses & Biologie Médicale', 0.00, 0.00, 'Examens de laboratoire, hématologie, biochimie, sérologie', '["LABO","EB","ANALYSES","BIOLOGIE","EXAMENS","TDR","TDR PALU","NFS","BIO","ANALYSE DE LABORATOIRE","SERVICE BIOLOGIE","BIOLOGISTE"]', '{"id":"fam-labo","code":"LABO","libelle":"Analyses & Biologie Médicale","description":"Examens de laboratoire, hématologie, biochimie, sérologie","tarifConventionne":0,"ticketModerateurDefaut":0,"aliases":["LABO","EB","ANALYSES","BIOLOGIE","EXAMENS","TDR","TDR PALU","NFS","BIO","ANALYSE DE LABORATOIRE","SERVICE BIOLOGIE","BIOLOGISTE"]}'),
('fam-soins', 'SOINS', 'Soins Infirmiers & Actes Externes', 0.00, 0.00, 'Injections, pansements, perfusions, aérosols et soins ambulatoires', '["SOINS","SI","PANSEMENT","INJECTION","PERFUSION","ACTES INFIRMIERS","SOIN","AMI"]', '{"id":"fam-soins","code":"SOINS","libelle":"Soins Infirmiers & Actes Externes","description":"Injections, pansements, perfusions, aérosols et soins ambulatoires","tarifConventionne":0,"ticketModerateurDefaut":0,"aliases":["SOINS","SI","PANSEMENT","INJECTION","PERFUSION","ACTES INFIRMIERS","SOIN","AMI"]}'),
('fam-dent', 'DENT', 'Soins & Prothèses Dentaires', 50000.00, 0.00, 'Soins conservateurs, extractions, détartrage et prothèses dentaires', '["DENT","DC","DK","CD","DETAR","DSC","SUP 90","DENTAIRE","EXTRACTION","DETARTRAGE","ODONTOLOGIE","RADICULAIRE","PROTHESE DENTAIRE"]', '{"id":"fam-dent","code":"DENT","libelle":"Soins & Prothèses Dentaires","description":"Soins conservateurs, extractions, détartrage et prothèses dentaires","tarifConventionne":50000,"ticketModerateurDefaut":0,"aliases":["DENT","DC","DK","CD","DETAR","DSC","SUP 90","DENTAIRE","EXTRACTION","DETARTRAGE","ODONTOLOGIE","RADICULAIRE","PROTHESE DENTAIRE"]}'),
('fam-hosp', 'HOSP', 'Hospitalisation & Séjour', 60000.00, 0.00, 'Séjours en clinique, frais de chambre, soins intensifs et chirurgie', '["HOSP","HOSPITALISATION","SEJOUR","CHIRURGIE","CHIRURG","ACCOUCHEMENT","BLOC"]', '{"id":"fam-hosp","code":"HOSP","libelle":"Hospitalisation & Séjour","description":"Séjours en clinique, frais de chambre, soins intensifs et chirurgie","tarifConventionne":60000,"ticketModerateurDefaut":0,"aliases":["HOSP","HOSPITALISATION","SEJOUR","CHIRURGIE","CHIRURG","ACCOUCHEMENT","BLOC"]}'),
('fam-echo', 'ECHO', 'Échographie & Imagerie Médicale', 30000.00, 0.00, 'Échographies abdominales, pelviennes, radiographies standard', '["ECHO","ECH","ECHOGRAPHIE","ECHOGRAPHIE PELVIENNE","RADI","RADIO","RADIOLOGIE","SCANNER","IRM","IMAGERIE"]', '{"id":"fam-echo","code":"ECHO","libelle":"Échographie & Imagerie Médicale","description":"Échographies abdominales, pelviennes, radiographies standard","tarifConventionne":30000,"ticketModerateurDefaut":0,"aliases":["ECHO","ECH","ECHOGRAPHIE","ECHOGRAPHIE PELVIENNE","RADI","RADIO","RADIOLOGIE","SCANNER","IRM","IMAGERIE"]}'),
('fam-opht', 'OPHT', 'Ophtalmologie & Optique', 25000.00, 0.00, 'Consultations ophtalmologiques, verres correcteurs et montures', '["OPHT","OPHTALMOLOGIE","OPHTA","LUNETTES","VERRES","OPTIQUE","MONTURE"]', '{"id":"fam-opht","code":"OPHT","libelle":"Ophtalmologie & Optique","description":"Consultations ophtalmologiques, verres correcteurs et montures","tarifConventionne":25000,"ticketModerateurDefaut":0,"aliases":["OPHT","OPHTALMOLOGIE","OPHTA","LUNETTES","VERRES","OPTIQUE","MONTURE"]}')
ON DUPLICATE KEY UPDATE
  `libelle` = VALUES(`libelle`),
  `tarif_conventionne` = VALUES(`tarif_conventionne`),
  `ticket_moderateur_defaut` = VALUES(`ticket_moderateur_defaut`),
  `description` = VALUES(`description`),
  `aliases` = VALUES(`aliases`),
  `data` = VALUES(`data`);

SET FOREIGN_KEY_CHECKS = 1;
