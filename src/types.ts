export interface Societe {
  id: string;
  nom: string;
  code: string;
  contact?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  tauxCouvertureDefaut: number; // e.g. 80%
}

export interface Personne {
  id: string;
  nomPrenom: string;
  matricule: string;
  societeId: string;
  qualite: 'Adhérent Principal' | 'Conjoint' | 'Enfant' | 'Ayant droit';
  familleCode?: string;
  dateNaissance?: string;
  telephone?: string;
  email?: string;
}

export interface Famille {
  id: string;
  code: string;
  libelle: string;
  plafondAnnuel?: number;
  tauxStandard?: number;
  description?: string;
  aliases: string[]; // Codes alternatifs, synonymes et descriptions reconnus (ex: ['PH', 'PHSB', 'PHARMACIE', 'MEDIC'])
}

export interface LignePrestation {
  id: string;
  prestationId: string;
  code: string; // Famille code, e.g. CONS, PHAR
  libelle?: string;
  totalPrestation: number;
  totalPaye: number;
}

export interface Prestation {
  id: string;
  numeroFacture: string;
  date: string;
  societeId: string;
  sousSociete: string;
  personneId: string;
  totalPrestation: number;
  participation: number; // Ticket modérateur assuré
  statut: 'En attente' | 'Partiellement payé' | 'Payé' | 'Rejeté';
  lignes: LignePrestation[];
  dateCreation: string;
  commentaires?: string;
}

export interface LignePaiement {
  id: string;
  paiementId: string;
  lignePrestationId: string;
  prestationId: string;
  immatriculation: string;
  nomBaseAssurance: string;
  totalPaye: number;
  ticketModerateur: number;
  montantExclu: number;
  commentaire?: string;
}

export interface Paiement {
  id: string;
  numeroBordereau: string;
  datePaiement: string;
  dateSaisie: string;
  societeId: string;
  modePaiement: 'Virement bancaire' | 'Chèque' | 'Espèces' | 'Mobile Money';
  referencePaiement: string;
  totalReclame: number;
  totalPaye: number;
  totalModerateur: number;
  totalExclu: number;
  remise: number;
  statut: 'Brouillon' | 'Validé' | 'Comptabilisé';
  lignes: LignePaiement[];
  notes?: string;
}

export interface ActeMedicalDetail {
  code: string;
  libelle: string;
  montant: number;
  mappedFamilleCode?: string; // Famille dans la base reliée (ex: PHAR, CONS, LABO, etc.)
  isUnknown?: boolean;
}

export interface FactureLigneParsed {
  numeroLigne: number;
  dateSoins: string;
  matricule: string;
  nomPrenom: string;
  societeAffiliee?: string; // Société principale ou garant (ex: BSA, MCI, ASCOMA, AXIAN, BRED)
  sousSociete?: string; // Sous-société extraite des parenthèses (ex: BFV EMPLOYES, BFV RETRAITES, TELMA, etc.)
  ayantDroit?: string; // Ayant droit si différent de l'adhérent
  prestataireNom?: string; // Nom du médecin/service
  numeroFactureOrigine?: string; // Réf facture d'origine dans les décomptes MCI
  actes: ActeMedicalDetail[];
  actesTexte: string;
  montantBrut: number;
  montantExclu?: number; // Montant exclu ou rejeté
  baseReglement?: number; // Base décomptée
  participation: number; // Quote-part / Ticket modérateur
  netAPayer: number; // Prise en charge / Montant réglé
  observations?: string;
  hasUnmappedActs?: boolean; // Indique si un acte nécessite un choix de liaison
  matchedPersonneId?: string;
  matchedSocieteId?: string;
  matchedPrestationId?: string;
  isNewPersonne?: boolean;
  isNewSociete?: boolean;
}

export interface ParsedFactureAssurance {
  documentType?: 'facture' | 'decompte';
  etablissement: string;
  numeroFacture: string;
  numeroBordereau?: string;
  moisPriseEnCharge: string;
  clientDoit: string; // Organisme / Société (ex: MCI CARE, ASCOMA, BSA)
  garant?: string; // ex: GROUPE AXIAN, BSA / ASK GS
  dateEmission: string;
  dateComptable?: string;
  codeCentre?: string;
  periodeReglement?: string;
  banqueReglement?: string;
  rib?: string;
  totalMontantBrut: number;
  totalExclu?: number;
  totalBaseReglement?: number;
  totalParticipation: number;
  totalNetAPayer: number;
  remise?: number;
  sommeLettres?: string;
  lignes: FactureLigneParsed[];
}

export type ActiveTab = 
  | 'dashboard'
  | 'prestations'
  | 'paiements'
  | 'historique'
  | 'societes'
  | 'personnes'
  | 'familles'
  | 'etats';

