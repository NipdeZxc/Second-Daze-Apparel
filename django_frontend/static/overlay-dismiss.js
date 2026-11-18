document.addEventListener("click", (event) => {
  const dismissButton = event.target.closest("[data-dismiss]");
  if (!dismissButton) return;

  const dialog = dismissButton.closest(".prototype-overlay");
  const scrim = document.querySelector(".overlay-scrim");
  if (dialog) dialog.hidden = true;
  if (scrim) scrim.hidden = true;
});
