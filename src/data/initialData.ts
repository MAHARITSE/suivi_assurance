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
    aliases: ['CONS', 'CG', 'CONSULTATION', 'CONSULT', 'VISITE', 'VISITE MEDICALE', 'MEDECIN', 'CS'],
  },
  {
    id: 'fam-medic',
    code: 'MEDIC',
    libelle: 'Pharmacie & Médicaments',
    description: 'Médicaments prescrits, spécialités pharmaceutiques et consommables',
    tarifConventionne: 0,
    ticketModerateurDefaut: 0,
    aliases: ['MEDIC', 'PH', 'PHSB', 'PHAR', 'PHARMACIE', 'STOCK', 'PRODUITS PHARMACEUTIQUES', 'DROGUERIE', 'MEDICAMENTS'],
  },
  {
    id: 'fam-labo',
    code: 'LABO',
    libelle: 'Analyses & Biologie Médicale',
    description: 'Examens de laboratoire, hématologie, biochimie, sérologie',
    tarifConventionne: 0,
    ticketModerateurDefaut: 0,
    aliases: ['LABO', 'EB', 'ANALYSES', 'BIOLOGIE', 'EXAMENS', 'TDR', 'TDR PALU', 'NFS', 'BIO'],
  },
  {
    id: 'fam-soins',
    code: 'SOINS',
    libelle: 'Soins Infirmiers & Actes Externes',
    description: 'Injections, pansements, perfusions, aérosols et soins ambulatoires',
    tarifConventionne: 0,
    ticketModerateurDefaut: 0,
    aliases: ['SOINS', 'SI', 'PANSEMENT', 'INJECTION', 'PERFUSION', 'ACTES INFIRMIERS', 'SOIN'],
  },
  {
    id: 'fam-dent',
    code: 'DENT',
    libelle: 'Soins & Prothèses Dentaires',
    description: 'Soins conservateurs, extractions, détartrage et prothèses dentaires',
    tarifConventionne: 50000,
    ticketModerateurDefaut: 0,
    aliases: ['DENT', 'DC', 'DK', 'DENTAIRE', 'EXTRACTION', 'DETARTRAGE', 'ODONTOLOGIE', 'RADICULAIRE'],
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
    aliases: ['ECHO', 'ECHOGRAPHIE', 'RADI', 'RADIO', 'RADIOLOGIE', 'SCANNER', 'IRM', 'IMAGERIE'],
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
