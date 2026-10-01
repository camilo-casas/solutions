// Street-name normalization so "West 92nd Avenue", "W 92nd Ave" and "92nd"
// can all be compared.

const SUFFIX = {
  avenue: 'Ave', street: 'St', boulevard: 'Blvd', parkway: 'Pkwy', drive: 'Dr',
  court: 'Ct', place: 'Pl', circle: 'Cir', lane: 'Ln', road: 'Rd', way: 'Way',
  trail: 'Trl', terrace: 'Ter', highway: 'Hwy', loop: 'Loop', point: 'Pt',
  square: 'Sq', crossing: 'Xing', expressway: 'Expy', frontage: 'Frontage',
};
const DIRS = { west: 'W', east: 'E', north: 'N', south: 'S' };
const SUFFIX_ABBR = new Set(Object.values(SUFFIX).map((s) => s.toLowerCase()).concat(['ave', 'av', 'blv']));
const DIR_ABBR = new Set(['w', 'e', 'n', 's', 'west', 'east', 'north', 'south']);

/** "West 92nd Avenue" -> "W 92nd Ave" */
export function shortName(name) {
  if (!name) return '';
  return name
    .split(/\s+/)
    .map((w, i, arr) => {
      const l = w.toLowerCase();
      if (i === 0 && DIRS[l] && arr.length > 1) return DIRS[l];
      if (i === arr.length - 1 && SUFFIX[l]) return SUFFIX[l];
      return w;
    })
    .join(' ');
}

function tokens(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => (SUFFIX[t] ? SUFFIX[t].toLowerCase() : t))
    .map((t) => (t === 'av' ? 'ave' : t))
    .map((t) => t.replace(/^(\d+)(st|nd|rd|th)$/, '$1'));
}

/** Comparison key without directional prefix: "West 92nd Avenue" -> "92 ave" */
export function nameKey(name) {
  const t = tokens(name);
  if (t.length > 1 && DIR_ABBR.has(t[0])) t.shift();
  return t.join(' ');
}

/** Looser key without directional or suffix: "West 92nd Avenue" -> "92" */
export function baseKey(name) {
  const t = nameKey(name).split(' ');
  if (t.length > 1 && SUFFIX_ABBR.has(t[t.length - 1])) t.pop();
  return t.join(' ');
}

/** Does a user-typed street match a map street name? */
export function streetMatches(typed, actual) {
  if (!typed || !actual) return false;
  const tk = nameKey(typed);
  if (tk === nameKey(actual)) return true;
  // Only fall back to the base name when the user left the suffix off.
  return baseKey(typed) === tk && tk === baseKey(actual);
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
