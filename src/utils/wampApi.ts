/**
 * Service de synchronisation API Backend WAMP (PHP / MySQL)
 */

export async function checkWampDbConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const res = await fetch('api.php?action=check_db', { cache: 'no-store' });
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

export async function fetchWampData(action: string): Promise<any[] | null> {
  try {
    const res = await fetch(`api.php?action=${action}`, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[fetchWampData] HTTP ${res.status} pour action=${action}`);
      return null;
    }
    const json = await res.json();
    return json && json.success && Array.isArray(json.data) ? json.data : null;
  } catch (err) {
    console.error(`[fetchWampData] Exception pour action=${action}:`, err);
    return null;
  }
}

/**
 * Enregistre un objet ou un lot d'objets dans MySQL via l'API PHP.
 * Si le lot est volumineux (> 100 éléments), le découpe automatiquement en sous-lots
 * pour éviter d'excéder les limites post_max_size / memory_limit de PHP.
 */
export async function saveWampData(action: string, data: any): Promise<{ success: boolean; message?: string; count?: number; errors?: string[] } | null> {
  try {
    // Si c'est un tableau de plus de 100 éléments, envoyer par blocs de 100
    if (Array.isArray(data) && data.length > 100) {
      let totalSaved = 0;
      const allErrors: string[] = [];
      const chunkSize = 100;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const res = await fetch(`api.php?action=${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk)
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json && json.success) {
            totalSaved += json.count ?? chunk.length;
            if (json.errors && json.errors.length > 0) {
              allErrors.push(...json.errors);
            }
          }
        }
      }
      return {
        success: totalSaved > 0 || data.length === 0,
        count: totalSaved,
        errors: allErrors,
        message: `${totalSaved}/${data.length} enregistrements sauvegardés`
      };
    }

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
      console.warn(`[saveWampData] ${json.errors.length} avertissement(s) pour action=${action}:`, json.errors);
    }
    return json;
  } catch (err) {
    console.error(`[saveWampData] Exception pour action=${action}:`, err);
    return null;
  }
}

export async function deleteWampData(action: string, id: string): Promise<{ success: boolean; message?: string } | null> {
  try {
    const res = await fetch(`api.php?action=${action}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[deleteWampData] Exception pour action=${action}&id=${id}:`, err);
    return null;
  }
}
