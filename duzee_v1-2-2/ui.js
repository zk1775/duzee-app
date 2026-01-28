import { money, clamp, uid } from "./util.js";
import { isPaid } from "./storage.js";

function currentYM(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function daysInMonth(year, monthIndex0) {
  // monthIndex0 is 0-11
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffDays(a, b) {
  // integer days between dates at start-of-day
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86400000);
}

function dueMetaFor(bill, ym, today) {
  // Only compute relative labels when viewing the current month
  if (!today) return { status: "", inDays: null, dueDay: Number(bill.dueDay) || null };

  const [yStr, mStr] = String(ym).split("-");
  const y = Number(yStr);
  const mIdx = Number(mStr) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(mIdx)) return { status: "", inDays: null, dueDay: Number(bill.dueDay) || null };

  const dim = daysInMonth(y, mIdx);
  const dueDay = clamp(bill.dueDay, 1, dim);
  const due = new Date(y, mIdx, dueDay);

  const inDays = diffDays(due, today);
  if (inDays < 0) return { status: "overdue", inDays, dueDay };
  if (inDays === 0) return { status: "today", inDays, dueDay };
  if (inDays <= 7) return { status: "soon", inDays, dueDay };
  return { status: "", inDays, dueDay };
}

export function computeDerived(state, ym) {
  const bills = (state.bills || []).filter(b => b && b.active !== false);

  // Option A: "Effective paid" for autopay bills after their due day,
  // without mutating storage. Only applies when viewing the *current* month.
  const today = new Date();
  const todayYM = currentYM(today);
  const refToday = (String(ym) === todayYM) ? today : null;

  const withStatus = bills.map(b => {
    const paidManual = isPaid(state, b.id, ym);

    // Autopay becomes effectively paid after the due day in the current month
    let paidAuto = false;
    if (!paidManual && b.autopay && refToday) {
      const due = dueMetaFor(b, ym, refToday);
      // If today is on/after due day, treat as paid (auto)
      if (typeof due.dueDay === "number" && refToday.getDate() >= due.dueDay) paidAuto = true;
    }

    const paid = paidManual || paidAuto;
    const dueMeta = (!paid && refToday) ? dueMetaFor(b, ym, refToday) : { status: "", inDays: null, dueDay: Number(b.dueDay) || null };

    return {
      ...b,
      paid,
      paidManual,
      paidAuto,
      dueStatus: dueMeta.status,
      dueInDays: dueMeta.inDays,
      dueDayEff: dueMeta.dueDay,
    };
  });

  const pre = withStatus.filter(b => Number(b.dueDay) <= 15);
  const post = withStatus.filter(b => Number(b.dueDay) > 15);

  const sum = arr => arr.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const sumPaid = arr => arr.reduce((acc, b) => acc + (b.paid ? (Number(b.amount)||0) : 0), 0);
  const sumUnpaid = arr => arr.reduce((acc, b) => acc + (!b.paid ? (Number(b.amount)||0) : 0), 0);

  return {
    bills: withStatus,
    pre,
    post,
    totals: {
      all: sum(withStatus),
      paid: sumPaid(withStatus),
      unpaid: sumUnpaid(withStatus),
      pre: sum(pre),
      post: sum(post),
    }
  };
}

export function normalizeBillForm({ id, name, amount, dueDay, category, autopay, notes }) {
  const b = {
    id: id || uid("bill"),
    name: String(name || "").trim().slice(0, 60),
    amount: Number(amount || 0),
    dueDay: clamp(dueDay, 1, 31),
    category: String(category || "").trim().slice(0, 40),
    autopay: !!autopay,
    notes: String(notes || "").trim().slice(0, 220),
    active: true,
    updatedAt: new Date().toISOString(),
  };
  if (!b.name) throw new Error("Name is required");
  if (!Number.isFinite(b.amount) || b.amount < 0) throw new Error("Amount must be valid");
  return b;
}

export function applyFilterSortSearch(list, { filter, sort, search }) {
  const q = String(search || "").trim().toLowerCase();
  let out = [...list];

  if (q) {
    out = out.filter(b =>
      (b.name || "").toLowerCase().includes(q) ||
      (b.category || "").toLowerCase().includes(q) ||
      (b.notes || "").toLowerCase().includes(q)
    );
  }

  if (filter === "paid") out = out.filter(b => !!b.paid);
  if (filter === "unpaid") out = out.filter(b => !b.paid);
  if (filter === "autopay") out = out.filter(b => !!b.autopay);

  if (sort === "amountDesc") out.sort((a,b) => (Number(b.amount)||0) - (Number(a.amount)||0));
  else if (sort === "amountAsc") out.sort((a,b) => (Number(a.amount)||0) - (Number(b.amount)||0));
  else if (sort === "nameAsc") out.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""), undefined, { sensitivity:"base" }));
  else out.sort((a,b) => (Number(a.dueDay)||0) - (Number(b.dueDay)||0));

  return out;
}

export function renderInsights(root, derived) {
  const { bills, totals } = derived;
  const count = bills.length;
  const paidCount = bills.filter(b => b.paid).length;
  const unpaidCount = count - paidCount;

  const biggest = [...bills].sort((a,b) => (Number(b.amount)||0)-(Number(a.amount)||0))[0];
  const byCat = new Map();
  for (const b of bills) {
    const k = (b.category || "Uncategorized").trim() || "Uncategorized";
    byCat.set(k, (byCat.get(k) || 0) + (Number(b.amount)||0));
  }
  const topCat = [...byCat.entries()].sort((a,b) => b[1]-a[1])[0];

  root.innerHTML = "";
  const mk = (label, value) => {
    const el = document.createElement("div");
    el.className = "insight";
    el.innerHTML = `<div class="insight__label">${label}</div><div class="insight__value">${value}</div>`;
    root.appendChild(el);
  };

  mk("Bills paid", `${paidCount} / ${count}`);
  mk("Remaining this month", money(totals.unpaid));
  mk("Largest bill", biggest ? `${biggest.name} • ${money(biggest.amount)}` : "—");
  mk("Top category", topCat ? `${topCat[0]} • ${money(topCat[1])}` : "—");
  mk("Pre‑15th vs Post‑15th", `${money(totals.pre)} / ${money(totals.post)}`);
  mk("Paid vs Unpaid", `${money(totals.paid)} / ${money(totals.unpaid)}`);
}
