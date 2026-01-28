/* ============================
   Duzee v1 — Bill Tracker
   - Local-first data model (no backend)
   - Month-based payment tracking
   - Pre/Post 15th grouping for cashflow awareness
   - Modular vanilla JS architecture
   ============================ */

import { loadState, saveState, wipeState, exportState, importStateFromJson, isPaid, setPaid } from "./storage.js";
import { attachMenu } from "../../shared/js/menu.js";
import { ymFromDate, money } from "../../shared/js/util.js";
import { computeDerived, normalizeBillForm, applyFilterSortSearch, renderInsights } from "./ui.js";

const els = {
  monthInput: document.getElementById("monthInput"),
  addBtn: document.getElementById("addBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  demoBtn: document.getElementById("demoBtn"),
  resetBtn: document.getElementById("resetBtn"),
  menuBtn: document.getElementById("menuBtn"),
  menuPanel: document.getElementById("menuPanel"),

  kpiUnpaid: document.getElementById("kpiUnpaid"),
  kpiPaid: document.getElementById("kpiPaid"),
  kpiCount: document.getElementById("kpiCount"),

  preList: document.getElementById("preList"),
  postList: document.getElementById("postList"),
  preCount: document.getElementById("preCount"),
  postCount: document.getElementById("postCount"),
  preTotal: document.getElementById("preTotal"),
  postTotal: document.getElementById("postTotal"),

  insights: document.getElementById("insights"),
  insightsMeta: document.getElementById("insightsMeta"),

  sortSelect: document.getElementById("sortSelect"),
  searchInput: document.getElementById("searchInput"),
  pills: Array.from(document.querySelectorAll(".pill")),

  dialog: document.getElementById("billDialog"),
  billForm: document.getElementById("billForm"),
  dialogTitle: document.getElementById("dialogTitle"),
  closeDialogBtn: document.getElementById("closeDialogBtn"),

  billId: document.getElementById("billId"),
  nameInput: document.getElementById("nameInput"),
  amountInput: document.getElementById("amountInput"),
  dueDayInput: document.getElementById("dueDayInput"),
  categoryInput: document.getElementById("categoryInput"),
  autopayInput: document.getElementById("autopayInput"),
  notesInput: document.getElementById("notesInput"),

  billTpl: document.getElementById("billCardTpl"),
};

let state = loadState();

function setMonth(ym) {
  const safe = /^\d{4}-\d{2}$/.test(String(ym)) ? ym : ymFromDate();
  state.ui.month = safe;
  els.monthInput.value = safe;
  saveState(state);
  render();
}

/* legacy menu helpers (superseded by shared/menu.js)*/
function closeMenu() {
  els.menuPanel.setAttribute("aria-hidden", "true");
  els.menuBtn.setAttribute("aria-expanded", "false");
}

function toggleMenu() {
  const open = els.menuPanel.getAttribute("aria-hidden") !== "false";
  els.menuPanel.setAttribute("aria-hidden", open ? "false" : "true");
  els.menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
}

function openDialog(mode, bill = null) {
  els.dialogTitle.textContent = mode === "edit" ? "Edit bill" : "Add bill";
  els.billId.value = bill?.id || "";
  els.nameInput.value = bill?.name || "";
  els.amountInput.value = bill?.amount ?? "";
  els.dueDayInput.value = bill?.dueDay ?? "";
  els.categoryInput.value = bill?.category || "";
  els.autopayInput.checked = !!bill?.autopay;
  els.notesInput.value = bill?.notes || "";
  if (els.dialog?.showModal) els.dialog.showModal();
  else els.dialog.setAttribute("open","true");
  setTimeout(() => { els.nameInput?.focus(); try { els.nameInput?.select(); } catch {} }, 20);
}

function closeDialog() {
  if (els.dialog?.close) els.dialog.close();
  else els.dialog.removeAttribute("open");
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 800);
}

function demoData() {
  const demoBills = [
    { name: "Rent", amount: 1800, dueDay: 1, category: "Housing", autopay: true, notes: "" },
    { name: "Electric", amount: 120, dueDay: 7, category: "Utilities", autopay: false, notes: "Varies" },
    { name: "Internet", amount: 75, dueDay: 10, category: "Utilities", autopay: true, notes: "" },
    { name: "Car insurance", amount: 160, dueDay: 18, category: "Insurance", autopay: true, notes: "" },
    { name: "Phone", amount: 35, dueDay: 23, category: "Utilities", autopay: true, notes: "Visible" },
    { name: "Streaming", amount: 28, dueDay: 28, category: "Entertainment", autopay: false, notes: "" },
  ];
  state.bills = demoBills.map(b => ({ ...b, id: `bill_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`, active: true, updatedAt: new Date().toISOString() }));
  state.payments = {};
  // Mark a couple paid for the currently selected month (nice for demos)
  const ym = state.ui.month || ymFromDate();
  const rent = state.bills.find(b => (b.name||"").toLowerCase() === "rent");
  const internet = state.bills.find(b => (b.name||"").toLowerCase() === "internet");
  if (rent) setPaid(state, rent.id, ym, true);
  if (internet) setPaid(state, internet.id, ym, true);
  
  saveState(state);
  render();
}

function removeBill(id) {
  state.bills = (state.bills || []).filter(b => b.id !== id);
  if (state.payments?.[id]) delete state.payments[id];
  saveState(state);
  render();
}

function upsertBill(bill) {
  const i = (state.bills || []).findIndex(x => x.id === bill.id);
  if (i >= 0) state.bills[i] = bill;
  else state.bills.unshift(bill);
  saveState(state);
  render();
}

function setFilter(name) {
  state.ui.filter = name;
  saveState(state);
  els.pills.forEach(p => p.classList.toggle("pill--active", p.dataset.filter === name));
  render();
}


function renderEmptyState(targetEl, kind) {
  targetEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "empty";
  const title = kind === "pre" ? "No pre‑15th bills yet" : "No post‑15th bills yet";
  wrap.innerHTML = `
    <div class="empty__title">${title}</div>
    <div class="empty__sub">Click <strong>Add bill</strong> to get started, or load demo data from the menu.</div>
    <div class="empty__actions">
      <button type="button" class="btn btn--primary" data-empty-add>Add bill</button>
      <button type="button" class="btn btn--ghost" data-empty-demo>Load demo</button>
    </div>
  `;
  wrap.querySelector("[data-empty-add]")?.addEventListener("click", () => openDialog("add"));
  wrap.querySelector("[data-empty-demo]")?.addEventListener("click", () => demoData());
  targetEl.appendChild(wrap);
}


function renderList(targetEl, items, ym) {
  targetEl.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (const bill of items) {
    const node = els.billTpl.content.firstElementChild.cloneNode(true);
    if (bill.paid) node.classList.add("card--paid");
    if (bill.paidAuto) node.classList.add("card--paidauto");

    // Due-soon highlighting (only computed for current month + unpaid)
    if (bill.dueStatus === "overdue") node.classList.add("card--overdue");
    if (bill.dueStatus === "today") node.classList.add("card--dueToday");
    if (bill.dueStatus === "soon") node.classList.add("card--dueSoon");

    node.querySelector(".card__name").textContent = bill.name || "Untitled";
    node.querySelector(".card__amount").textContent = money(bill.amount);

    const dayChip = node.querySelector(".chip--day");
    dayChip.textContent = `Due ${bill.dueDay}`;

    const dueFlag = node.querySelector(".chip--dueflag");
    if (dueFlag) {
      dueFlag.style.display = "none";
      dueFlag.classList.remove("chip--overdue", "chip--today", "chip--soon");
      if (bill.dueStatus === "overdue") {
        dueFlag.style.display = "inline-flex";
        dueFlag.textContent = "Overdue";
        dueFlag.classList.add("chip--overdue");
      } else if (bill.dueStatus === "today") {
        dueFlag.style.display = "inline-flex";
        dueFlag.textContent = "Due today";
        dueFlag.classList.add("chip--today");
      } else if (bill.dueStatus === "soon" && typeof bill.dueInDays === "number") {
        dueFlag.style.display = "inline-flex";
        dueFlag.textContent = bill.dueInDays === 1 ? "Due in 1 day" : `Due in ${bill.dueInDays} days`;
        dueFlag.classList.add("chip--soon");
      }
    }

    const catChip = node.querySelector(".chip--cat");
    catChip.textContent = (bill.category || "Uncategorized");

    const autoChip = node.querySelector(".chip--auto");
    autoChip.style.display = bill.autopay ? "inline-flex" : "none";

    const toggleBtn = node.querySelector(".card__toggle");
    if (bill.paidAuto) {
      toggleBtn.textContent = "Auto-paid";
      toggleBtn.classList.remove("btn--primary");
      toggleBtn.classList.add("btn--success");
      toggleBtn.disabled = true;
      toggleBtn.title = "Autopay bills are treated as paid after their due day (current month)";
    } else {
      toggleBtn.disabled = false;
      toggleBtn.title = "";
      toggleBtn.textContent = bill.paid ? "Mark unpaid" : "Mark paid";
      toggleBtn.classList.toggle("btn--primary", !bill.paid);
      toggleBtn.classList.toggle("btn--success", !!bill.paid);
      toggleBtn.addEventListener("click", () => {
        setPaid(state, bill.id, ym, !bill.paid);
        saveState(state);
        render();
      });
    }

    node.querySelector(".card__edit").addEventListener("click", () => openDialog("edit", bill));
    node.querySelector(".card__del").addEventListener("click", () => {
      if (confirm(`Delete "${bill.name}"?`)) removeBill(bill.id);
    });

    frag.appendChild(node);
  }

  targetEl.appendChild(frag);
}

function render() {
  const ym = state.ui.month || ymFromDate();
  const derived = computeDerived(state, ym);

  // apply filter/sort/search to each section independently, but consistently
  const cfg = { filter: state.ui.filter, sort: state.ui.sort, search: state.ui.search };

  const pre = applyFilterSortSearch(derived.pre, cfg);
  const post = applyFilterSortSearch(derived.post, cfg);

  const preTotal = pre.reduce((a,b) => a + (Number(b.amount)||0), 0);
  const postTotal = post.reduce((a,b) => a + (Number(b.amount)||0), 0);

  els.preCount.textContent = String(pre.length);
  els.postCount.textContent = String(post.length);
  els.preTotal.textContent = money(preTotal);
  els.postTotal.textContent = money(postTotal);

  if (pre.length) renderList(els.preList, pre, ym);
  else renderEmptyState(els.preList, "pre");

  if (post.length) renderList(els.postList, post, ym);
  else renderEmptyState(els.postList, "post");

  els.kpiCount.textContent = String(derived.bills.length);
  els.kpiPaid.textContent = money(derived.totals.paid);
  els.kpiUnpaid.textContent = money(derived.totals.unpaid);

  const asOf = new Date().toLocaleDateString(undefined, { year:"numeric", month:"short" });
  els.insightsMeta.textContent = `For ${ym} • updated ${asOf}`;
  renderInsights(els.insights, derived);
}

function init() {
  // month
  els.monthInput.value = state.ui.month || ymFromDate();
  els.monthInput.addEventListener("change", () => setMonth(els.monthInput.value));

  // menu (shared)
  const menu = attachMenu({ button: els.menuBtn, panel: els.menuPanel });

  // Keyboard shortcut: press "N" to add a new bill (when not typing)
  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? String(e.target.tagName).toLowerCase() : "";
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      openDialog("add");
    }
  });

  // add
  els.addBtn.addEventListener("click", () => openDialog("add"));

  // dialog
  els.closeDialogBtn.addEventListener("click", closeDialog);
  els.billForm.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const bill = normalizeBillForm({
        id: els.billId.value || undefined,
        name: els.nameInput.value,
        amount: els.amountInput.value,
        dueDay: els.dueDayInput.value,
        category: els.categoryInput.value,
        autopay: els.autopayInput.checked,
        notes: els.notesInput.value,
      });
      upsertBill(bill);
      closeDialog();
    } catch (err) {
      alert(err?.message || "Could not save bill.");
    }
  });

  // export/import/reset/demo
  els.exportBtn.addEventListener("click", () => {
    try { menu.close(); } catch {}
    const json = exportState(state);
    download(`duzee-export-${state.ui.month || ymFromDate()}.json`, json);
  });

  els.importInput.addEventListener("change", async (e) => {
    try { menu.close(); } catch {}
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = importStateFromJson(text);
      // preserve UI prefs but accept data
      imported.ui = { ...state.ui, month: state.ui.month || ymFromDate() };
      state = imported;
      saveState(state);
      render();
      alert("Import complete.");
    } catch (err) {
      alert(err?.message || "Import failed.");
    } finally {
      e.target.value = "";
    }
  });

  els.demoBtn.addEventListener("click", () => { closeMenu(); demoData(); });

  els.resetBtn.addEventListener("click", () => {
    try { menu.close(); } catch {}
    if (!confirm("This will wipe Duzee data stored in this browser. Continue?")) return;
    wipeState();
    state = loadState();
    render();
  });

  // filter pills
  els.pills.forEach(p => {
    p.addEventListener("click", () => setFilter(p.dataset.filter));
  });
  setFilter(state.ui.filter || "all");

  // sort/search
  els.sortSelect.value = state.ui.sort || "dueDay";
  els.sortSelect.addEventListener("change", () => {
    state.ui.sort = els.sortSelect.value;
    saveState(state);
    render();
  });

  els.searchInput.value = state.ui.search || "";
  els.searchInput.addEventListener("input", () => {
    state.ui.search = els.searchInput.value;
    saveState(state);
    render();
  });

  render();
}

init();
