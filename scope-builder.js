(function () {
  "use strict";

  const STORAGE_KEY = "balhence_scope_builder_v1";
  const SESSION_KEY = "balhence_scope_brief_v1";
  const SCHEMA_VERSION = 1;
  const STEP_NAMES = ["Business outcome", "Target surfaces", "Trust model", "Critical workflows", "Environment & readiness", "Evidence & timing"];
  const ARRAY_FIELDS = ["surfaces", "auth_methods", "workflows", "readiness", "deliverables"];
  const CONTACT_URL = "/contact.html?service=web-api&utm_source=scope-builder&utm_medium=website&utm_campaign=scope-planner";
  const FIXED_EXCLUSIONS = Object.freeze([
    "Denial of service, destructive testing, or data destruction",
    "Social engineering or physical security testing",
    "Access to real customer data beyond the minimum safe proof",
    "Assets, tenants, integrations, and environments outside the signed scope",
    "Source-code review, mobile-binary review, cloud configuration review, and compliance certification",
  ]);
  const NEXT_VALIDATION_STEP = "A short scope review validates the asset inventory, access model, safety rules, exclusions, calendar, and commercial terms before Balhence issues a statement of work.";
  const SECURITY_NOTE = "Do not add passwords, API keys, session tokens, customer data, or other secrets to this brief.";
  const FIELD_ERRORS = Object.freeze({
    business_trigger: "Choose the primary reason for this test.",
    evidence_audience: "Choose who will use the evidence.",
    evidence_deadline: "Choose an evidence deadline.",
    web_app_count: "Choose the number of distinct web applications.",
    api_group_count: "Choose the number of distinct API groups.",
    exposure: "Choose how the target is exposed.",
    role_count: "Choose the number of distinct user roles.",
    integration_count: "Choose the number of third-party integrations.",
    tenant_model: "Choose the tenant model.",
    logic_depth: "Choose the required business-logic depth.",
    environment: "Choose the testing environment.",
    safety_window: "Choose the current test-window status.",
    test_start: "Choose a preferred test start.",
    retest_window: "Choose a remediation window.",
  });

  const LABELS = Object.freeze({
    business_trigger: Object.freeze({
      enterprise: "Enterprise deal",
      release: "Critical release",
      audit: "Audit evidence",
      assurance: "Independent assurance",
    }),
    evidence_audience: Object.freeze({
      customer: "Customer or procurement team",
      engineering: "Engineering and product leaders",
      audit: "Auditor or compliance team",
      board: "Leadership or board",
      mixed: "Several stakeholder groups",
    }),
    evidence_deadline: Object.freeze({
      under_2: "Under 2 weeks",
      "2_4": "2-4 weeks",
      "5_8": "5-8 weeks",
      flexible: "Flexible / planning ahead",
    }),
    surfaces: Object.freeze({
      web: "Web application",
      rest: "REST API",
      graphql: "GraphQL API",
      admin: "Admin / back office",
      mobile: "Mobile-backed API",
      external: "External exposure",
    }),
    web_app_count: Object.freeze({ 0: "None", 1: "1", 2: "2", 3: "3", "4plus": "4+" }),
    api_group_count: Object.freeze({ 0: "None", 1: "1", 2: "2", 3: "3", "4plus": "4+" }),
    exposure: Object.freeze({
      public: "Public internet",
      partner: "Partner / customer network",
      internal: "Internal only",
      mixed: "Mixed exposure",
    }),
    role_count: Object.freeze({ "1_2": "1-2 roles", "3_4": "3-4 roles", "5_7": "5-7 roles", "8plus": "8+ roles" }),
    integration_count: Object.freeze({ 0: "None", "1_2": "1-2", "3_5": "3-5", "6plus": "6+", unknown: "Not inventoried" }),
    tenant_model: Object.freeze({ single: "Single tenant", multi: "Multi-tenant", hybrid: "Hybrid tenancy", unknown: "Not confirmed" }),
    auth_methods: Object.freeze({
      password: "Password / magic link",
      sso: "SSO / SAML",
      oidc: "OAuth / OIDC",
      mfa: "MFA",
      service: "API keys / service authentication",
      invite: "Invites / recovery",
    }),
    workflows: Object.freeze({
      payments: "Payments and billing",
      data: "Sensitive data",
      admin: "Privilege lifecycle",
      files: "Files and documents",
      integrations: "Integrations",
      identity: "Identity changes",
    }),
    logic_depth: Object.freeze({ baseline: "Baseline", priority: "Priority-led", extensive: "Extensive" }),
    environment: Object.freeze({ staging: "Representative staging", production: "Production", both: "Staging and production" }),
    safety_window: Object.freeze({ agreed: "Defined window", business: "Business hours", unknown: "Not agreed yet" }),
    readiness: Object.freeze({
      authorization: "Written authorization owner",
      accounts: "Controlled accounts for each role",
      docs: "Architecture and API documentation",
      data: "Safe seeded test data",
      contact: "Technical and escalation contacts",
      controls: "Rate limits and allowlisting path",
    }),
    deliverables: Object.freeze({
      report: "Executive and technical report",
      alerts: "Critical alerts during testing",
      walkthrough: "Engineering walkthrough",
      retest: "One bounded re-test",
      letter: "Customer-facing closure letter",
      mapping: "Control or requirement mapping",
    }),
    test_start: Object.freeze({
      asap: "As soon as readiness allows",
      "2_4": "Within 2-4 weeks",
      "5_8": "Within 5-8 weeks",
      quarter: "This quarter",
      exploring: "Exploring options",
    }),
    retest_window: Object.freeze({ 2: "Within 2 weeks", 4: "Within 4 weeks", 6: "Within 6 weeks", unknown: "Not confirmed" }),
  });

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const form = document.getElementById("scope-planner-form");
    if (!form) return;

    const steps = Array.from(form.querySelectorAll("[data-step]"));
    const progress = document.querySelector("[data-progress]");
    const progressFill = document.querySelector("[data-progress-fill]");
    const stepCount = document.querySelector("[data-step-count]");
    const stepName = document.querySelector("[data-step-name]");
    const jumpButtons = Array.from(document.querySelectorAll("[data-step-jump]"));
    const errorBox = document.querySelector("[data-form-error]");
    const saveStatus = document.querySelector("[data-save-status]");
    const summary = document.querySelector(".sb-summary");
    const copyButton = document.querySelector("[data-copy]");
    const downloadButton = document.querySelector("[data-download]");
    const downloadLabel = document.querySelector("[data-download-label]");
    const printButton = document.querySelector("[data-print]");
    const resetButton = document.querySelector("[data-reset]");
    const contactCta = document.querySelector("[data-contact-cta]");
    const liveMessage = document.querySelector("[data-live-message]");
    const printBrief = document.querySelector("[data-print-brief]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    prepareFieldErrors(form);

    let currentStep = 0;
    let furthestStep = 0;
    let finalized = false;
    let currentBrief = "";
    let currentBriefModel = null;
    let currentResult = null;
    let saveTimer = 0;
    let savePending = false;
    let screenDocumentTitle = document.title;
    let printTitleActive = false;

    const setPrintDocumentTitle = () => {
      if (!finalized || !currentBriefModel) return;
      if (!printTitleActive) screenDocumentTitle = document.title;
      const generatedAt = new Date(currentBriefModel.generatedAtISO);
      const dateStamp = Number.isNaN(generatedAt.getTime())
        ? ""
        : `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, "0")}-${String(generatedAt.getDate()).padStart(2, "0")}`;
      document.title = `Balhence Draft Pentest Scope Brief${dateStamp ? ` ${dateStamp}` : ""}`;
      printTitleActive = true;
    };

    const restoreScreenDocumentTitle = () => {
      if (!printTitleActive) return;
      document.title = screenDocumentTitle;
      printTitleActive = false;
    };

    const restored = restoreState(form);
    if (restored) {
      currentStep = clamp(restored.step, 0, steps.length - 1);
      furthestStep = clamp(Math.max(restored.furthestStep || 0, currentStep), 0, steps.length - 1);
      if (saveStatus) saveStatus.textContent = "Draft resumed from this browser";
      if (liveMessage) liveMessage.textContent = "Saved answers resumed. Rebuild the brief before continuing.";
    }
    const triggerPrefill = applyTriggerPrefill(form);
    if (triggerPrefill) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (error) { /* Storage may be unavailable. */ }
      if (saveStatus) saveStatus.textContent = `Started from ${label("business_trigger", triggerPrefill)} trigger`;
      if (liveMessage) liveMessage.textContent = "Business trigger carried in from the previous page. Nothing else was placed in the URL.";
    }

    document.body.classList.add("sb-ready");
    summary.setAttribute("tabindex", "-1");
    showStep(currentStep, false);
    updateSummary();
    setFinalActions(false);

    form.addEventListener("submit", (event) => event.preventDefault());

    form.addEventListener("change", (event) => {
      clearFieldError(event.target);
      invalidateBrief();
      updateSummary();
      saveStateSoon();
    });

    form.querySelectorAll("[data-next]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!validateStep(currentStep, true)) return;
        furthestStep = Math.max(furthestStep, Math.min(currentStep + 1, steps.length - 1));
        showStep(Math.min(currentStep + 1, steps.length - 1), true);
        saveStateSoon();
      });
    });

    form.querySelectorAll("[data-back]").forEach((button) => {
      button.addEventListener("click", () => {
        showStep(Math.max(currentStep - 1, 0), true);
        saveStateSoon();
      });
    });

    jumpButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const target = Number(button.dataset.stepJump);
        if (!Number.isInteger(target) || target > furthestStep) return;
        showStep(target, true);
        saveStateSoon();
      });
    });

    const buildButton = form.querySelector("[data-build-brief]");
    buildButton.addEventListener("click", () => {
      const invalidStep = firstInvalidStep();
      if (invalidStep !== -1) {
        furthestStep = Math.max(furthestStep, invalidStep);
        showStep(invalidStep, false);
        validateStep(invalidStep, true);
        return;
      }

      updateSummary();
      currentBriefModel = createBriefModel(readForm(form), currentResult);
      currentBrief = createBrief(currentBriefModel);
      if (printBrief) renderPrintBrief(printBrief, currentBriefModel);
      finalized = true;
      setFinalActions(true);
      printButton.hidden = true;
      const transferReady = persistSessionBrief(currentBrief, currentResult);
      saveStateNow();
      announce(transferReady
        ? "Draft scope brief ready. Download the PDF, copy the details, or continue to a review."
        : "Draft scope brief ready. Browser storage is unavailable, so download the PDF or copy the details before requesting a review.", transferReady ? "status" : "error");
      if (summary) {
        summary.classList.remove("is-updated");
        window.requestAnimationFrame(() => summary.classList.add("is-updated"));
        if (window.innerWidth < 921) {
          summary.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
        }
        summary.focus({ preventScroll: true });
      }
      track("scope_brief_built", { recommendation: currentResult.key });
    });

    copyButton.addEventListener("click", async () => {
      if (!finalized || !currentBrief) return;
      const copied = await copyText(currentBrief);
      announce(copied ? "Draft brief copied to the clipboard." : "Clipboard access was blocked. Use Download PDF instead.", copied ? "status" : "error");
      if (copied) track("scope_brief_copied", { recommendation: currentResult.key });
    });

    downloadButton.addEventListener("click", async () => {
      if (!finalized || !currentBrief || !currentBriefModel) return;
      downloadButton.disabled = true;
      downloadButton.setAttribute("aria-busy", "true");
      printButton.hidden = true;
      if (downloadLabel) downloadLabel.textContent = "Creating PDF...";
      announce("Creating your formatted scope brief PDF.");

      await new Promise((resolve) => window.setTimeout(resolve, 0));
      try {
        if (!window.BalhenceScopePdf || typeof window.BalhenceScopePdf.download !== "function") {
          throw new Error("PDF generator unavailable");
        }
        window.BalhenceScopePdf.download(currentBriefModel);
        announce("Formatted scope brief PDF downloaded.");
        track("scope_brief_pdf_downloaded", { recommendation: currentResult.key });
      } catch (error) {
        printButton.hidden = false;
        printButton.disabled = false;
        announce("The PDF could not be created in this browser. Use the Print fallback or Copy details instead.", "error");
      } finally {
        downloadButton.removeAttribute("aria-busy");
        downloadButton.disabled = !finalized;
        if (downloadLabel) downloadLabel.textContent = "Download PDF";
      }
    });

    printButton.addEventListener("click", () => {
      if (!finalized || !currentBrief) return;
      announce("Opening the print dialog. Choose Save as PDF to keep a PDF copy.");
      track("scope_brief_printed", { recommendation: currentResult.key });
      setPrintDocumentTitle();
      window.print();
      window.setTimeout(restoreScreenDocumentTitle, 0);
    });

    resetButton.addEventListener("click", () => {
      const confirmed = window.confirm("Reset every scope-planner answer saved in this browser?");
      if (!confirmed) return;
      window.clearTimeout(saveTimer);
      saveTimer = 0;
      savePending = false;
      form.reset();
      clearAllErrors();
      removeStoredBriefs();
      currentStep = 0;
      furthestStep = 0;
      finalized = false;
      currentBrief = "";
      currentBriefModel = null;
      if (printBrief) printBrief.textContent = "";
      setFinalActions(false);
      showStep(0, false);
      updateSummary();
      if (saveStatus) saveStatus.textContent = "Draft cleared from this browser";
      announce("Planner reset. Nothing was submitted.");
      track("scope_planner_reset");
    });

    contactCta.addEventListener("click", (event) => {
      if (!finalized || !currentBrief) {
        event.preventDefault();
        if (liveMessage) liveMessage.textContent = "Build the draft scope brief before continuing to a review.";
        buildButton.focus();
        return;
      }
      if (!persistSessionBrief(currentBrief, currentResult)) {
        event.preventDefault();
        announce("Your browser could not transfer the brief. Download the PDF or copy the details, then use Contact to request a review.", "error");
        downloadButton.focus();
        return;
      }
      contactCta.href = CONTACT_URL;
    });

    const flushPendingSave = () => {
      if (savePending) saveStateNow();
    };
    window.addEventListener("pagehide", flushPendingSave);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushPendingSave();
    });
    window.addEventListener("beforeprint", setPrintDocumentTitle);
    window.addEventListener("afterprint", restoreScreenDocumentTitle);
    if (triggerPrefill) saveStateSoon();

    function showStep(index, focusHeading) {
      currentStep = clamp(index, 0, steps.length - 1);
      steps.forEach((step, stepIndex) => {
        const active = stepIndex === currentStep;
        step.hidden = !active;
        step.classList.remove("is-entering");
        if (active && focusHeading) {
          window.requestAnimationFrame(() => {
            step.classList.add("is-entering");
            const legend = step.querySelector("legend");
            legend.setAttribute("tabindex", "-1");
            legend.focus({ preventScroll: false });
          });
        }
      });

      if (stepCount) stepCount.textContent = `Step ${currentStep + 1} of ${steps.length}`;
      if (stepName) stepName.textContent = STEP_NAMES[currentStep];
      if (progress) progress.setAttribute("aria-valuenow", String(currentStep + 1));
      if (progressFill) progressFill.className = `sb-progress-fill sb-progress-fill-${currentStep + 1}`;

      jumpButtons.forEach((button, buttonIndex) => {
        button.disabled = buttonIndex > furthestStep;
        if (buttonIndex === currentStep) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      });
      hideErrorBox();
    }

    function validateStep(index, showErrors) {
      const step = steps[index];
      if (!step) return true;
      clearStepErrors(step);

      let firstInvalid = null;
      let message = "Complete all required choices in this step.";

      step.querySelectorAll("[data-required-group]").forEach((group) => {
        const name = group.dataset.requiredGroup;
        const checked = group.querySelectorAll(`input[name="${name}"]:checked`).length;
        if (checked > 0) return;
        group.classList.add("has-error");
        const groupError = group.querySelector(`[data-group-error="${name}"]`);
        if (showErrors && groupError) groupError.hidden = false;
        if (!firstInvalid) {
          firstInvalid = group.querySelector(`input[name="${name}"]`);
          message = groupError ? groupError.textContent : message;
        }
      });

      if (index === 1) {
        const data = readForm(form);
        const webSelected = data.surfaces.some((value) => value === "web" || value === "admin");
        const apiSelected = data.surfaces.some((value) => value === "rest" || value === "graphql" || value === "mobile");
        const webSelect = form.elements.web_app_count;
        const apiSelect = form.elements.api_group_count;

        if (webSelected && data.web_app_count === "0") {
          webSelect.setCustomValidity("Select at least one web application when a web or admin surface is in scope.");
        } else if (!webSelected && data.web_app_count && data.web_app_count !== "0") {
          webSelect.setCustomValidity("Add a web or admin surface, or set web applications to None.");
        }

        if (apiSelected && data.api_group_count === "0") {
          apiSelect.setCustomValidity("Select at least one API group when an API surface is in scope.");
        } else if (!apiSelected && data.api_group_count && data.api_group_count !== "0") {
          apiSelect.setCustomValidity("Add an API surface, or set API groups to None.");
        }
      }

      Array.from(step.elements).forEach((input) => {
        if (input.disabled || input.type === "button") return;
        if (!input.checkValidity()) {
          input.setAttribute("aria-invalid", "true");
          if (showErrors) showFieldError(step, input);
          if (!firstInvalid) {
            firstInvalid = input;
            message = getFieldErrorMessage(input) || message;
          }
        }
      });

      if (!firstInvalid) {
        hideErrorBox();
        return true;
      }

      if (showErrors) {
        showErrorBox(message);
        if (liveMessage) liveMessage.textContent = `Complete the highlighted field before continuing. ${message}`;
        firstInvalid.focus();
      }
      return false;
    }

    function firstInvalidStep() {
      for (let index = 0; index < steps.length; index += 1) {
        if (!validateStep(index, false)) return index;
      }
      return -1;
    }

    function clearStepErrors(step) {
      step.querySelectorAll("[aria-invalid='true']").forEach((input) => input.removeAttribute("aria-invalid"));
      step.querySelectorAll("select").forEach((select) => select.setCustomValidity(""));
      step.querySelectorAll(".has-error").forEach((group) => group.classList.remove("has-error"));
      step.querySelectorAll("[data-group-error]").forEach((node) => { node.hidden = true; });
      step.querySelectorAll("[data-field-error]").forEach((node) => { node.hidden = true; });
    }

    function clearAllErrors() {
      steps.forEach(clearStepErrors);
      hideErrorBox();
    }

    function clearFieldError(target) {
      if (!target || !target.name) return;
      form.querySelectorAll(`[name="${target.name}"]`).forEach((input) => input.removeAttribute("aria-invalid"));
      if (target.setCustomValidity) target.setCustomValidity("");
      const group = target.closest("[data-required-group]");
      if (group) {
        group.classList.remove("has-error");
        const groupError = group.querySelector("[data-group-error]");
        if (groupError) groupError.hidden = true;
      }
      const step = target.closest("[data-step]");
      if (step) {
        const fieldError = step.querySelector(`[data-field-error="${target.name}"]`);
        if (fieldError) fieldError.hidden = true;
      }
      hideErrorBox();
    }

    function showFieldError(step, input) {
      if (!input.name) return;
      const fieldError = step.querySelector(`[data-field-error="${input.name}"]`);
      if (!fieldError) return;
      fieldError.textContent = getFieldErrorMessage(input) || "Complete this field.";
      fieldError.hidden = false;
    }

    function getFieldErrorMessage(input) {
      if (input.validity && input.validity.customError && input.validationMessage) return input.validationMessage;
      return FIELD_ERRORS[input.name] || input.validationMessage;
    }

    function showErrorBox(message) {
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.hidden = false;
    }

    function hideErrorBox() {
      if (!errorBox) return;
      errorBox.hidden = true;
      errorBox.textContent = "";
    }

    function announce(message, state) {
      if (!liveMessage) return;
      liveMessage.textContent = message;
      if (state === "error") {
        liveMessage.dataset.state = "error";
        liveMessage.setAttribute("role", "alert");
        liveMessage.setAttribute("aria-live", "assertive");
      } else {
        liveMessage.removeAttribute("data-state");
        liveMessage.setAttribute("role", "status");
        liveMessage.setAttribute("aria-live", "polite");
      }
    }

    function invalidateBrief() {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (error) { /* Storage can be unavailable. */ }
      if (!finalized) return;
      finalized = false;
      currentBrief = "";
      currentBriefModel = null;
      if (printBrief) printBrief.textContent = "";
      setFinalActions(false);
      announce("Answers changed. Build the brief again before continuing.");
    }

    function setFinalActions(ready) {
      [copyButton, downloadButton, printButton].forEach((button) => { button.disabled = !ready; });
      if (!ready) printButton.hidden = true;
      contactCta.classList.toggle("is-disabled", !ready);
      contactCta.setAttribute("aria-disabled", String(!ready));
      const resultStatus = document.querySelector("[data-result-status]");
      if (resultStatus) {
        resultStatus.textContent = ready ? "Brief ready" : "Draft";
        resultStatus.classList.toggle("is-ready", ready);
      }
    }

    function updateSummary() {
      const data = readForm(form);
      const result = calculateRecommendation(data);
      currentResult = result;

      setText("[data-package]", result.name);
      setText("[data-result-intro]", result.intro);
      setText("[data-summary='outcome']", label("business_trigger", data.business_trigger, "Not selected"));
      setText("[data-summary='surfaces']", compactList(valuesToLabels("surfaces", data.surfaces), "Not selected"));
      setText("[data-summary='trust']", trustSummary(data));
      setText("[data-summary='window']", result.window);
      setText("[data-summary='price']", result.price);
      setText("[data-rule]", result.rule);
      renderList(document.querySelector("[data-factor-list]"), result.factors);

      const gaps = getReadinessGaps(data);
      const gapList = document.querySelector("[data-gap-list]");
      renderList(gapList, gaps.length ? gaps : ["No preparation gaps selected; validate that each input is current during scope review."]);
      const gapBox = gapList.closest(".sb-gap-box");
      gapBox.classList.toggle("is-clear", gaps.length === 0);
      setText("[data-gap-count]", gaps.length ? `${gaps.length} open` : "Ready to validate");
      renderList(document.querySelector("[data-assumption-list]"), getAssumptions(data));
      updateTopology(data);
    }

    function saveStateSoon() {
      window.clearTimeout(saveTimer);
      savePending = true;
      if (saveStatus) saveStatus.textContent = "Saving locally...";
      saveTimer = window.setTimeout(saveStateNow, 220);
    }

    function saveStateNow() {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          version: SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          step: currentStep,
          furthestStep,
          data: readForm(form),
        }));
        savePending = false;
        if (saveStatus) saveStatus.textContent = `Saved in this browser at ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
        return true;
      } catch (error) {
        if (saveStatus) saveStatus.textContent = "Local save unavailable";
        return false;
      }
    }
  }

  function prepareFieldErrors(form) {
    Object.keys(FIELD_ERRORS).forEach((name) => {
      const inputs = Array.from(form.querySelectorAll(`[name="${name}"]`));
      if (!inputs.length) return;
      const firstInput = inputs[0];
      const errorId = `scope-error-${name.replace(/[^a-z0-9_-]/gi, "-")}`;
      let error = form.querySelector(`[data-field-error="${name}"]`);

      if (!error) {
        error = document.createElement("span");
        error.className = "sb-field-error sb-inline-field-error";
        error.dataset.fieldError = name;
        error.id = errorId;
        error.hidden = true;

        if (firstInput.type === "radio") {
          const question = firstInput.closest(".sb-question");
          if (!question) return;
          question.appendChild(error);
        } else {
          const field = firstInput.closest(".sb-select-field");
          if (!field) return;
          field.appendChild(error);
        }
      }

      inputs.forEach((input) => {
        const describedBy = new Set((input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
        describedBy.add(error.id || errorId);
        input.setAttribute("aria-describedby", Array.from(describedBy).join(" "));
      });
    });
  }

  function readForm(form) {
    const data = {};
    const formData = new FormData(form);
    Array.from(form.elements).forEach((element) => {
      if (!element.name || element.type === "button") return;
      if (ARRAY_FIELDS.includes(element.name)) return;
      if (!(element.name in data)) data[element.name] = formData.get(element.name) || "";
    });
    ARRAY_FIELDS.forEach((name) => { data[name] = formData.getAll(name); });
    return data;
  }

  function restoreState(form) {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!stored || stored.version !== SCHEMA_VERSION || !stored.data) return null;
      Object.entries(stored.data).forEach(([name, value]) => {
        const elements = form.querySelectorAll(`[name="${name}"]`);
        if (!elements.length) return;
        elements.forEach((element) => {
          if (element.type === "checkbox" || element.type === "radio") {
            const values = Array.isArray(value) ? value : [value];
            element.checked = values.includes(element.value);
          } else if (!Array.isArray(value)) {
            element.value = value;
          }
        });
      });
      return stored;
    } catch (error) {
      return null;
    }
  }

  function applyTriggerPrefill(form) {
    const requested = new URLSearchParams(window.location.search).get("trigger");
    const mapping = { enterprise: "enterprise", audit: "audit", release: "release", baseline: "assurance" };
    const value = mapping[requested];
    if (!value) return "";
    const input = form.querySelector(`input[name="business_trigger"][value="${value}"]`);
    if (!input) return "";
    input.checked = true;
    return value;
  }

  function calculateRecommendation(data) {
    const surfaceCount = data.surfaces.length;
    const workflowCount = data.workflows.length;
    const webUnits = countValue(data.web_app_count);
    const apiUnits = countValue(data.api_group_count);
    const totalUnits = webUnits + apiUnits;
    const hasCore = Boolean(
      data.business_trigger &&
      surfaceCount &&
      data.web_app_count &&
      data.api_group_count &&
      data.role_count &&
      data.integration_count &&
      data.tenant_model
    );

    const factors = buildFactors(data);
    if (!hasCore) {
      return {
        key: "pending",
        name: "Start with a few answers",
        intro: "Tell us why you need a test, what it should cover, and who uses your app.",
        window: "Available after your first answers",
        price: "Fixed quote after we review the scope",
        rule: "The suggestion is based on what you need tested. It does not assess your app's security.",
        factors: factors.length ? factors : ["Complete the planner to see the factors affecting effort."],
      };
    }

    const discoveryReasons = [
      data.web_app_count === "4plus",
      data.api_group_count === "4plus",
      data.role_count === "8plus",
      data.integration_count === "6plus" || data.integration_count === "unknown",
      data.tenant_model === "unknown",
      data.environment === "both",
      surfaceCount >= 5,
      data.logic_depth === "extensive" && workflowCount >= 4,
    ];

    if (discoveryReasons.some(Boolean)) {
      return {
        key: "discovery",
        name: "Discovery Required",
        intro: "We need a few more details before we can suggest a fixed test scope.",
        window: "1-2 discovery days; test window confirmed next",
        price: "Discovery first; fixed quote follows",
        rule: "We first need to review the systems, tenants, integrations, or environments that could change the amount of testing needed.",
        factors,
      };
    }

    const focused =
      surfaceCount <= 2 &&
      totalUnits <= 2 &&
      (data.role_count === "1_2" || data.role_count === "3_4") &&
      (data.integration_count === "0" || data.integration_count === "1_2") &&
      (data.tenant_model === "single" || (data.tenant_model === "multi" && workflowCount <= 1 && data.logic_depth === "baseline")) &&
      workflowCount <= 2 &&
      (data.logic_depth !== "extensive") &&
      data.environment !== "both";

    if (focused) {
      return {
        key: "focused",
        name: "Focused Release Check",
        intro: "A focused check looks suitable for the release or workflow you selected.",
        window: "Typically 3-5 testing days",
        price: "Fixed quote after technical scope review",
        rule: "Focused applies only to one tightly bounded path: no more than two surfaces, two deployable units, four roles, two integrations, and two priority workflows.",
        factors,
      };
    }

    return {
      key: "sprint",
      name: "Web & API Sprint",
      intro: "Your apps, APIs, and user roles need to be tested together.",
      window: "Typically 5-10 testing days",
      price: "Fixed quote after technical scope review",
      rule: "A sprint fits bounded products with multiple connected attack surfaces, roles, tenants, integrations, or business-logic paths, but no unresolved enterprise-scale inventory.",
      factors,
    };
  }

  function buildFactors(data) {
    const factors = [];
    if (data.surfaces.length) {
      const units = countValue(data.web_app_count) + countValue(data.api_group_count);
      factors.push(`${data.surfaces.length} selected surface${plural(data.surfaces.length)}${units ? ` across ${formatCount(units)} bounded unit${plural(units)}` : ""}.`);
    }
    if (data.role_count || data.tenant_model) {
      factors.push(`${label("tenant_model", data.tenant_model, "Unconfirmed tenancy")} with ${label("role_count", data.role_count, "role count pending").toLowerCase()}.`);
    }
    if (data.integration_count === "0") {
      factors.push("No third-party integrations selected.");
    } else if (data.integration_count) {
      factors.push(`${label("integration_count", data.integration_count)} third-party integration boundaries.`);
    }
    if (data.workflows.length || data.logic_depth) factors.push(`${data.workflows.length || "No"} priority workflow${plural(data.workflows.length)} at ${label("logic_depth", data.logic_depth, "unselected").toLowerCase()} depth.`);
    if (data.environment) factors.push(`${label("environment", data.environment)} testing environment.`);
    if (data.evidence_deadline) factors.push(`${label("evidence_deadline", data.evidence_deadline)} evidence deadline.`);
    return factors.slice(0, 6);
  }

  function getReadinessGaps(data) {
    const gaps = [];
    const selected = new Set(data.readiness);
    const baseGaps = {
      authorization: "Identify the owner who can sign written authorization and rules of engagement.",
      accounts: data.tenant_model === "multi" || data.tenant_model === "hybrid" ? "Prepare controlled role accounts across at least two test tenants." : "Prepare controlled accounts for every relevant role.",
      docs: data.surfaces.some((value) => value === "rest" || value === "graphql" || value === "mobile") ? "Provide current architecture and API documentation or collections." : "Provide a current architecture and data-flow overview.",
      data: "Seed safe test data so real customer records are unnecessary.",
      contact: "Name technical and urgent-finding escalation contacts.",
      controls: "Confirm rate limits, monitoring, and the allowlisting path.",
    };
    Object.entries(baseGaps).forEach(([key, text]) => { if (!selected.has(key)) gaps.push(text); });
    if (data.safety_window === "unknown") gaps.push("Agree test windows, prohibited actions, stop conditions, and response ownership.");
    if (data.tenant_model === "unknown") gaps.push("Confirm tenant boundaries before fixed-scope testing.");
    if (data.integration_count === "unknown") gaps.push("Inventory integrations and identify sandbox or callback dependencies.");
    if (data.evidence_deadline === "under_2" && selected.size < 5) gaps.push("Resolve readiness gaps before treating the under-two-week deadline as achievable.");
    return gaps;
  }

  function getAssumptions(data) {
    const assumptions = [
      "Written authorization and rules of engagement are agreed before testing.",
      "Testing uses controlled accounts, safe data, and non-destructive techniques.",
      "Critical findings use an agreed escalation path during the test window.",
    ];
    if (data.environment === "staging") assumptions.push("Staging faithfully represents production identity, authorization, and security controls.");
    if (data.environment === "production") assumptions.push("Production testing has explicit windows, monitoring, rate limits, and stop conditions.");
    if (data.environment === "both") assumptions.push("Staging and production validation are treated as distinct environment boundaries.");
    if (data.tenant_model === "multi" || data.tenant_model === "hybrid") assumptions.push("At least two controlled tenants are available for isolation testing.");
    if (data.integration_count && data.integration_count !== "0") assumptions.push("Third-party integrations can use sandboxed or controlled destinations where practical.");
    return assumptions;
  }

  function trustSummary(data) {
    if (!data.tenant_model && !data.role_count) return "Not selected";
    return [label("tenant_model", data.tenant_model, "Tenancy pending"), label("role_count", data.role_count, "Roles pending")].join("  |  ");
  }

  function updateTopology(data) {
    const surfaces = new Set(data.surfaces);
    const active = {
      user: true,
      web: surfaces.has("web") || surfaces.has("admin"),
      api: surfaces.has("rest") || surfaces.has("graphql") || surfaces.has("mobile"),
      identity: data.auth_methods.length > 0,
      tenant: data.tenant_model === "multi" || data.tenant_model === "hybrid",
      integration: data.integration_count !== "" && data.integration_count !== "0",
    };
    document.querySelectorAll("[data-topology-node]").forEach((node) => {
      node.classList.toggle("is-active", Boolean(active[node.dataset.topologyNode]));
    });
    const selectedNodes = Object.entries(active).filter(([, enabled]) => enabled).map(([name]) => name);
    const topology = document.querySelector("[data-topology]");
    topology.setAttribute("aria-label", `Selected scope topology: ${selectedNodes.join(", ")}.`);
  }

  function createBriefModel(data, result) {
    if (!result || result.key === "pending") throw new Error("A complete recommendation is required before building a scope brief.");
    const generatedAt = new Date();

    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAtISO: generatedAt.toISOString(),
      generatedDisplay: generatedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
      status: "Non-binding planning input. Not a quote, authorization, or statement of work.",
      businessOutcome: {
        trigger: label("business_trigger", data.business_trigger),
        evidenceAudience: label("evidence_audience", data.evidence_audience),
        evidenceDeadline: label("evidence_deadline", data.evidence_deadline),
      },
      targetBoundary: {
        surfaces: valuesToLabels("surfaces", data.surfaces),
        webApplicationCount: label("web_app_count", data.web_app_count),
        apiGroupCount: label("api_group_count", data.api_group_count),
        exposure: label("exposure", data.exposure),
      },
      trustModel: {
        roleCount: label("role_count", data.role_count),
        tenantModel: label("tenant_model", data.tenant_model),
        authenticationPaths: valuesToLabels("auth_methods", data.auth_methods),
        integrationCount: label("integration_count", data.integration_count),
      },
      testingPriorities: {
        workflows: valuesToLabels("workflows", data.workflows),
        businessLogicDepth: label("logic_depth", data.logic_depth),
      },
      environmentAndReadiness: {
        environment: label("environment", data.environment),
        safetyWindow: label("safety_window", data.safety_window),
        availableInputs: valuesToLabels("readiness", data.readiness),
      },
      evidenceAndTiming: {
        preferredStart: label("test_start", data.test_start),
        retestWindow: label("retest_window", data.retest_window),
        deliverables: valuesToLabels("deliverables", data.deliverables),
      },
      recommendation: {
        key: result.key,
        name: result.name,
        intro: result.intro,
        indicativeWindow: result.window,
        commercialRoute: result.price,
        rule: result.rule,
        factors: result.factors.length ? result.factors.slice() : ["No effort factors were selected."],
      },
      readinessGaps: getReadinessGaps(data),
      assumptions: getAssumptions(data),
      exclusions: FIXED_EXCLUSIONS.slice(),
      nextValidationStep: NEXT_VALIDATION_STEP,
      securityNote: SECURITY_NOTE,
    };
  }

  function createBrief(model) {
    const list = (items) => items.map((item) => `- ${item}`).join("\n");

    return [
      "BALHENCE: DRAFT PENTEST SCOPE BRIEF",
      `Generated: ${model.generatedDisplay}`,
      `Brief schema: ${model.schemaVersion}`,
      `Status: ${model.status}`,
      "",
      "1. BUSINESS OUTCOME",
      `Primary trigger: ${model.businessOutcome.trigger}`,
      `Evidence audience: ${model.businessOutcome.evidenceAudience}`,
      `Evidence deadline: ${model.businessOutcome.evidenceDeadline}`,
      "",
      "2. TARGET SURFACES",
      list(model.targetBoundary.surfaces),
      `Distinct web applications: ${model.targetBoundary.webApplicationCount}`,
      `Distinct API groups: ${model.targetBoundary.apiGroupCount}`,
      `Exposure: ${model.targetBoundary.exposure}`,
      "",
      "3. TRUST MODEL",
      `User roles: ${model.trustModel.roleCount}`,
      `Tenant model: ${model.trustModel.tenantModel}`,
      `Authentication paths: ${model.trustModel.authenticationPaths.join(", ")}`,
      `Third-party integrations: ${model.trustModel.integrationCount}`,
      "",
      "4. CRITICAL WORKFLOWS",
      list(model.testingPriorities.workflows),
      `Business-logic depth: ${model.testingPriorities.businessLogicDepth}`,
      "",
      "5. ENVIRONMENT AND READINESS",
      `Environment: ${model.environmentAndReadiness.environment}`,
      `Safety window: ${model.environmentAndReadiness.safetyWindow}`,
      "Inputs marked available:",
      model.environmentAndReadiness.availableInputs.length ? list(model.environmentAndReadiness.availableInputs) : "- None marked available",
      "",
      "6. EVIDENCE AND TIMING",
      `Preferred start: ${model.evidenceAndTiming.preferredStart}`,
      `Remediation / re-test window: ${model.evidenceAndTiming.retestWindow}`,
      "Required outputs:",
      list(model.evidenceAndTiming.deliverables),
      "",
      "PLANNING RECOMMENDATION",
      `Engagement path: ${model.recommendation.name}`,
      `Summary: ${model.recommendation.intro}`,
      `Indicative test window: ${model.recommendation.indicativeWindow}`,
      `Commercial next step: ${model.recommendation.commercialRoute}`,
      `Rule: ${model.recommendation.rule}`,
      "Why this path:",
      list(model.recommendation.factors),
      "",
      "READINESS GAPS",
      model.readinessGaps.length ? list(model.readinessGaps) : "- No preparation gaps selected; validate that every input is current during scope review.",
      "",
      "PLANNING ASSUMPTIONS",
      list(model.assumptions),
      "",
      "EXCLUSIONS UNLESS EXPLICITLY AGREED",
      list(model.exclusions),
      "",
      "NEXT VALIDATION STEP",
      model.nextValidationStep,
      "",
      "SECURITY NOTE",
      model.securityNote,
    ].join("\n");
  }

  function renderPrintBrief(container, model) {
    container.replaceChildren();

    const documentRoot = document.createElement("article");
    documentRoot.className = "sb-print-document";

    const addElement = (parent, tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      parent.appendChild(element);
      return element;
    };

    const addRows = (section, rows) => {
      const list = addElement(section, "dl");
      rows.forEach(([term, detail]) => {
        const row = addElement(list, "div");
        addElement(row, "dt", "", term);
        addElement(row, "dd", "", detail);
      });
    };

    const addList = (section, heading, items, emptyText) => {
      addElement(section, "h3", "sb-print-list-heading", heading);
      const list = addElement(section, "ul");
      const values = items.length ? items : [emptyText];
      values.forEach((item) => addElement(list, "li", "", item));
    };

    const addSection = (title, rows, lists) => {
      const section = addElement(documentRoot, "section", "sb-print-section");
      addElement(section, "h2", "", title);
      if (rows && rows.length) addRows(section, rows);
      (lists || []).forEach((item) => addList(section, item.heading, item.items, item.emptyText));
      return section;
    };

    const addNote = (title, body) => {
      const note = addElement(documentRoot, "section", "sb-print-note");
      addElement(note, "h2", "", title);
      addElement(note, "p", "", body);
    };

    const header = addElement(documentRoot, "header", "sb-print-header");
    addElement(header, "p", "sb-print-brand", "Balhence / Draft planning brief");
    addElement(header, "h1", "", "Draft pentest scope brief");
    addElement(header, "p", "", `Generated ${model.generatedDisplay}`);
    addElement(header, "p", "", model.status);

    const recommendation = addElement(documentRoot, "section", "sb-print-recommendation");
    addElement(recommendation, "p", "sb-print-brand", "Planning recommendation");
    addElement(recommendation, "h2", "", model.recommendation.name);
    addElement(recommendation, "p", "", model.recommendation.intro);
    addRows(recommendation, [
      ["Indicative test window", model.recommendation.indicativeWindow],
      ["Commercial next step", model.recommendation.commercialRoute],
      ["Recommendation rule", model.recommendation.rule],
    ]);
    addList(recommendation, "Why this path", model.recommendation.factors, "No effort factors selected");

    addSection("1. Business outcome", [
      ["Primary trigger", model.businessOutcome.trigger],
      ["Evidence audience", model.businessOutcome.evidenceAudience],
      ["Evidence deadline", model.businessOutcome.evidenceDeadline],
    ]);

    addSection("2. Target boundary and trust model", [
      ["Web applications", model.targetBoundary.webApplicationCount],
      ["API groups", model.targetBoundary.apiGroupCount],
      ["Exposure", model.targetBoundary.exposure],
      ["User roles", model.trustModel.roleCount],
      ["Tenant model", model.trustModel.tenantModel],
      ["Integrations", model.trustModel.integrationCount],
    ], [
      { heading: "In-scope surfaces", items: model.targetBoundary.surfaces, emptyText: "None selected" },
      { heading: "Authentication paths", items: model.trustModel.authenticationPaths, emptyText: "None selected" },
    ]);

    addSection("3. Testing and evidence plan", [
      ["Business-logic depth", model.testingPriorities.businessLogicDepth],
      ["Environment", model.environmentAndReadiness.environment],
      ["Safety window", model.environmentAndReadiness.safetyWindow],
      ["Preferred start", model.evidenceAndTiming.preferredStart],
      ["Remediation window", model.evidenceAndTiming.retestWindow],
    ], [
      { heading: "Priority workflows", items: model.testingPriorities.workflows, emptyText: "None selected" },
      { heading: "Inputs marked available", items: model.environmentAndReadiness.availableInputs, emptyText: "None marked available" },
      { heading: "Required outputs", items: model.evidenceAndTiming.deliverables, emptyText: "None selected" },
    ]);

    addSection("4. Readiness actions", [], [
      { heading: "Open prerequisites", items: model.readinessGaps, emptyText: "No preparation gaps selected; validate every input during scope review." },
    ]);
    addSection("5. Planning guardrails", [], [
      { heading: "Assumptions", items: model.assumptions, emptyText: "None" },
      { heading: "Exclusions", items: model.exclusions, emptyText: "None" },
    ]);
    addNote("Next validation step", model.nextValidationStep);
    addNote("Security note", model.securityNote);

    container.appendChild(documentRoot);
  }

  function persistSessionBrief(brief, result) {
    try {
      const createdAt = new Date();
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        version: SCHEMA_VERSION,
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        source: "scope-builder",
        recommendation: result.name,
        indicativeWindow: result.window,
        brief,
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeStoredBriefs() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* Storage can be unavailable. */ }
    try { sessionStorage.removeItem(SESSION_KEY); } catch (error) { /* Storage can be unavailable. */ }
  }

  async function copyText(text) {
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        /* Continue to the HTTP-compatible fallback. */
      }
    }

    const buffer = document.createElement("textarea");
    buffer.className = "sb-copy-buffer";
    buffer.value = text;
    buffer.setAttribute("readonly", "");
    document.body.appendChild(buffer);
    buffer.select();
    buffer.setSelectionRange(0, buffer.value.length);
    let copied = false;
    try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
    buffer.remove();
    return copied;
  }

  function valuesToLabels(field, values) {
    return (values || []).map((value) => label(field, value)).filter(Boolean);
  }

  function label(field, value, fallback) {
    if (value === undefined || value === null || value === "") return fallback || "Not selected";
    return (LABELS[field] && LABELS[field][value]) || String(value);
  }

  function compactList(items, fallback) {
    if (!items.length) return fallback;
    if (items.length <= 3) return items.join(", ");
    return `${items.slice(0, 2).join(", ")} + ${items.length - 2} more`;
  }

  function countValue(value) {
    if (value === "4plus") return 4;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatCount(value) {
    return value >= 8 ? "8+" : String(value);
  }

  function plural(count) {
    return count === 1 ? "" : "s";
  }

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(Math.max(number, min), max);
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function renderList(container, items) {
    if (!container) return;
    container.replaceChildren();
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      container.appendChild(li);
    });
  }

  function track(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  }
})();
