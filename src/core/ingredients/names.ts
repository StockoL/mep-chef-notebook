/**
 * Matching names the way a chef means them: "tom puree" is "Tomato purée"
 * (via an alias), "Shallots" is "shallot", "crème fraîche" is "creme fraiche".
 */

/** Lower case, no accents, single spaces: the form names are compared in. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The last word made singular: "shallots" → "shallot", "cherries" → "cherry", "tomatoes" → "tomato". */
export function singular(normalized: string): string {
  const words = normalized.split(' ');
  const last = words.pop() ?? '';
  let one = last;
  if (last.length > 3) {
    if (last.endsWith('ies')) one = `${last.slice(0, -3)}y`;
    else if (last.endsWith('oes')) one = last.slice(0, -2);
    else if (/(ss|x|ch|sh)es$/.test(last)) one = last.slice(0, -2);
    else if (last.endsWith('s') && !last.endsWith('ss') && !last.endsWith('us')) one = last.slice(0, -1);
  }
  return [...words, one].join(' ');
}

/** Do two names mean the same thing? */
export function namesMatch(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  return x.length > 0 && (x === y || singular(x) === singular(y));
}

/** The first item whose name or one of whose aliases matches. */
export function findByName<T extends { name: string; aliases: string[] }>(items: readonly T[], name: string): T | undefined {
  return items.find((item) => namesMatch(item.name, name) || item.aliases.some((alias) => namesMatch(alias, name)));
}

/** Does `text` appear in this name or its aliases? For search. */
export function nameContains(item: { name: string; aliases?: string[] }, text: string): boolean {
  const query = normalizeName(text);
  if (!query) return false;
  return [item.name, ...(item.aliases ?? [])].some((n) => normalizeName(n).includes(query));
}

/** "tom puree" → "Tom puree": a new ingredient's name as typed, with a capital. */
export function capitalise(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
