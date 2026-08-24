/**
 * Service de synchronisation API Backend WAMP (PHP / MySQL)
 */

export async function checkWampDbConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const res = await fetch('api.php?action=check_db');
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // Body not JSON
    }

    if (!res.ok || !json || json.success === false) {
      const errMsg = json?.error || (res.status !== 200 ? `Erreur HTTP ${res.status}: Base de données WAMP / MySQL non accessible.` : 'La connexion à la base de données MySQL a échoué.');
      return { connected: false, error: errMsg };
    }

    return { connected: true };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || 'Serveur WAMP (Apache/PHP) injoignable ou service MySQL déconnecté.'
    };
  }
}

export async function fetchWampData(action: string) {
  try {
    const res = await fetch(`api.php?action=${action}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json && json.success ? json.data : null;
  } catch {
    return null;
  }
}

export async function saveWampData(action: string, data: any): Promise<{ success: boolean; message?: string; count?: number; errors?: string[] } | null> {
  try {
    const res = await fetch(`api.php?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      console.error(`[saveWampData] HTTP ${res.status} pour action=${action}`);
      return null;
    }
    const json = await res.json();
    if (json && !json.success) {
      console.error(`[saveWampData] Échec API action=${action}:`, json.error || json.message);
    }
    if (json && json.errors && json.errors.length > 0) {
      console.warn(`[saveWampData] ${json.errors.length} erreur(s) pour action=${action}:`, json.errors);
    }
    return json;
  } catch (err) {
    console.error(`[saveWampData] Exception pour action=${action}:`, err);
    return null;
  }
}

export async function deleteWampData(action: string, id: string) {
  try {
    const res = await fetch(`api.php?action=${action}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

