// shared/js/util.js
// Minimal shared utilities used by Duzee.
// (Created to satisfy imports from js/main.js without changing your app architecture.)

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  // Keep 2 decimals only when needed
  const fixed = Math.round(n * 100) / 100;
  const str = fixed.toLocaleString(undefined, {
    minimumFractionDigits: fixed % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `$${str}`;
}

export function uid(prefix = "b") {
  // Simple, collision-resistant-enough for local apps
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function ymFromDate(d = new Date()) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
