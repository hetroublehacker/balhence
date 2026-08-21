(function () {
  "use strict";

  const variants = Object.freeze({
    scope: Object.freeze({
      tag: "Pentest scoping checklist",
      eyebrow: "Buyer guide / scoping",
      headline: "Scope the web and API boundary",
      accent: "before comparing quotes.",
      subtitle: "Assets. Roles. Tenants. Safety controls. Evidence. Re-test.",
    }),
    report: Object.freeze({
      tag: "Pentest report checklist",
      eyebrow: "Buyer guide / report quality",
      headline: "Know what a pentest report",
      accent: "must prove.",
      subtitle: "Scope. Reproduction evidence. Impact. Remediation. Closure.",
    }),
    readiness: Object.freeze({
      tag: "SaaS pentest readiness",
      eyebrow: "Preparation checklist",
      headline: "Prepare the test window",
      accent: "before it opens.",
      subtitle: "Accounts. Architecture. Safe data. Monitoring. Escalation.",
    }),
    cost: Object.freeze({
      tag: "Pentest cost and scope",
      eyebrow: "Buyer guide / quote quality",
      headline: "Compare the scope behind",
      accent: "every pentest quote.",
      subtitle: "Assets. Roles. Test depth. Evidence. Re-test. Change control.",
    }),
    ai: Object.freeze({
      tag: "AI-native penetration testing",
      eyebrow: "Method / human validated",
      headline: "AI widens the search.",
      accent: "A human proves the finding.",
      subtitle: "Scope. Recon. Hypotheses. Evidence. Reporting. Re-test.",
    }),
  });

  const variant = variants[new URLSearchParams(window.location.search).get("variant")];
  if (!variant) return;

  const bindings = {
    "[data-og-tag]": variant.tag,
    "[data-og-eyebrow]": variant.eyebrow,
    "[data-og-headline]": variant.headline,
    "[data-og-accent]": variant.accent,
    "[data-og-subtitle]": variant.subtitle,
  };

  Object.entries(bindings).forEach(([selector, value]) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  });
}());
