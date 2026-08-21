(function () {
  "use strict";

  const SESSION_KEY = "balhence_scope_brief_v1";
  const SCHEMA_VERSION = 1;
  const MAX_BRIEF_LENGTH = 16000;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const form = document.querySelector("form[data-lead-form='scope_request']");
    const shell = form && form.closest(".lead-form-shell");
    const handoff = document.querySelector("[data-scope-brief-handoff]");
    if (!form || !shell || !handoff) return;

    const stored = readTransferredBrief();
    if (!stored.found) return;

    if (!stored.value) {
      showTransferNotice(shell, stored.reason);
      return;
    }

    const payload = stored.value;
    handoff.hidden = false;
    shell.classList.add("has-scope-brief");
    handoff.querySelector("[data-scope-recommendation]").textContent = payload.recommendation;
    handoff.querySelector("[data-scope-window]").textContent = payload.indicativeWindow;
    handoff.querySelector("[data-scope-brief-text]").textContent = payload.brief;

    addHiddenField(form, "generated_scope_brief", payload.brief);
    addHiddenField(form, "scope_recommendation", payload.recommendation);
    addHiddenField(form, "scope_indicative_window", payload.indicativeWindow);
    addHiddenField(form, "scope_brief_created_at", payload.createdAt);
    addHiddenField(form, "scope_brief_version", String(payload.version));

    ["website", "service", "deadline", "business_trigger"].forEach((name) => {
      const control = form.elements.namedItem(name);
      const field = control && control.closest(".field");
      if (!control || !field) return;
      control.required = false;
      control.disabled = true;
      field.hidden = true;
    });

    const context = form.elements.namedItem("context");
    const contextLabel = context && form.querySelector("label[for='context']");
    if (context) context.placeholder = "Optional: add a procurement constraint, exact deadline, or another detail not covered by the brief. Do not include credentials or secrets.";
    if (contextLabel) contextLabel.textContent = "Anything to add?";

    const submit = form.querySelector("button[type='submit']");
    if (submit) {
      const arrow = document.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      submit.replaceChildren(document.createTextNode("Send brief for scope review "), arrow);
    }

    const clear = handoff.querySelector("[data-clear-scope-brief]");
    if (clear) {
      clear.addEventListener("click", () => {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (error) { /* Storage may be unavailable. */ }
        window.location.reload();
      });
    }

    document.addEventListener("balhence:form-success", (event) => {
      if (!event.detail || event.detail.formName !== "scope_request") return;
      try { sessionStorage.removeItem(SESSION_KEY); } catch (error) { /* Storage may be unavailable. */ }
    });

    form.addEventListener("submit", () => {
      if (typeof window.gtag === "function") {
        window.gtag("event", "scope_quote_submit", { scope_source: "planner" });
      }
    });
  }

  function readTransferredBrief() {
    let raw;
    try { raw = sessionStorage.getItem(SESSION_KEY); } catch (error) { return { found: false }; }
    if (!raw) return { found: false };

    let payload;
    try { payload = JSON.parse(raw); } catch (error) {
      removeInvalidTransfer();
      return { found: true, reason: "The transferred scope brief could not be read. Continue with the form or rebuild the brief." };
    }

    const expiresAt = Date.parse(payload && payload.expiresAt);
    const valid = payload &&
      payload.version === SCHEMA_VERSION &&
      payload.source === "scope-builder" &&
      typeof payload.createdAt === "string" &&
      typeof payload.recommendation === "string" && payload.recommendation.length <= 120 &&
      typeof payload.indicativeWindow === "string" && payload.indicativeWindow.length <= 120 &&
      typeof payload.brief === "string" && payload.brief.length > 0 && payload.brief.length <= MAX_BRIEF_LENGTH &&
      Number.isFinite(expiresAt);

    if (!valid) {
      removeInvalidTransfer();
      return { found: true, reason: "The transferred scope brief was incomplete. Continue with the form or rebuild the brief." };
    }

    if (expiresAt <= Date.now()) {
      removeInvalidTransfer();
      return { found: true, reason: "The transferred scope brief expired after two hours. Continue with the form or rebuild it to attach a current version." };
    }

    return { found: true, value: payload };
  }

  function addHiddenField(form, name, value) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  function removeInvalidTransfer() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (error) { /* Storage may be unavailable. */ }
  }

  function showTransferNotice(shell, message) {
    const notice = document.createElement("p");
    notice.className = "scope-transfer-notice";
    notice.setAttribute("role", "status");
    notice.textContent = message;
    shell.prepend(notice);
  }
})();
