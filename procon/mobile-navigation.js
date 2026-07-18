const MOBILE_VIEW_NAMES = new Set(["decision", "consequences", "analysis"]);

export function bindMobileNavigation() {
  const shell = document.getElementById("main-content");
  const navigation = document.querySelector(".mobile-view-nav");
  if (!shell || !navigation) return;

  navigation.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mobile-view-target]");
    const view = button?.dataset.mobileViewTarget;
    if (!MOBILE_VIEW_NAMES.has(view)) return;

    shell.dataset.mobileView = view;
    for (const candidate of navigation.querySelectorAll("[data-mobile-view-target]")) {
      candidate.setAttribute(
        "aria-pressed",
        String(candidate.dataset.mobileViewTarget === view),
      );
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    navigation.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  });
}
