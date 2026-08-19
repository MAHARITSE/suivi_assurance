export function formatMoney(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 Ar';
  return new Intl.NumberFormat('fr-MG', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount) + ' Ar';
}

export function normalizeDateISO(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // If DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (ex: 21/04/2026 or 01/04/26)
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) {
      const yrNum = parseInt(year, 10);
      year = yrNum < 70 ? `20${year}` : `19${year}`;
    }
    return `${year}-${month}-${day}`;
  }
  
  // If YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fallback
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  
  return trimmed;
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  const iso = normalizeDateISO(dateString);
  const parts = iso.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}
