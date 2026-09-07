/**
 * Service de synchronisation API Backend WAMP (PHP / MySQL)
 * Assure une communication 100% directe et atomique avec la base de données MySQL
 */

export interface DbConnectionResult {
  connected: boolean;
  database?: string;
  message?: string;
  error?: string;
  stats?: {
    societes: number;
    personnes?: number;
    prestations: number;
    paiements: number;
  };
  server_time?: string;
}

export async function checkWampDbConnection(): Promise<DbConnectionResult> {
  try {
    const res = await fetch('api.php?action=check_db', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // Body is not JSON (e.g. Apache error page or PHP fatal error)
    }

    if (!res.ok || !json || json.success === false) {
      const errMsg = json?.error || (res.status !== 200 
        ? `Erreur HTTP ${res.status}: Le serveur WAMP n'a pas pu exécuter la requête MySQL.` 
        : 'La connexion à la base de données MySQL a échoué.');
      return { connected: false, error: errMsg };
    }

    return { 
      connected: true, 
      database: json.data?.database || 'suivi_assurance_salfa',
      message: json.data?.message,
      stats: json.data?.stats,
      server_time: json.data?.server_time
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || 'Serveur WAMP (Apache/PHP) injoignable ou service MySQL déconnecté.'
    };
  }
}

export async function fetchWampData<T = any>(action: string): Promise<T[] | null> {
  try {
    const res = await fetch(`api.php?action=${action}&_t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error || `Erreur HTTP ${res.status}`);
    }
    const json = await res.json();
    if (json && json.success && Array.isArray(json.data)) {
      return json.data;
    }
    return [];
  } catch (err: any) {
    console.error(`[fetchWampData] Erreur sur ${action}:`, err?.message || err);
    throw err;
  }
}

export async function saveWampData<T = any>(action: string, data: T): Promise<any> {
  try {
    const res = await fetch(`api.php?action=${action}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error || `Erreur enregistrement MySQL (${res.status})`);
    }
    return await res.json();
  } catch (err: any) {
    console.error(`[saveWampData] Erreur sur ${action}:`, err?.message || err);
    throw err;
  }
}

/**
 * Enregistrement en lot (Bulk Import) sécurisé avec découpage en lots (chunks) et tolérance aux pannes/deadlocks
 */
export async function saveWampDataBulk<T = any>(action: string, items: T[], chunkSize: number = 50): Promise<any> {
  if (!items || items.length === 0) return { success: true, count: 0 };
  
  // Découpage en sous-lots pour éviter les verrous de table massifs et les deadlocks InnoDB
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  let totalSaved = 0;

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    let retries = 3;
    let success = false;
    let lastError: any = null;

    while (retries > 0 && !success) {
      try {
        const res = await fetch(`api.php?action=${action}&bulk=1`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify(chunk)
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || `Erreur enregistrement en lot MySQL (${res.status})`);
        }

        const resData = await res.json();
        totalSaved += (resData?.data?.count || chunk.length);
        success = true;
      } catch (err: any) {
        lastError = err;
        retries--;
        const msg = String(err?.message || '');
        const isDeadlock = msg.includes('1213') || msg.includes('40001') || msg.toLowerCase().includes('deadlock') || msg.toLowerCase().includes('lock');
        
        if (isDeadlock && retries > 0) {
          // Attente progressive (100ms, 250ms) avant nouvelle tentative
          await new Promise(r => setTimeout(r, (4 - retries) * 120));
          continue;
        }

        if (retries === 0) {
          console.error(`[saveWampDataBulk] Erreur critique sur le lot ${c + 1}/${chunks.length} pour ${action}:`, err?.message || err);
          throw lastError;
        }
      }
    }
  }

  return { success: true, count: totalSaved };
}

export async function deleteWampData(action: string, id: string): Promise<any> {
  try {
    const res = await fetch(`api.php?action=${action}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error || `Erreur suppression MySQL (${res.status})`);
    }
    return await res.json();
  } catch (err: any) {
    console.error(`[deleteWampData] Erreur sur ${action} (ID: ${id}):`, err?.message || err);
    throw err;
  }
}
