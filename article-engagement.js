(function () {
  "use strict";

  const ready = (callback) => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", callback, { once: true });
    else callback();
  };

  function validConfiguration(value) {
    if (!value || value.provider !== "giscus") return null;
    const repo = typeof value.repo === "string" ? value.repo.trim() : "";
    const repoId = typeof value.repoId === "string" ? value.repoId.trim() : "";
    const category = typeof value.category === "string" ? value.category.trim() : "";
    const categoryId = typeof value.categoryId === "string" ? value.categoryId.trim() : "";
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return null;
    if (!repoId || !category || !categoryId) return null;
    return { repo, repoId, category, categoryId };
  }

  function canonicalTerm() {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) return null;
    try {
      const url = new URL(canonical.href, window.location.href);
      if (!/^https?:$/.test(url.protocol) || !url.pathname.startsWith("/")) return null;
      let path = url.pathname === "/index.html" ? "/" : url.pathname.replace(/\.html$/, "");
      if (path.length > 1) path = path.replace(/\/$/, "");
      return path;
    } catch (error) {
      return null;
    }
  }

  ready(() => {
    if (!document.querySelector('meta[property="og:type"][content="article"]')) return;
    const article = document.querySelector(".article-content");
    if (!article || article.querySelector("[data-article-engagement]")) return;

    const configured = window.BALHENCE_CONFIG && window.BALHENCE_CONFIG.engagement;
    const settings = validConfiguration(configured);
    const term = canonicalTerm();
    if (!settings || !term) return;

    const section = document.createElement("section");
    section.className = "article-engagement";
    section.dataset.articleEngagement = "";
    section.setAttribute("aria-labelledby", "article-engagement-title");

    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Discuss the research";
    const title = document.createElement("h2");
    title.id = "article-engagement-title";
    title.textContent = "Reactions and comments";
    const copy = document.createElement("p");
    copy.append(document.createTextNode("Comments and reactions are hosted publicly on GitHub Discussions. Nothing is loaded until you choose to continue. A GitHub account is required to participate. Read the "));
    const privacy = document.createElement("a");
    privacy.href = "/privacy#article-discussions";
    privacy.textContent = "privacy details";
    copy.append(privacy, document.createTextNode("."));

    const button = document.createElement("button");
    button.className = "btn btn-secondary";
    button.type = "button";
    button.textContent = "Load reactions and comments";
    const status = document.createElement("p");
    status.className = "article-engagement-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const frame = document.createElement("div");
    frame.className = "giscus article-engagement-frame";

    button.addEventListener("click", () => {
      if (section.dataset.loaded === "true") return;
      section.dataset.loaded = "true";
      button.disabled = true;
      button.textContent = "Loading...";
      status.textContent = "Connecting to GitHub Discussions.";

      const script = document.createElement("script");
      script.src = "https://giscus.app/client.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.repo = settings.repo;
      script.dataset.repoId = settings.repoId;
      script.dataset.category = settings.category;
      script.dataset.categoryId = settings.categoryId;
      script.dataset.mapping = "specific";
      script.dataset.term = term;
      script.dataset.strict = "1";
      script.dataset.reactionsEnabled = "1";
      script.dataset.emitMetadata = "0";
      script.dataset.inputPosition = "bottom";
      script.dataset.theme = "preferred_color_scheme";
      script.dataset.lang = "en";
      script.dataset.loading = "lazy";
      script.addEventListener("load", () => {
        button.remove();
        status.textContent = "GitHub Discussions loaded.";
      }, { once: true });
      script.addEventListener("error", () => {
        section.dataset.loaded = "false";
        button.disabled = false;
        button.textContent = "Try loading comments again";
        status.textContent = "Comments could not be loaded. You can retry without losing your place.";
        script.remove();
      }, { once: true });
      frame.appendChild(script);
    });

    section.append(eyebrow, title, copy, button, status, frame);
    const share = article.querySelector("[data-article-share]");
    if (share) share.insertAdjacentElement("afterend", section);
    else article.appendChild(section);
  });
})();
