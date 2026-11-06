/* Progressive local filtering. The complete collection is readable without JS. */
(function () {
  "use strict";

  const controls = document.querySelector("[data-archive-controls]");
  const search = document.querySelector("[data-archive-search]");
  const count = document.querySelector("[data-archive-count]");
  const empty = document.querySelector("[data-archive-empty]");
  const reset = document.querySelector("[data-archive-reset]");
  const buttons = Array.from(document.querySelectorAll("[data-archive-filter]"));
  const cards = Array.from(document.querySelectorAll("[data-archive-card]"));
  if (!controls || !search || !count || !empty || !reset || !cards.length) return;

  const index = cards.map(function (card) {
    return { element: card, topic: card.dataset.topic, text: card.textContent.toLowerCase() };
  });
  let topic = "all";

  function update() {
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;

    index.forEach(function (item) {
      const matches = (topic === "all" || item.topic === topic) && terms.every(function (term) {
        return item.text.includes(term);
      });
      item.element.hidden = !matches;
      if (matches) visible += 1;
    });

    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.archiveFilter === topic));
    });
    count.textContent = "Showing " + visible + " " + (visible === 1 ? "article" : "articles");
    empty.hidden = visible !== 0;
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      topic = button.dataset.archiveFilter;
      update();
    });
  });
  search.addEventListener("input", update);
  reset.addEventListener("click", function () {
    topic = "all";
    search.value = "";
    update();
    search.focus();
  });

  update();
  controls.hidden = false;
})();
