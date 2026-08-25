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
 * Si le lot est volumineux (> 50 éléments), le découpe automatiquement en sous-lots
 * pour éviter d'excéder les limites post_max_size / memory_limit de PHP.
 */
export async function saveWampData(action: string, data: any): Promise<{ success: boolean; message?: string; count?: number; errors?: string[] } | null> {
  try {
    if (!data) return { success: true, count: 0 };

    // Si c'est un tableau de plus de 50 éléments, envoyer par blocs de 50
    if (Array.isArray(data) && data.length > 50) {
      let totalSaved = 0;
      const allErrors: string[] = [];
      const chunkSize = 50;
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
          } else if (json && !json.success) {
            allErrors.push(json.error || `Erreur lors de l'enregistrement du lot ${i / chunkSize + 1}`);
          }
        } else {
          allErrors.push(`Erreur HTTP ${res.status} sur le lot ${i / chunkSize + 1}`);
        }
      }
      return {
        success: totalSaved > 0 || data.length === 0,
        count: totalSaved,
        errors: allErrors,
        message: `${totalSaved}/${data.length} enregistrements sauvegardés dans MySQL`
      };
    }

    const res = await fetch(`api.php?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      console.error(`[saveWampData] HTTP ${res.status} pour action=${action}`);
      return { success: false, message: `Erreur HTTP ${res.status}` };
    }

    const json = await res.json().catch(() => null);
    if (!json) {
      return { success: false, message: 'Réponse API non-JSON reçue du serveur' };
    }
    if (!json.success) {
      console.error(`[saveWampData] Échec API action=${action}:`, json.error || json.message);
    }
    if (json.errors && json.errors.length > 0) {
      console.warn(`[saveWampData] ${json.errors.length} avertissement(s) pour action=${action}:`, json.errors);
    }
    return json;
  } catch (err: any) {
    console.error(`[saveWampData] Exception pour action=${action}:`, err);
    return { success: false, message: err?.message || 'Exception réseau ou serveur WAMP' };
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

/* ===================================================================== */
/*  Paramètres applicatifs — stockés STRICTEMENT dans MySQL (WAMP)       */
/* ===================================================================== */

/** Récupère la valeur d'un paramètre (ou null si absent / indisponible). */
export async function fetchWampParametre<T = any>(cle: string): Promise<T | null> {
  try {
    const res = await fetch(`api.php?action=parametres&cle=${encodeURIComponent(cle)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json && json.success ? (json.data as T) : null;
  } catch (err) {
    console.error(`[fetchWampParametre] Exception pour cle=${cle}:`, err);
    return null;
  }
}

/** Enregistre un paramètre dans MySQL (upsert clé/valeur JSON). */
export async function saveWampParametre(cle: string, valeur: any): Promise<boolean> {
  try {
    const res = await fetch('api.php?action=parametres', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cle, valeur })
    });
    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    return !!(json && json.success);
  } catch (err) {
    console.error(`[saveWampParametre] Exception pour cle=${cle}:`, err);
    return false;
  }
}
