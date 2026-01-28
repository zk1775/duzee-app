import { ymFromDate, nowISO } from "./util.js";

const KEY = "duzee_v1_state";

function blankState() {
  return {
    version: 2,
    bills: [],
    payments: {}, // { [billId]: { [ym]: { paid: true, paidAt: iso } } }
    ui: {
      filter: "all",
      sort: "dueDay",
      search: "",
      month: ymFromDate(),
      onboardingDismissed: false,
    },
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw);
    // shallow validation
    if (!parsed || typeof parsed !== "object") return blankState();
    if (!Array.isArray(parsed.bills)) parsed.bills = [];
    if (!parsed.payments || typeof parsed.payments !== "object") parsed.payments = {};
    if (!parsed.ui || typeof parsed.ui !== "object") parsed.ui = blankState().ui;
    if (!parsed.ui.month) parsed.ui.month = ymFromDate();
    if (typeof parsed.ui.onboardingDismissed !== "boolean") parsed.ui.onboardingDismissed = false;
    return parsed;
  } catch {
    return blankState();
  }
}

export function saveState(state) {
  state.updatedAt = nowISO();
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function wipeState() {
  localStorage.removeItem(KEY);
}

export function exportState(state) {
  // Keep only what we need
  const out = {
    version: state.version ?? 1,
    bills: state.bills ?? [],
    payments: state.payments ?? {},
    createdAt: state.createdAt ?? nowISO(),
    updatedAt: nowISO(),
  };
  return JSON.stringify(out, null, 2);
}

export function importStateFromJson(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");
  if (!Array.isArray(parsed.bills)) throw new Error("Missing bills[]");
  if (!parsed.payments || typeof parsed.payments !== "object") parsed.payments = {};
  const state = blankState();
  state.bills = parsed.bills;
  state.payments = parsed.payments;
  state.createdAt = parsed.createdAt ?? nowISO();
  state.updatedAt = nowISO();
  return state;
}

export function isPaid(state, billId, ym) {
  return !!(state.payments?.[billId]?.[ym]?.paid);
}

export function setPaid(state, billId, ym, paid) {
  if (!state.payments[billId]) state.payments[billId] = {};
  if (paid) {
    state.payments[billId][ym] = { paid: true, paidAt: nowISO() };
  } else {
    if (state.payments[billId]) delete state.payments[billId][ym];
  }
}
