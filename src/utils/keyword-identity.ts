function singularizeToken(token: string): string {
  if (token.endsWith('mas')) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('s') && !token.endsWith('ss') && !token.endsWith('us') && !token.endsWith('is') && token.length > 3) return token.slice(0, -1);
  return token;
}

/** Normalizes only formatting and obvious singular/plural differences. */
export function normalizeJevKeyword(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).map(singularizeToken).join(' ');
}
