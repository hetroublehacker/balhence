(function () {
  "use strict";

  const lab = document.querySelector("[data-scope-lab]");
  if (!lab) return;

  const options = Array.from(lab.querySelectorAll("[data-lab-trigger]"));
  const stage = lab.querySelector("[data-lab-stage]");
  const title = lab.querySelector("[data-lab-title]");
  const description = lab.querySelector("[data-lab-description]");
  const emphasis = Array.from(lab.querySelectorAll("[data-lab-emphasis]"));
  const pathLabels = Array.from(lab.querySelectorAll("[data-lab-path]"));
  const link = lab.querySelector("[data-lab-link]");
  const status = lab.querySelector("[data-lab-status]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scenarios = Object.freeze({
    enterprise: Object.freeze({
      label: "Enterprise review",
      title: "Turn a buyer request into an evidence plan.",
      description: "Define the product boundary, report age, roles, tenant paths, and evidence format before procurement turns urgency into an underscoped test.",
      emphasis: ["Web + API boundary", "Role and tenant isolation", "Buyer-ready evidence"],
      path: ["Request", "Boundary", "Evidence", "Decision"],
    }),
    release: Object.freeze({
      label: "Critical release",
      title: "Put the changed attack paths under pressure.",
      description: "Focus the assessment on new identity, payment, file, integration, and privileged workflows while preserving explicit safety and stop conditions.",
      emphasis: ["Changed workflows", "Abuse and business logic", "Release decision"],
      path: ["Change", "Threats", "Proof", "Ship / hold"],
    }),
    audit: Object.freeze({
      label: "Audit evidence",
      title: "Map a real test to the exact evidence request.",
      description: "Start with the current auditor or customer requirement, then scope the technical boundary and reporting fields without promising third-party acceptance.",
      emphasis: ["Exact requirement", "Traceable methodology", "Bounded re-test"],
      path: ["Control", "Scope", "Test", "Record"],
    }),
    baseline: Object.freeze({
      label: "Security baseline",
      title: "Find the highest-value first assessment boundary.",
      description: "Map the live application, APIs, identities, tenants, critical data, and operational readiness before deciding whether a focused sprint or discovery is appropriate.",
      emphasis: ["Attack-surface map", "Critical trust boundaries", "Readiness gaps"],
      path: ["Inventory", "Prioritize", "Test", "Roadmap"],
    }),
  });

  function render(trigger, announce) {
    const scenario = scenarios[trigger];
    if (!scenario) return;

    options.forEach((option) => {
      option.setAttribute("aria-pressed", String(option.dataset.labTrigger === trigger));
    });
    title.textContent = scenario.title;
    description.textContent = scenario.description;
    emphasis.forEach((item, index) => { item.textContent = scenario.emphasis[index]; });
    pathLabels.forEach((item, index) => { item.textContent = scenario.path[index]; });
    link.href = `/scope-builder.html?trigger=${encodeURIComponent(trigger)}`;
    link.dataset.track = `scope_lab_${trigger}`;

    if (!reducedMotion) {
      stage.classList.remove("is-changing");
      window.requestAnimationFrame(() => stage.classList.add("is-changing"));
    }
    if (announce) status.textContent = `${scenario.label} selected. The draft planning path has been updated.`;
  }

  options.forEach((option) => {
    option.addEventListener("click", () => render(option.dataset.labTrigger, true));
  });

  const requested = new URLSearchParams(window.location.search).get("trigger");
  render(scenarios[requested] ? requested : "enterprise", false);
})();
