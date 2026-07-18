const MOBILE_VIEW_NAMES = new Set(["summary", "decision", "consequences", "analysis"]);
const MOBILE_VIEW_TITLES = {
  decision: "Change the decision",
  consequences: "Review what matters",
  analysis: "See the calculation",
};
const MOBILE_VIEW_FOCUS_TARGETS = {
  summary: "mobile-brief-question",
  decision: "decision-heading",
  consequences: "factors-heading",
  analysis: "analysis-heading",
};

export function bindMobileNavigation() {
  const shell = document.getElementById("main-content");
  const navigation = document.querySelector(".mobile-view-nav");
  if (!shell || !navigation) return;

  shell.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mobile-view-target]");
    const view = button?.dataset.mobileViewTarget;
    if (!MOBILE_VIEW_NAMES.has(view)) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isPhoneLayout = window.matchMedia("(max-width: 759px)").matches;
    shell.dataset.mobileView = view;
    document.getElementById("mobile-view-title").textContent = MOBILE_VIEW_TITLES[view] ?? "";

    const focusTarget = document.getElementById(MOBILE_VIEW_FOCUS_TARGETS[view]);
    (isPhoneLayout ? shell : focusTarget)?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    window.requestAnimationFrame(() => {
      focusTarget?.focus({ preventScroll: true });
    });
  });
}
