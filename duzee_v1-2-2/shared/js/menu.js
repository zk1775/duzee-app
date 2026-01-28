// shared/js/menu.js
// Tiny dropdown menu helper.
// Usage: attachMenu({ button: HTMLElement, panel: HTMLElement })
export function attachMenu({ button, panel }) {
  if (!button || !panel) {
    throw new Error("attachMenu requires {button, panel}");
  }

  // Prefer using the native hidden attribute if present.
  const setOpen = (open) => {
    button.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
    panel.dataset.open = open ? "1" : "0";
  };

  const isOpen = () => panel.hidden === false || panel.dataset.open === "1";

  const open = () => setOpen(true);
  const close = () => setOpen(false);
  const toggle = () => setOpen(!isOpen());

  // Initialize closed if not explicitly shown
  if (!("hidden" in panel) || panel.hidden === undefined) {
    panel.hidden = true;
  } else {
    // If markup didn't set it, default closed
    if (panel.hidden !== false) panel.hidden = true;
  }
  setOpen(false);

  button.addEventListener("click", (e) => {
    e.preventDefault();
    toggle();
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!isOpen()) return;
    const t = e.target;
    if (t && (button.contains(t) || panel.contains(t))) return;
    close();
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) close();
  });

  return { open, close, toggle, isOpen };
}
