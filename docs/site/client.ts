const dialog = document.querySelector<HTMLDialogElement>("#search-dialog");
const query = document.querySelector<HTMLInputElement>("#search-query");
const status = document.querySelector<HTMLElement>("#search-status");
const results = [...document.querySelectorAll<HTMLElement>("[data-search]")];

function search() {
  const words = (query?.value ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  let count = 0;
  for (const result of results) {
    result.hidden = !words.every((word) =>
      result.dataset.search?.includes(word),
    );
    if (!result.hidden) count++;
  }
  if (status)
    status.textContent = count
      ? `${count} ${count === 1 ? "page" : "pages"} found`
      : "No pages found. Try another search.";
}
function openSearch() {
  if (!dialog || !query) return;
  dialog.showModal();
  query.focus();
  search();
}
document
  .querySelector("[data-open-search]")
  ?.addEventListener("click", openSearch);
document
  .querySelector("[data-close-search]")
  ?.addEventListener("click", () => dialog?.close());
query?.addEventListener("input", search);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (dialog?.open) dialog.close();
    else openSearch();
  }
});
const sidebar = document.querySelector<HTMLDetailsElement>(".sidebar");
const narrow = matchMedia("(max-width: 900px)");
function updateSidebar() {
  if (sidebar) sidebar.open = !narrow.matches;
}
narrow.addEventListener("change", updateSidebar);
updateSidebar();

export {};
