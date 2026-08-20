const fs = require('fs');
const path = 'src/utils/formatters.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /export function formatMoney[\s\S]+?\n\}/,
  `export function formatMoney(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 Ar';
  const parts = Math.round(amount).toString().split('.');
  parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ');
  return parts.join('.') + ' Ar';
}`
);

fs.writeFileSync(path, code, 'utf8');
