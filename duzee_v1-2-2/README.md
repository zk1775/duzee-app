# Duzee v1 (Bill Tracker)

A lightweight bill tracker web app (no frameworks) with:
- Add/Edit/Delete bills (name, amount, due day, category, autopay, notes)
- Month selection (YYYY-MM)
- Paid/unpaid status tracked per month
- Pre-15th / Post-15th grouping
- Filters, sorting, search
- Local persistence (`localStorage`)
- Export/Import JSON (portable data)

## Run locally
Just open `index.html` in a browser.

If you want a local server (recommended for modules):
- VS Code Live Server, or
- `python -m http.server` from this folder then open `http://localhost:8000`

## Data model (stored locally)
- `bills[]`: recurring monthly bills (dueDay 1–31)
- `payments[billId][YYYY-MM]`: whether the bill is paid for that month

## Next upgrades (v2 ideas)
- Recurrence rules (monthly/weekly/yearly)
- Calendar export (.ics)
- Cashflow forecast / reminders
- Tags + budgets + charts


## v1.1 polish
- Empty states for sections
- Paid button styling (green)
- Subtle card hover/animation
- Name field auto-select on open
- Keyboard shortcut: N = Add bill
