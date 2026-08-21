(function () {
  "use strict";

  const consoleRoot = document.querySelector("[data-report-console]");
  if (!consoleRoot) return;

  const tabs = Array.from(consoleRoot.querySelectorAll("[data-report-tab]"));
  const panels = Array.from(consoleRoot.querySelectorAll("[data-report-panel]"));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const validViews = new Set(tabs.map((tab) => tab.dataset.reportTab));

  function track(contentId) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "select_content", {
      content_type: "sample_report_view",
      content_id: contentId,
    });
  }

  function activate(view, options) {
    const settings = Object.assign({ focus: false, updateUrl: true }, options);
    if (!validViews.has(view)) return;

    tabs.forEach((tab) => {
      const active = tab.dataset.reportTab === view;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && settings.focus) tab.focus();
    });

    panels.forEach((panel) => {
      const active = panel.dataset.reportPanel === view;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
      panel.classList.remove("is-entering");
      if (active && !reducedMotion) {
        window.requestAnimationFrame(() => panel.classList.add("is-entering"));
      }
    });

    if (settings.updateUrl && window.history && window.history.replaceState) {
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = view;
      window.history.replaceState({}, "", nextUrl);
    }
    track(view);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab.dataset.reportTab));
    tab.addEventListener("keydown", (event) => {
      let nextIndex = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      activate(tabs[nextIndex].dataset.reportTab, { focus: true });
    });
  });

  const initialView = window.location.hash.slice(1);
  activate(validViews.has(initialView) ? initialView : "executive", { updateUrl: false });

  const copyButton = consoleRoot.querySelector("[data-copy-evidence]");
  const evidenceNode = consoleRoot.querySelector("[data-evidence-text]");
  const copyStatus = consoleRoot.querySelector("[data-copy-status]");

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied) throw new Error("Copy command unavailable");
  }

  if (copyButton && evidenceNode && copyStatus) {
    copyButton.addEventListener("click", async () => {
      const originalLabel = copyButton.textContent;
      try {
        await copyText(evidenceNode.textContent.trim());
        copyButton.textContent = "Copied";
        copyStatus.textContent = "Synthetic request copied to the clipboard.";
        track("copy_synthetic_request");
      } catch (error) {
        copyStatus.textContent = "Copy is unavailable in this browser. Select the request text manually.";
      }
      window.setTimeout(() => {
        copyButton.textContent = originalLabel;
      }, 1800);
    });
  }
})();
