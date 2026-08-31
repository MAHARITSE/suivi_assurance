import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DATA_FILE = path.join(process.cwd(), 'database_backup.json');

// Initial default data if no backup exists
const defaultData = {
  societes: [
    { id: 'soc-1', nom: 'SALFA Siège', code: 'SALFA', contact: 'Direction', telephone: '0340000000', email: 'siege@salfa.mg', adresse: 'Antananarivo', tauxCouvertureDefaut: 80 },
    { id: 'soc-2', nom: 'Mutuelle Santé Madagascar', code: 'MSM', contact: 'Service Adhérents', telephone: '0330000000', email: 'contact@msm.mg', adresse: 'Tamatave', tauxCouvertureDefaut: 80 }
  ],
  personnes: [
    { id: 'pers-1', nomPrenom: 'RAKOTO Jean', matricule: 'M001', societeId: 'soc-1', sousSociete: 'Central', qualite: 'Adhérent Principal', familleCode: 'FAM-01', dateNaissance: '1980-01-01', telephone: '0341111111', email: 'jean@rakoto.mg', tauxCouverture: 80, statut: 'Actif' }
  ],
  familles: [
    { id: 'fam-1', code: 'FAM-01', libelle: 'Famille Standard', plafondAnnuel: 1000000, tauxStandard: 80, tarifConventionne: 10000, ticketModerateurDefaut: 20, description: 'Famille couverture standard', aliases: [] }
  ],
  prestations: [],
  paiements: []
};

let dbStore: { societes: any[], personnes: any[], familles: any[], prestations: any[], paiements: any[] } = defaultData;

// Load data from JSON file if exists
try {
  if (fs.existsSync(DATA_FILE)) {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(fileContent);
    dbStore = { ...defaultData, ...parsed };
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
} catch (err) {
  console.error('Error loading database backup:', err);
}

function saveDb() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dbStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database backup:', err);
  }
}

// Helper to handle API responses
function sendApiResponse(res: express.Response, success: boolean, data: any = null, error: any = null, code = 200) {
  res.status(code).json({
    success,
    data,
    error
  });
}

// Unified API Handler function for api.php or /api/...
function handleApiAction(action: string, method: string, query: any, body: any, res: express.Response) {
  if (action === 'check_db' || action === 'health') {
    return sendApiResponse(res, true, {
      connected: true,
      database: 'salfa_assurance_memory',
      message: 'Connexion à la base de données active (Node.js Memory / JSON Backup).',
      stats: {
        societes: dbStore.societes.length,
        personnes: dbStore.personnes.length,
        prestations: dbStore.prestations.length,
        paiements: dbStore.paiements.length
      },
      server_time: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });
  }

  const validActions = ['societes', 'personnes', 'familles', 'prestations', 'paiements'];
  if (!validActions.includes(action)) {
    return sendApiResponse(res, false, null, `Action non valide: ${action}`, 400);
  }

  if (method === 'GET') {
    const items = dbStore[action as keyof typeof dbStore] || [];
    return sendApiResponse(res, true, items);
  }

  if (method === 'POST') {
    let items = [];
    if (body && Array.isArray(body.items)) {
      items = body.items;
    } else if (Array.isArray(body)) {
      items = body;
    } else if (body && typeof body === 'object') {
      items = [body];
    }

    items = items.filter((it: any) => it && it.id);

    if (items.length === 0) {
      return sendApiResponse(res, true, { count: 0, items: [] });
    }

    const collection = dbStore[action as keyof typeof dbStore];
    for (const item of items) {
      const idx = collection.findIndex((x: any) => String(x.id) === String(item.id));
      if (idx >= 0) {
        collection[idx] = { ...collection[idx], ...item, updated_at: new Date().toISOString() };
      } else {
        collection.push({ ...item, created_at: item.created_at || new Date().toISOString(), updated_at: new Date().toISOString() });
      }
    }

    saveDb();
    return sendApiResponse(res, true, { count: items.length, items });
  }

  if (method === 'DELETE') {
    const id = query.id;
    if (!id) {
      return sendApiResponse(res, false, null, 'Paramètre id manquant pour la suppression.', 400);
    }

    const collection = dbStore[action as keyof typeof dbStore];
    const initialLen = collection.length;
    (dbStore as any)[action] = collection.filter((x: any) => String(x.id) !== String(id));

    saveDb();
    return sendApiResponse(res, true, { id, deleted: true });
  }

  return sendApiResponse(res, false, null, 'Méthode HTTP non supportée.', 405);
}

// API endpoint handlers
app.all('/api.php', (req, res) => {
  const action = String(req.query.action || '').trim();
  handleApiAction(action, req.method, req.query, req.body, res);
});

app.all('/api/:action', (req, res) => {
  const action = String(req.params.action || '').trim();
  handleApiAction(action, req.method, req.query, req.body, res);
});

// Serve static frontend files
const rootDir = process.cwd();
app.use(express.static(rootDir));

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(rootDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Application index.html not found');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
