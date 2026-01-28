// calendar.js — Duzee v1.2
// Creates a simple iCalendar (.ics) export for bill due dates.
// - Exports all-day events for each bill due date.
// - Generates explicit events for each month in range (no RRULE surprises).

function pad2(n){ return String(n).padStart(2,"0"); }

function clampDayToMonth(year, month1to12, day){
  // JS Date month is 0-based; day 0 gives last day of previous month.
  const last = new Date(year, month1to12, 0).getDate();
  const d = Math.max(1, Math.min(Number(day)||1, last));
  return d;
}

function ymd(year, month1to12, day){
  return `${year}${pad2(month1to12)}${pad2(day)}`;
}

function escapeText(s){
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function makeUid(billId, dateYmd){
  return `duzee-${billId || "bill"}-${dateYmd}@local`;
}

function monthAdd(ym, add){
  const [y,m] = String(ym).split("-").map(Number);
  const d = new Date(y, (m-1) + add, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}

function parseYm(ym){
  const [y,m] = String(ym).split("-").map(Number);
  return { y, m };
}

function downloadText(filename, text){
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportBillsToIcs(state, startYm, months=1){
  const ym0 = /^\d{4}-\d{2}$/.test(String(startYm)) ? String(startYm) : null;
  if (!ym0) throw new Error("Invalid month");
  const bills = Array.isArray(state?.bills) ? state.bills.filter(b => b && b.active !== false) : [];
  const created = new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");

  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Duzee//Bill Tracker//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  for (let i=0;i<months;i++){
    const ym = monthAdd(ym0, i);
    const { y, m } = parseYm(ym);

    for (const b of bills){
      const due = clampDayToMonth(y, m, b.dueDay);
      const dt = ymd(y, m, due);
      const nextDay = clampDayToMonth(y, m, due) + 1; // will be corrected below
      // compute DTEND as next calendar day (handles month rollover)
      const startDate = new Date(y, m-1, due);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate()+1);
      const dtEnd = ymd(endDate.getFullYear(), endDate.getMonth()+1, endDate.getDate());

      const title = b.amount != null && String(b.amount).trim() !== ""
        ? `${b.name} — $${Number(b.amount).toFixed(2)}`
        : String(b.name || "Bill due");

      const descParts = [];
      if (b.category) descParts.push(`Category: ${b.category}`);
      if (b.autopay) descParts.push("Autopay: Yes");
      if (b.notes) descParts.push(`Notes: ${b.notes}`);
      const desc = descParts.join("\n");

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${makeUid(b.id, dt)}`);
      lines.push(`DTSTAMP:${created}`);
      lines.push(`DTSTART;VALUE=DATE:${dt}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
      lines.push(`SUMMARY:${escapeText(title)}`);
      if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");

  const fn = months === 1 ? `duzee_${ym0}_bills.ics` : `duzee_${ym0}_next_${months}_months.ics`;
  downloadText(fn, lines.join("\r\n"));
}
