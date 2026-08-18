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
  plafondAnnuel: number;
  tauxStandard: number;
  description?: string;
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

export type ActiveTab = 
  | 'dashboard'
  | 'prestations'
  | 'paiements'
  | 'importation'
  | 'historique'
  | 'societes'
  | 'personnes'
  | 'familles'
  | 'etats';
