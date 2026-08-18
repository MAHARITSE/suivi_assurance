import { ParsedFactureAssurance } from '../types';

export const salfaSampleInvoice: ParsedFactureAssurance = {
  etablissement: "FIANGONANA LOTERANA MALAGASY - SALFA - HOPITALY LOTERANA TOLIARY TANAMBAO",
  numeroFacture: "FA-05/BSA/26-029",
  moisPriseEnCharge: "Mai 2026",
  clientDoit: "BSA",
  dateEmission: "2026-06-11",
  rib: "00005-00041-43200100200-85",
  totalMontantBrut: 2216700,
  totalParticipation: 193260,
  totalNetAPayer: 2023440,
  sommeLettres: "Deux millions vingt-trois mille quatre cent quarante Ariary",
  lignes: [
    {
      numeroLigne: 1,
      dateSoins: "2026-05-02",
      matricule: "950210",
      nomPrenom: "RAKOTOLAVA TIAVINA YOHAN",
      societeAffiliee: "BSA",
      sousSociete: "BFV",
      actes: [
        { code: "DENT", libelle: "Soins dentaires", montant: 50000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 12000 }
      ],
      actesTexte: "DENT : 50 000,00 / MEDIC : 12 000,00",
      montantBrut: 62000,
      participation: 0,
      netAPayer: 62000,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 2,
      dateSoins: "2026-05-02",
      matricule: "215781",
      nomPrenom: "ZOMA NORMAND JOEL ARYEL",
      societeAffiliee: "BSA",
      sousSociete: "ACCES BANQUES",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 24000 }
      ],
      actesTexte: "CONS : 20 000,00 / MEDIC : 24 000,00",
      montantBrut: 44000,
      participation: 8800,
      netAPayer: 35200,
      observations: "Ticket modérateur 20%"
    },
    {
      numeroLigne: 3,
      dateSoins: "2026-05-04",
      matricule: "225549",
      nomPrenom: "RALAIVAO EMYMORANE EMILIAS",
      societeAffiliee: "BSA",
      sousSociete: "BAOBAB BANQUE",
      actes: [
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 9000 },
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 }
      ],
      actesTexte: "MEDIC : 9 000,00 / CONS : 20 000,00",
      montantBrut: 29000,
      participation: 2900,
      netAPayer: 26100,
      observations: "Quote-part 10%"
    },
    {
      numeroLigne: 4,
      dateSoins: "2026-05-04",
      matricule: "950185",
      nomPrenom: "RATSIMBA JEAN LEONARD",
      societeAffiliee: "BSA",
      sousSociete: "BFV",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 26200 },
        { code: "LABO", libelle: "Analyses médicales", montant: 3000 }
      ],
      actesTexte: "CONS : 20 000,00 / MEDIC : 26 200,00 / LABO : 3 000,00",
      montantBrut: 49200,
      participation: 0,
      netAPayer: 49200,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 5,
      dateSoins: "2026-05-04",
      matricule: "244602",
      nomPrenom: "RAVELOMANJA AIME JACQUIS",
      societeAffiliee: "BSA",
      sousSociete: "SIPEM",
      actes: [
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 41000 },
        { code: "SOINS", libelle: "Soins infirmiers", montant: 12000 }
      ],
      actesTexte: "MEDIC : 41 000,00 / SOINS : 12 000,00",
      montantBrut: 53000,
      participation: 10600,
      netAPayer: 42400,
      observations: "Ticket modérateur 20%"
    },
    {
      numeroLigne: 6,
      dateSoins: "2026-05-06",
      matricule: "950185",
      nomPrenom: "RATSIMBA JEAN LEONARD",
      societeAffiliee: "BSA",
      sousSociete: "BFV",
      actes: [
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 15000 },
        { code: "LABO", libelle: "Analyses médicales", montant: 53000 }
      ],
      actesTexte: "MEDIC : 15 000,00 / LABO : 53 000,00",
      montantBrut: 68000,
      participation: 0,
      netAPayer: 68000,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 7,
      dateSoins: "2026-05-06",
      matricule: "492",
      nomPrenom: "RAVOAHANGIARIVONY ANDRIANJATOVO FANJALALAO",
      societeAffiliee: "BSA",
      sousSociete: "CAISSE DEPARGNE",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 }
      ],
      actesTexte: "CONS : 20 000,00",
      montantBrut: 20000,
      participation: 0,
      netAPayer: 20000,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 8,
      dateSoins: "2026-05-06",
      matricule: "214158",
      nomPrenom: "RAZAFINDRAFARA HERILANTOSOA EVAH",
      societeAffiliee: "BSA",
      sousSociete: "SIPEM BANQUE",
      actes: [
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 221300 },
        { code: "LABO", libelle: "Analyses de laboratoire", montant: 44000 },
        { code: "HOSP", libelle: "Hospitalisation & Séjour", montant: 60000 },
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
        { code: "SOINS", libelle: "Soins infirmiers", montant: 18000 }
      ],
      actesTexte: "MEDIC : 221 300,00 / LABO : 44 000,00 / HOSP : 60 000,00 / CONS : 20 000,00 / SOINS : 18 000,00",
      montantBrut: 363300,
      participation: 0,
      netAPayer: 363300,
      observations: "Prise en charge hospitalière 100%"
    },
    {
      numeroLigne: 9,
      dateSoins: "2026-05-07",
      matricule: "",
      nomPrenom: "RAZAKANDRAIBE HERY ZO",
      societeAffiliee: "BSA",
      sousSociete: "ORANGE MADAGASCAR",
      actes: [
        { code: "DENT", libelle: "Soins dentaires", montant: 80000 }
      ],
      actesTexte: "DENT : 80 000,00",
      montantBrut: 80000,
      participation: 16000,
      netAPayer: 64000,
      observations: "Ticket modérateur 20%"
    },
    {
      numeroLigne: 10,
      dateSoins: "2026-05-07",
      matricule: "232272",
      nomPrenom: "TOHASOA EDWIN ARMELO",
      societeAffiliee: "BSA",
      sousSociete: "BSA",
      actes: [
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 17100 },
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
        { code: "SOINS", libelle: "Soins infirmiers", montant: 3000 }
      ],
      actesTexte: "MEDIC : 17 100,00 / CONS : 20 000,00 / SOINS : 3 000,00",
      montantBrut: 40100,
      participation: 0,
      netAPayer: 40100,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 11,
      dateSoins: "2026-05-09",
      matricule: "239911",
      nomPrenom: "RAKOTOARINOSY FEHIZOROVOAFANTINA",
      societeAffiliee: "BSA",
      sousSociete: "WILDLIFE CONSERVATION",
      actes: [
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 27800 },
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 }
      ],
      actesTexte: "MEDIC : 27 800,00 / CONS : 20 000,00",
      montantBrut: 47800,
      participation: 9560,
      netAPayer: 38240,
      observations: "Ticket modérateur 20%"
    },
    {
      numeroLigne: 12,
      dateSoins: "2026-05-11",
      matricule: "240084",
      nomPrenom: "RAKOTONIRINA OLAFSON THECLE",
      societeAffiliee: "BSA",
      sousSociete: "ADRA MADAGASCAR",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 43200 }
      ],
      actesTexte: "CONS : 20 000,00 / MEDIC : 43 200,00",
      montantBrut: 63200,
      participation: 12640,
      netAPayer: 50560,
      observations: "Ticket modérateur 20%"
    },
    {
      numeroLigne: 13,
      dateSoins: "2026-05-12",
      matricule: "950148",
      nomPrenom: "ANDRIANAMBININA JEAN CLAUDE",
      societeAffiliee: "BSA",
      sousSociete: "BFV",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 15000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 102200 }
      ],
      actesTexte: "CONS : 15 000,00 / MEDIC : 102 200,00",
      montantBrut: 117200,
      participation: 0,
      netAPayer: 117200,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 14,
      dateSoins: "2026-05-12",
      matricule: "207092",
      nomPrenom: "MAHARANTE ELYSA",
      societeAffiliee: "BSA",
      sousSociete: "ORANGE",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
        { code: "LABO", libelle: "Analyses médicales", montant: 107000 },
        { code: "STOCK", libelle: "Stock / Fournitures médicales", montant: 18000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 72800 }
      ],
      actesTexte: "CONS : 20 000,00 / LABO : 107 000,00 / STOCK : 18 000,00 / MEDIC : 72 800,00",
      montantBrut: 217800,
      participation: 43560,
      netAPayer: 174240,
      observations: "Ticket modérateur 20%"
    },
    {
      numeroLigne: 15,
      dateSoins: "2026-05-16",
      matricule: "950148",
      nomPrenom: "ANDRIANAMBININA JEAN CLAUDE",
      societeAffiliee: "BSA",
      sousSociete: "BFV",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 15000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 79000 }
      ],
      actesTexte: "CONS : 15 000,00 / MEDIC : 79 000,00",
      montantBrut: 94000,
      participation: 0,
      netAPayer: 94000,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 16,
      dateSoins: "2026-05-17",
      matricule: "110049",
      nomPrenom: "RAKOTOVAO IRIELA LAURIANNE",
      societeAffiliee: "BSA",
      sousSociete: "BFV",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 15000 },
        { code: "LABO", libelle: "Analyses de laboratoire", montant: 3000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 20400 }
      ],
      actesTexte: "CONS : 15 000,00 / LABO : 3 000,00 / MEDIC : 20 400,00",
      montantBrut: 38400,
      participation: 0,
      netAPayer: 38400,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 17,
      dateSoins: "2026-05-18",
      matricule: "950142",
      nomPrenom: "RAZAFINIHATRAINA ROGER",
      societeAffiliee: "BSA",
      sousSociete: "BFV",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 15000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 55700 }
      ],
      actesTexte: "CONS : 15 000,00 / MEDIC : 55 700,00",
      montantBrut: 70700,
      participation: 0,
      netAPayer: 70700,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 18,
      dateSoins: "2026-05-20",
      matricule: "214115",
      nomPrenom: "ISMAEL ANGELO SOUMAILI",
      societeAffiliee: "BSA",
      sousSociete: "SIPEM",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 73600 }
      ],
      actesTexte: "CONS : 20 000,00 / MEDIC : 73 600,00",
      montantBrut: 93600,
      participation: 18720,
      netAPayer: 74880,
      observations: "Ticket modérateur 20%"
    },
    {
      numeroLigne: 19,
      dateSoins: "2026-05-23",
      matricule: "950195",
      nomPrenom: "RASAMOELINA AMBOARA FITAHIANA",
      societeAffiliee: "BSA",
      sousSociete: "BFV",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 45000 },
        { code: "SOINS", libelle: "Soins infirmiers", montant: 3000 }
      ],
      actesTexte: "CONS : 20 000,00 / MEDIC : 45 000,00 / SOINS : 3 000,00",
      montantBrut: 68000,
      participation: 0,
      netAPayer: 68000,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 20,
      dateSoins: "2026-05-24",
      matricule: "198356",
      nomPrenom: "RAMANANANDRO DIAMANGAVONY CLAUDIO",
      societeAffiliee: "BSA",
      sousSociete: "ACCES BANQUE",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
        { code: "LABO", libelle: "Analyses de laboratoire", montant: 74000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 24700 },
        { code: "SOINS", libelle: "Soins infirmiers", montant: 9000 }
      ],
      actesTexte: "CONS : 20 000,00 / LABO : 74 000,00 / MEDIC : 24 700,00 / SOINS : 9 000,00",
      montantBrut: 127700,
      participation: 25540,
      netAPayer: 102160,
      observations: "Ticket modérateur 20%"
    },
    {
      numeroLigne: 21,
      dateSoins: "2026-05-26",
      matricule: "950210",
      nomPrenom: "ALIJAONA HARILALAINA TAHINA",
      societeAffiliee: "BSA",
      sousSociete: "BFV",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 15000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 126200 }
      ],
      actesTexte: "CONS : 15 000,00 / MEDIC : 126 200,00",
      montantBrut: 141200,
      participation: 0,
      netAPayer: 141200,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 22,
      dateSoins: "2026-05-26",
      matricule: "198356",
      nomPrenom: "RAMANANANDRO DIAMANGAVONY CLAUDIO",
      societeAffiliee: "BSA",
      sousSociete: "ACCES BANQUES",
      actes: [
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 85600 }
      ],
      actesTexte: "MEDIC : 85 600,00",
      montantBrut: 85600,
      participation: 17120,
      netAPayer: 68480,
      observations: "Ticket modérateur 20%"
    },
    {
      numeroLigne: 23,
      dateSoins: "2026-05-26",
      matricule: "225597",
      nomPrenom: "RASAMIMANANA RASOARILYS ESPERENCE",
      societeAffiliee: "BSA",
      sousSociete: "BAOBAB BANQUE",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
        { code: "ECHO", libelle: "Échographie", montant: 30000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 46200 }
      ],
      actesTexte: "CONS : 20 000,00 / ECHO : 30 000,00 / MEDIC : 46 200,00",
      montantBrut: 96200,
      participation: 9620,
      netAPayer: 86580,
      observations: "Ticket modérateur 10%"
    },
    {
      numeroLigne: 24,
      dateSoins: "2026-05-26",
      matricule: "950142",
      nomPrenom: "RAZAFINIHATRAINA ROGER",
      societeAffiliee: "BSA",
      sousSociete: "BFV",
      actes: [
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 55700 }
      ],
      actesTexte: "MEDIC : 55 700,00",
      montantBrut: 55700,
      participation: 0,
      netAPayer: 55700,
      observations: "Prise en charge 100%"
    },
    {
      numeroLigne: 25,
      dateSoins: "2026-05-29",
      matricule: "214428",
      nomPrenom: "LIAVOTSENJANY EDEN",
      societeAffiliee: "BSA",
      sousSociete: "SIPEM",
      actes: [
        { code: "CONS", libelle: "Consultation médicale", montant: 20000 },
        { code: "MEDIC", libelle: "Pharmacie & Médicaments", montant: 71000 }
      ],
      actesTexte: "CONS : 20 000,00 / MEDIC : 71 000,00",
      montantBrut: 91000,
      participation: 18200,
      netAPayer: 72800,
      observations: "Ticket modérateur 20%"
    }
  ]
};
