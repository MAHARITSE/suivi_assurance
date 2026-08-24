import { Societe, Personne, Famille, Prestation, Paiement } from '../types';

export const initialSocietes: Societe[] = [
  {
    id: 'soc-mcicare',
    nom: 'MCI CARE',
    code: 'MCI CARE',
    contact: 'Direction Santé & Tiers-Payant',
    telephone: '+261 20 22 200 00',
    email: 'contact@mcicare.mg',
    adresse: 'Antananarivo, Madagascar',
    tauxCouvertureDefaut: 100,
  },
  {
    id: 'soc-bsa',
    nom: 'BSA',
    code: 'BSA',
    contact: 'Direction Médicale & ASK GS',
    telephone: '+261 20 22 300 00',
    email: 'contact@bsa.mg',
    adresse: 'Andraharo, Antananarivo, Madagascar',
    tauxCouvertureDefaut: 100,
  },
  {
    id: 'soc-ascoma',
    nom: 'ASCOMA',
    code: 'ASCOMA',
    contact: 'Direction Santé & Tiers-Payant',
    telephone: '+261 20 22 400 00',
    email: 'sante@ascoma.mg',
    adresse: 'Antananarivo, Madagascar',
    tauxCouvertureDefaut: 100,
  },
  {
    id: 'soc-sanlam',
    nom: 'SANLAMALLIANZ',
    code: 'SANLAM',
    contact: 'Direction Santé & Sinistres',
    telephone: '+261 20 22 200 01',
    email: 'sante@sanlam.mg',
    adresse: 'Antananarivo, Madagascar',
    tauxCouvertureDefaut: 100,
  },
  {
    id: 'soc-nyhavana',
    nom: 'NY HAVANA',
    code: 'NY HAVANA',
    contact: 'Direction Santé & Sinistres',
    telephone: '+261 20 22 211 44',
    email: 'sante@nyhavana.mg',
    adresse: 'Antananarivo, Madagascar',
    tauxCouvertureDefaut: 100,
  }
];

export const initialFamilles: Famille[] = [
  {
    id: 'fam-cons',
    code: 'CONS',
    libelle: 'Consultations & Visites Médicales',
    description: 'Consultations de médecine générale et spécialisée',
    tarifConventionne: 20000,
    ticketModerateurDefaut: 0,
    aliases: ['CONS', 'CG', 'C', 'CS', 'CONSULTATION', 'CONSULT', 'VISITE', 'VISITE MEDICALE', 'MEDECIN', 'CONSULT. GENERALISTE', 'GENERALISTE'],
  },
  {
    id: 'fam-medic',
    code: 'MEDIC',
    libelle: 'Pharmacie & Médicaments',
    description: 'Médicaments prescrits, spécialités pharmaceutiques et consommables',
    tarifConventionne: 0,
    ticketModerateurDefaut: 0,
    aliases: ['MEDIC', 'PH', 'PHSB', 'PHAR', 'PHARMACIE', 'STOCK', 'PRODUITS PHARMACEUTIQUES', 'DROGUERIE', 'MEDICAMENTS', 'AMLOZAAR', 'AMOXICILLINE', 'AMOXICLAV', 'DOLIPRANE', 'ZERODOL', 'MAXILASE', 'HERBOKOF', 'MAG 2', 'BACTOCLAV', 'DOLOWIN', 'VITAMINE C'],
  },
  {
    id: 'fam-labo',
    code: 'LABO',
    libelle: 'Analyses & Biologie Médicale',
    description: 'Examens de laboratoire, hématologie, biochimie, sérologie',
    tarifConventionne: 0,
    ticketModerateurDefaut: 0,
    aliases: ['LABO', 'EB', 'ANALYSES', 'BIOLOGIE', 'EXAMENS', 'TDR', 'TDR PALU', 'NFS', 'BIO', 'ANALYSE DE LABORATOIRE', 'SERVICE BIOLOGIE', 'BIOLOGISTE'],
  },
  {
    id: 'fam-soins',
    code: 'SOINS',
    libelle: 'Soins Infirmiers & Actes Externes',
    description: 'Injections, pansements, perfusions, aérosols et soins ambulatoires',
    tarifConventionne: 0,
    ticketModerateurDefaut: 0,
    aliases: ['SOINS', 'SI', 'PANSEMENT', 'INJECTION', 'PERFUSION', 'ACTES INFIRMIERS', 'SOIN', 'AMI'],
  },
  {
    id: 'fam-dent',
    code: 'DENT',
    libelle: 'Soins & Prothèses Dentaires',
    description: 'Soins conservateurs, extractions, détartrage et prothèses dentaires',
    tarifConventionne: 50000,
    ticketModerateurDefaut: 0,
    aliases: ['DENT', 'DC', 'DK', 'CD', 'DETAR', 'DSC', 'SUP 90', 'DENTAIRE', 'EXTRACTION', 'DETARTRAGE', 'ODONTOLOGIE', 'RADICULAIRE', 'PROTHESE DENTAIRE'],
  },
  {
    id: 'fam-hosp',
    code: 'HOSP',
    libelle: 'Hospitalisation & Séjour',
    description: 'Séjours en clinique, frais de chambre, soins intensifs et chirurgie',
    tarifConventionne: 60000,
    ticketModerateurDefaut: 0,
    aliases: ['HOSP', 'HOSPITALISATION', 'SEJOUR', 'CHIRURGIE', 'CHIRURG', 'ACCOUCHEMENT', 'BLOC'],
  },
  {
    id: 'fam-echo',
    code: 'ECHO',
    libelle: 'Échographie & Imagerie Médicale',
    description: 'Échographies abdominales, pelviennes, radiographies standard',
    tarifConventionne: 30000,
    ticketModerateurDefaut: 0,
    aliases: ['ECHO', 'ECH', 'ECHOGRAPHIE', 'ECHOGRAPHIE PELVIENNE', 'RADI', 'RADIO', 'RADIOLOGIE', 'SCANNER', 'IRM', 'IMAGERIE'],
  },
  {
    id: 'fam-opht',
    code: 'OPHT',
    libelle: 'Ophtalmologie & Optique',
    description: 'Consultations ophtalmologiques, verres correcteurs et montures',
    tarifConventionne: 25000,
    ticketModerateurDefaut: 0,
    aliases: ['OPHT', 'OPHTALMOLOGIE', 'OPHTA', 'LUNETTES', 'VERRES', 'OPTIQUE', 'MONTURE'],
  }
];

export const initialPersonnes: Personne[] = [];

export const initialPrestations: Prestation[] = [];

export const initialPaiements: Paiement[] = [];
