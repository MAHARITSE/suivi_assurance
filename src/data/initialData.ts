import { Societe, Personne, Famille, Prestation, Paiement } from '../types';

export const initialSocietes: Societe[] = [
  {
    id: 'soc-bsa',
    nom: 'BSA / ASK GS MADAGASCAR',
    code: 'BSA',
    contact: 'Direction Santé & Décomptes',
    telephone: '+261 20 22 690 12',
    email: 'remboursements@bsa-madagascar.com',
    adresse: 'Andraharo, Antananarivo, Madagascar',
    tauxCouvertureDefaut: 100,
  },
  {
    id: 'soc-mci',
    nom: 'MCI CARE MADAGASCAR',
    code: 'MCI',
    contact: 'Direction Sinistres & Tiers-Payant',
    telephone: '+261 20 22 400 00',
    email: 'tierspayant@mcicare.mg',
    adresse: 'Antananarivo, Madagascar',
    tauxCouvertureDefaut: 100,
  },
  {
    id: 'soc-ascoma',
    nom: 'ASCOMA MADAGASCAR (Gras Savoye)',
    code: 'ASCOMA',
    contact: 'Service Décomptes & Règlements',
    telephone: '+261 20 22 225 36',
    email: 'sante@ascoma.mg',
    adresse: 'Antananarivo, Madagascar',
    tauxCouvertureDefaut: 90,
  },
  {
    id: 'soc-salfa',
    nom: 'SALFA - HOPITALY LOTERANA TOLIARY TANAMBAO',
    code: 'SALFA',
    contact: 'Département de Santé - Facturation Tiers-Payant',
    telephone: '+261 38 34 092 61 / 034 50 670 90',
    email: 'facturation.toliara@salfa.mg',
    adresse: 'BP 99, Tanambao, Toliara, Madagascar',
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

export const initialPersonnes: Personne[] = [
  {
    id: 'per-950210-1',
    matricule: '950210',
    nomPrenom: 'RAKOTOLAVA TIAVINA YOHAN',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    statut: 'Actif',
    tauxCouverture: 100,
  },
  {
    id: 'per-215781',
    matricule: '215781',
    nomPrenom: 'ZOMA NORMAND JOEL ARYEL',
    societeId: 'soc-bsa',
    sousSociete: 'ACCES BANQUES',
    statut: 'Actif',
    tauxCouverture: 80,
  },
  {
    id: 'per-225549',
    matricule: '225549',
    nomPrenom: 'RALAIVAO EMYMORANE EMILIAS',
    societeId: 'soc-bsa',
    sousSociete: 'BAOBAB BANQUE',
    statut: 'Actif',
    tauxCouverture: 90,
  },
  {
    id: 'per-950185',
    matricule: '950185',
    nomPrenom: 'RATSIMBA JEAN LEONARD',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    statut: 'Actif',
    tauxCouverture: 100,
  },
  {
    id: 'per-244602',
    matricule: '244602',
    nomPrenom: 'RAVELOMANJA AIME JACQUIS',
    societeId: 'soc-bsa',
    sousSociete: 'SIPEM',
    statut: 'Actif',
    tauxCouverture: 80,
  },
  {
    id: 'per-492',
    matricule: '492',
    nomPrenom: 'RAVOAHANGIARIVONY ANDRIANJATOVO FANJALALAO',
    societeId: 'soc-bsa',
    sousSociete: 'CAISSE DEPARGNE',
    statut: 'Actif',
    tauxCouverture: 100,
  },
  {
    id: 'per-214158',
    matricule: '214158',
    nomPrenom: 'RAZAFINDRAFARA HERILANTOSOA EVAH',
    societeId: 'soc-bsa',
    sousSociete: 'SIPEM BANQUE',
    statut: 'Actif',
    tauxCouverture: 100,
  },
  {
    id: 'per-205890',
    matricule: '205890',
    nomPrenom: 'RAZAKANDRAIBE HERY ZO',
    societeId: 'soc-bsa',
    sousSociete: 'ORANGE MADAGASCAR',
    statut: 'Actif',
    tauxCouverture: 80,
  },
  {
    id: 'per-232272',
    matricule: '232272',
    nomPrenom: 'TOHASOA EDWIN ARMELO',
    societeId: 'soc-bsa',
    sousSociete: 'BSA',
    statut: 'Actif',
    tauxCouverture: 100,
  },
  {
    id: 'per-239911',
    matricule: '239911',
    nomPrenom: 'RAKOTOARINOSY FEHIZOROVOAFANTINA',
    societeId: 'soc-bsa',
    sousSociete: 'WILDLIFE CONSERVATION',
    statut: 'Actif',
    tauxCouverture: 80,
  },
  {
    id: 'per-240084',
    matricule: '240084',
    nomPrenom: 'RAKOTONIRINA OLAFSON THECLE',
    societeId: 'soc-bsa',
    sousSociete: 'ADRA MADAGASCAR',
    statut: 'Actif',
    tauxCouverture: 80,
  },
  {
    id: 'per-950148',
    matricule: '950148',
    nomPrenom: 'ANDRIANAMBININA JEAN CLAUDE',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    statut: 'Actif',
    tauxCouverture: 100,
  },
  {
    id: 'per-207092',
    matricule: '207092',
    nomPrenom: 'MAHARANTE ELYSA',
    societeId: 'soc-bsa',
    sousSociete: 'ORANGE',
    statut: 'Actif',
    tauxCouverture: 80,
  },
  {
    id: 'per-110049',
    matricule: '110049',
    nomPrenom: 'RAKOTOVAO IRIELA LAURIANNE',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    statut: 'Actif',
    tauxCouverture: 100,
  },
  {
    id: 'per-950142',
    matricule: '950142',
    nomPrenom: 'RAZAFINIHATRAINA ROGER',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    statut: 'Actif',
    tauxCouverture: 100,
  },
  {
    id: 'per-214115',
    matricule: '214115',
    nomPrenom: 'ISMAEL ANGELO SOUMAILI',
    societeId: 'soc-bsa',
    sousSociete: 'SIPEM',
    statut: 'Actif',
    tauxCouverture: 80,
  },
  {
    id: 'per-950195',
    matricule: '950195',
    nomPrenom: 'RASAMOELINA AMBOARA FITAHIANA',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    statut: 'Actif',
    tauxCouverture: 100,
  },
  {
    id: 'per-198356',
    matricule: '198356',
    nomPrenom: 'RAMANANANDRO DIAMANGAVONY CLAUDIO',
    societeId: 'soc-bsa',
    sousSociete: 'ACCES BANQUES',
    statut: 'Actif',
    tauxCouverture: 80,
  },
  {
    id: 'per-950210-2',
    matricule: '950210',
    nomPrenom: 'ALIJAONA HARILALAINA TAHINA',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    statut: 'Actif',
    tauxCouverture: 100,
  },
  {
    id: 'per-225597',
    matricule: '225597',
    nomPrenom: 'RASAMIMANANA RASOARILYS ESPERENCE',
    societeId: 'soc-bsa',
    sousSociete: 'BAOBAB BANQUE',
    statut: 'Actif',
    tauxCouverture: 90,
  },
  {
    id: 'per-214428',
    matricule: '214428',
    nomPrenom: 'LIAVOTSENJANY EDEN',
    societeId: 'soc-bsa',
    sousSociete: 'SIPEM',
    statut: 'Actif',
    tauxCouverture: 80,
  }
];

export const initialPrestations: Prestation[] = [
  {
    id: 'prest-bsa-01',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-02',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    personneId: 'per-950210-1',
    montantTotal: 62000,
    montantPaye: 0,
    solde: 62000,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 1 Décompte BSA Mai 2026',
    lignes: [
      { id: 'lig-01-1', prestationId: 'prest-bsa-01', code: 'DENT', libelle: 'Soins dentaires', totalPrestation: 50000, totalPaye: 0, solde: 50000, statut: 'En attente' },
      { id: 'lig-01-2', prestationId: 'prest-bsa-01', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 12000, totalPaye: 0, solde: 12000, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-02',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-02',
    societeId: 'soc-bsa',
    sousSociete: 'ACCES BANQUES',
    personneId: 'per-215781',
    montantTotal: 35200,
    montantPaye: 0,
    solde: 35200,
    statut: 'En attente',
    commentaires: 'Ticket modérateur 20% (Part: 8 800 Ar, Brut: 44 000 Ar) - Ligne 2',
    lignes: [
      { id: 'lig-02-1', prestationId: 'prest-bsa-02', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 16000, totalPaye: 0, solde: 16000, statut: 'En attente' },
      { id: 'lig-02-2', prestationId: 'prest-bsa-02', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 19200, totalPaye: 0, solde: 19200, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-03',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-04',
    societeId: 'soc-bsa',
    sousSociete: 'BAOBAB BANQUE',
    personneId: 'per-225549',
    montantTotal: 26100,
    montantPaye: 0,
    solde: 26100,
    statut: 'En attente',
    commentaires: 'Quote-part 10% (Part: 2 900 Ar, Brut: 29 000 Ar) - Ligne 3',
    lignes: [
      { id: 'lig-03-1', prestationId: 'prest-bsa-03', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 8100, totalPaye: 0, solde: 8100, statut: 'En attente' },
      { id: 'lig-03-2', prestationId: 'prest-bsa-03', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 18000, totalPaye: 0, solde: 18000, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-04',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-04',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    personneId: 'per-950185',
    montantTotal: 49200,
    montantPaye: 0,
    solde: 49200,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 4',
    lignes: [
      { id: 'lig-04-1', prestationId: 'prest-bsa-04', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 20000, totalPaye: 0, solde: 20000, statut: 'En attente' },
      { id: 'lig-04-2', prestationId: 'prest-bsa-04', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 26200, totalPaye: 0, solde: 26200, statut: 'En attente' },
      { id: 'lig-04-3', prestationId: 'prest-bsa-04', code: 'LABO', libelle: 'Analyses médicales', totalPrestation: 3000, totalPaye: 0, solde: 3000, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-05',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-04',
    societeId: 'soc-bsa',
    sousSociete: 'SIPEM',
    personneId: 'per-244602',
    montantTotal: 42400,
    montantPaye: 0,
    solde: 42400,
    statut: 'En attente',
    commentaires: 'Ticket modérateur 20% (Part: 10 600 Ar, Brut: 53 000 Ar) - Ligne 5',
    lignes: [
      { id: 'lig-05-1', prestationId: 'prest-bsa-05', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 32800, totalPaye: 0, solde: 32800, statut: 'En attente' },
      { id: 'lig-05-2', prestationId: 'prest-bsa-05', code: 'SOINS', libelle: 'Soins infirmiers', totalPrestation: 9600, totalPaye: 0, solde: 9600, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-06',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-06',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    personneId: 'per-950185',
    montantTotal: 68000,
    montantPaye: 0,
    solde: 68000,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 6',
    lignes: [
      { id: 'lig-06-1', prestationId: 'prest-bsa-06', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 15000, totalPaye: 0, solde: 15000, statut: 'En attente' },
      { id: 'lig-06-2', prestationId: 'prest-bsa-06', code: 'LABO', libelle: 'Analyses médicales', totalPrestation: 53000, totalPaye: 0, solde: 53000, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-07',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-06',
    societeId: 'soc-bsa',
    sousSociete: 'CAISSE DEPARGNE',
    personneId: 'per-492',
    montantTotal: 20000,
    montantPaye: 0,
    solde: 20000,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 7',
    lignes: [
      { id: 'lig-07-1', prestationId: 'prest-bsa-07', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 20000, totalPaye: 0, solde: 20000, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-08',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-06',
    societeId: 'soc-bsa',
    sousSociete: 'SIPEM BANQUE',
    personneId: 'per-214158',
    montantTotal: 363300,
    montantPaye: 0,
    solde: 363300,
    statut: 'En attente',
    commentaires: 'Hospitalisation et soins complets 100% - Ligne 8',
    lignes: [
      { id: 'lig-08-1', prestationId: 'prest-bsa-08', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 221300, totalPaye: 0, solde: 221300, statut: 'En attente' },
      { id: 'lig-08-2', prestationId: 'prest-bsa-08', code: 'LABO', libelle: 'Analyses de laboratoire', totalPrestation: 44000, totalPaye: 0, solde: 44000, statut: 'En attente' },
      { id: 'lig-08-3', prestationId: 'prest-bsa-08', code: 'HOSP', libelle: 'Hospitalisation & Séjour', totalPrestation: 60000, totalPaye: 0, solde: 60000, statut: 'En attente' },
      { id: 'lig-08-4', prestationId: 'prest-bsa-08', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 20000, totalPaye: 0, solde: 20000, statut: 'En attente' },
      { id: 'lig-08-5', prestationId: 'prest-bsa-08', code: 'SOINS', libelle: 'Soins infirmiers', totalPrestation: 18000, totalPaye: 0, solde: 18000, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-09',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-07',
    societeId: 'soc-bsa',
    sousSociete: 'ORANGE MADAGASCAR',
    personneId: 'per-205890',
    montantTotal: 64000,
    montantPaye: 0,
    solde: 64000,
    statut: 'En attente',
    commentaires: 'Ticket modérateur 20% (Part: 16 000 Ar, Brut: 80 000 Ar) - Ligne 9',
    lignes: [
      { id: 'lig-09-1', prestationId: 'prest-bsa-09', code: 'DENT', libelle: 'Soins dentaires', totalPrestation: 64000, totalPaye: 0, solde: 64000, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-10',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-07',
    societeId: 'soc-bsa',
    sousSociete: 'BSA',
    personneId: 'per-232272',
    montantTotal: 40100,
    montantPaye: 0,
    solde: 40100,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 10',
    lignes: [
      { id: 'lig-10-1', prestationId: 'prest-bsa-10', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 17100, totalPaye: 0, solde: 17100, statut: 'En attente' },
      { id: 'lig-10-2', prestationId: 'prest-bsa-10', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 20000, totalPaye: 0, solde: 20000, statut: 'En attente' },
      { id: 'lig-10-3', prestationId: 'prest-bsa-10', code: 'SOINS', libelle: 'Soins infirmiers', totalPrestation: 3000, totalPaye: 0, solde: 3000, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-11',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-09',
    societeId: 'soc-bsa',
    sousSociete: 'WILDLIFE CONSERVATION',
    personneId: 'per-239911',
    montantTotal: 38240,
    montantPaye: 0,
    solde: 38240,
    statut: 'En attente',
    commentaires: 'Ticket modérateur 20% (Part: 9 560 Ar, Brut: 47 800 Ar) - Ligne 11',
    lignes: [
      { id: 'lig-11-1', prestationId: 'prest-bsa-11', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 22240, totalPaye: 0, solde: 22240, statut: 'En attente' },
      { id: 'lig-11-2', prestationId: 'prest-bsa-11', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 16000, totalPaye: 0, solde: 16000, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-12',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-11',
    societeId: 'soc-bsa',
    sousSociete: 'ADRA MADAGASCAR',
    personneId: 'per-240084',
    montantTotal: 50560,
    montantPaye: 0,
    solde: 50560,
    statut: 'En attente',
    commentaires: 'Ticket modérateur 20% (Part: 12 640 Ar, Brut: 63 200 Ar) - Ligne 12',
    lignes: [
      { id: 'lig-12-1', prestationId: 'prest-bsa-12', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 16000, totalPaye: 0, solde: 16000, statut: 'En attente' },
      { id: 'lig-12-2', prestationId: 'prest-bsa-12', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 34560, totalPaye: 0, solde: 34560, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-13',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-12',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    personneId: 'per-950148',
    montantTotal: 117200,
    montantPaye: 0,
    solde: 117200,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 13',
    lignes: [
      { id: 'lig-13-1', prestationId: 'prest-bsa-13', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 15000, totalPaye: 0, solde: 15000, statut: 'En attente' },
      { id: 'lig-13-2', prestationId: 'prest-bsa-13', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 102200, totalPaye: 0, solde: 102200, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-14',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-12',
    societeId: 'soc-bsa',
    sousSociete: 'ORANGE',
    personneId: 'per-207092',
    montantTotal: 174240,
    montantPaye: 0,
    solde: 174240,
    statut: 'En attente',
    commentaires: 'Ticket modérateur 20% (Part: 43 560 Ar, Brut: 217 800 Ar) - Ligne 14',
    lignes: [
      { id: 'lig-14-1', prestationId: 'prest-bsa-14', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 16000, totalPaye: 0, solde: 16000, statut: 'En attente' },
      { id: 'lig-14-2', prestationId: 'prest-bsa-14', code: 'LABO', libelle: 'Analyses médicales', totalPrestation: 85600, totalPaye: 0, solde: 85600, statut: 'En attente' },
      { id: 'lig-14-3', prestationId: 'prest-bsa-14', code: 'MEDIC', libelle: 'Stock / Fournitures & Médicaments', totalPrestation: 72640, totalPaye: 0, solde: 72640, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-15',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-16',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    personneId: 'per-950148',
    montantTotal: 94000,
    montantPaye: 0,
    solde: 94000,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 15',
    lignes: [
      { id: 'lig-15-1', prestationId: 'prest-bsa-15', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 15000, totalPaye: 0, solde: 15000, statut: 'En attente' },
      { id: 'lig-15-2', prestationId: 'prest-bsa-15', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 79000, totalPaye: 0, solde: 79000, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-16',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-17',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    personneId: 'per-110049',
    montantTotal: 38400,
    montantPaye: 0,
    solde: 38400,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 16',
    lignes: [
      { id: 'lig-16-1', prestationId: 'prest-bsa-16', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 15000, totalPaye: 0, solde: 15000, statut: 'En attente' },
      { id: 'lig-16-2', prestationId: 'prest-bsa-16', code: 'LABO', libelle: 'Analyses de laboratoire', totalPrestation: 3000, totalPaye: 0, solde: 3000, statut: 'En attente' },
      { id: 'lig-16-3', prestationId: 'prest-bsa-16', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 20400, totalPaye: 0, solde: 20400, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-17',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-18',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    personneId: 'per-950142',
    montantTotal: 70700,
    montantPaye: 0,
    solde: 70700,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 17',
    lignes: [
      { id: 'lig-17-1', prestationId: 'prest-bsa-17', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 15000, totalPaye: 0, solde: 15000, statut: 'En attente' },
      { id: 'lig-17-2', prestationId: 'prest-bsa-17', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 55700, totalPaye: 0, solde: 55700, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-18',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-20',
    societeId: 'soc-bsa',
    sousSociete: 'SIPEM',
    personneId: 'per-214115',
    montantTotal: 74880,
    montantPaye: 0,
    solde: 74880,
    statut: 'En attente',
    commentaires: 'Ticket modérateur 20% (Part: 18 720 Ar, Brut: 93 600 Ar) - Ligne 18',
    lignes: [
      { id: 'lig-18-1', prestationId: 'prest-bsa-18', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 16000, totalPaye: 0, solde: 16000, statut: 'En attente' },
      { id: 'lig-18-2', prestationId: 'prest-bsa-18', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 58880, totalPaye: 0, solde: 58880, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-19',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-23',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    personneId: 'per-950195',
    montantTotal: 68000,
    montantPaye: 0,
    solde: 68000,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 19',
    lignes: [
      { id: 'lig-19-1', prestationId: 'prest-bsa-19', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 20000, totalPaye: 0, solde: 20000, statut: 'En attente' },
      { id: 'lig-19-2', prestationId: 'prest-bsa-19', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 45000, totalPaye: 0, solde: 45000, statut: 'En attente' },
      { id: 'lig-19-3', prestationId: 'prest-bsa-19', code: 'SOINS', libelle: 'Soins infirmiers', totalPrestation: 3000, totalPaye: 0, solde: 3000, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-20',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-24',
    societeId: 'soc-bsa',
    sousSociete: 'ACCES BANQUES',
    personneId: 'per-198356',
    montantTotal: 102160,
    montantPaye: 0,
    solde: 102160,
    statut: 'En attente',
    commentaires: 'Ticket modérateur 20% (Part: 25 540 Ar, Brut: 127 700 Ar) - Ligne 20',
    lignes: [
      { id: 'lig-20-1', prestationId: 'prest-bsa-20', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 16000, totalPaye: 0, solde: 16000, statut: 'En attente' },
      { id: 'lig-20-2', prestationId: 'prest-bsa-20', code: 'LABO', libelle: 'Analyses de laboratoire', totalPrestation: 59200, totalPaye: 0, solde: 59200, statut: 'En attente' },
      { id: 'lig-20-3', prestationId: 'prest-bsa-20', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 19760, totalPaye: 0, solde: 19760, statut: 'En attente' },
      { id: 'lig-20-4', prestationId: 'prest-bsa-20', code: 'SOINS', libelle: 'Soins infirmiers', totalPrestation: 7200, totalPaye: 0, solde: 7200, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-21',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-26',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    personneId: 'per-950210-2',
    montantTotal: 141200,
    montantPaye: 0,
    solde: 141200,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 21',
    lignes: [
      { id: 'lig-21-1', prestationId: 'prest-bsa-21', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 15000, totalPaye: 0, solde: 15000, statut: 'En attente' },
      { id: 'lig-21-2', prestationId: 'prest-bsa-21', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 126200, totalPaye: 0, solde: 126200, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-22',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-26',
    societeId: 'soc-bsa',
    sousSociete: 'ACCES BANQUES',
    personneId: 'per-198356',
    montantTotal: 68480,
    montantPaye: 0,
    solde: 68480,
    statut: 'En attente',
    commentaires: 'Ticket modérateur 20% (Part: 17 120 Ar, Brut: 85 600 Ar) - Ligne 22',
    lignes: [
      { id: 'lig-22-1', prestationId: 'prest-bsa-22', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 68480, totalPaye: 0, solde: 68480, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-23',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-26',
    societeId: 'soc-bsa',
    sousSociete: 'BAOBAB BANQUE',
    personneId: 'per-225597',
    montantTotal: 86580,
    montantPaye: 0,
    solde: 86580,
    statut: 'En attente',
    commentaires: 'Ticket modérateur 10% (Part: 9 620 Ar, Brut: 96 200 Ar) - Ligne 23',
    lignes: [
      { id: 'lig-23-1', prestationId: 'prest-bsa-23', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 18000, totalPaye: 0, solde: 18000, statut: 'En attente' },
      { id: 'lig-23-2', prestationId: 'prest-bsa-23', code: 'ECHO', libelle: 'Échographie', totalPrestation: 27000, totalPaye: 0, solde: 27000, statut: 'En attente' },
      { id: 'lig-23-3', prestationId: 'prest-bsa-23', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 41580, totalPaye: 0, solde: 41580, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-24',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-26',
    societeId: 'soc-bsa',
    sousSociete: 'BFV',
    personneId: 'per-950142',
    montantTotal: 55700,
    montantPaye: 0,
    solde: 55700,
    statut: 'En attente',
    commentaires: 'Prise en charge 100% - Ligne 24',
    lignes: [
      { id: 'lig-24-1', prestationId: 'prest-bsa-24', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 55700, totalPaye: 0, solde: 55700, statut: 'En attente' }
    ]
  },
  {
    id: 'prest-bsa-25',
    numeroFacture: 'FA-05/BSA/26-029',
    date: '2026-05-29',
    societeId: 'soc-bsa',
    sousSociete: 'SIPEM',
    personneId: 'per-214428',
    montantTotal: 72800,
    montantPaye: 0,
    solde: 72800,
    statut: 'En attente',
    commentaires: 'Ticket modérateur 20% (Part: 18 200 Ar, Brut: 91 000 Ar) - Ligne 25',
    lignes: [
      { id: 'lig-25-1', prestationId: 'prest-bsa-25', code: 'CONS', libelle: 'Consultation médicale', totalPrestation: 16000, totalPaye: 0, solde: 16000, statut: 'En attente' },
      { id: 'lig-25-2', prestationId: 'prest-bsa-25', code: 'MEDIC', libelle: 'Pharmacie & Médicaments', totalPrestation: 56800, totalPaye: 0, solde: 56800, statut: 'En attente' }
    ]
  }
];

export const initialPaiements: Paiement[] = [];
