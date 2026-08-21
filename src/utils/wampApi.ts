/**
 * Service de synchronisation API Backend WAMP (PHP / MySQL)
 */

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

export async function saveWampData(action: string, data: any) {
  try {
    const res = await fetch(`api.php?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
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
