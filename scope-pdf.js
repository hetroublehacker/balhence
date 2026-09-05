(function () {
  "use strict";

  const PAGE = Object.freeze({ width: 210, height: 297, margin: 16, contentBottom: 276 });
  const COLORS = Object.freeze({
    night: [8, 13, 31],
    nightTwo: [18, 20, 52],
    ink: [17, 24, 43],
    inkSoft: [42, 53, 76],
    muted: [93, 107, 130],
    line: [222, 224, 239],
    lineDark: [69, 67, 108],
    paper: [248, 248, 252],
    paperDeep: [241, 240, 249],
    white: [255, 255, 255],
    violet: [155, 140, 255],
    indigo: [116, 87, 232],
    cyan: [103, 212, 255],
    teal: [94, 234, 212],
    warningPaper: [255, 247, 231],
    warningInk: [111, 72, 18],
  });

  function cleanText(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[\u201c\u201d]/g, "\"")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\u2026/g, "...")
      .replace(/\u00b7/g, "|")
      .replace(/\u00a0/g, " ")
      .replace(/[^\x20-\x7e]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function safeList(value, fallback) {
    const items = Array.isArray(value) ? value.map(cleanText).filter(Boolean) : [];
    return items.length ? items : [fallback || "None selected"];
  }

  function validateModel(model) {
    if (!model || typeof model !== "object") throw new Error("Scope brief data is missing.");
    if (!model.recommendation || model.recommendation.key === "pending") throw new Error("The scope recommendation is incomplete.");
    if (!model.businessOutcome || !model.targetBoundary || !model.trustModel) throw new Error("The scope boundary is incomplete.");
  }

  function buildPdf(model) {
    validateModel(model);
    const JsPdf = window.jspdf && window.jspdf.jsPDF;
    if (typeof JsPdf !== "function") throw new Error("The local PDF library did not load.");

    const doc = new JsPdf({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
      putOnlyUsedFonts: true,
    });

    const left = PAGE.margin;
    const right = PAGE.width - PAGE.margin;
    const contentWidth = right - left;
    let cursorY = 0;
    let continuationTitle = "Scope brief";

    doc.setProperties({
      title: "Balhence Draft Pentest Scope Brief",
      subject: "Non-binding web and API penetration testing scope planning brief",
      author: "Balhence",
      keywords: "Balhence, penetration testing, web security, API security, scope planning",
      creator: "Balhence Scope Planner",
    });
    if (typeof doc.setCreationDate === "function") {
      const created = new Date(model.generatedAtISO);
      if (!Number.isNaN(created.getTime())) doc.setCreationDate(created);
    }
    if (typeof doc.setLanguage === "function") doc.setLanguage("en");
    if (typeof doc.viewerPreferences === "function") doc.viewerPreferences({ DisplayDocTitle: true, FitWindow: true });

    function setFill(color) {
      doc.setFillColor(color[0], color[1], color[2]);
    }

    function setStroke(color) {
      doc.setDrawColor(color[0], color[1], color[2]);
    }

    function setText(color) {
      doc.setTextColor(color[0], color[1], color[2]);
    }

    function setType(size, weight, color) {
      doc.setFont("helvetica", weight === "bold" ? "bold" : "normal");
      doc.setFontSize(size);
      setText(color || COLORS.ink);
    }

    function drawBrandRule(x, y, width, height) {
      setFill(COLORS.violet);
      doc.rect(x, y, width, height, "F");
    }

    function wrap(value, width, size, weight) {
      setType(size || 9, weight || "normal", COLORS.ink);
      return doc.splitTextToSize(cleanText(value), width);
    }

    function drawLines(lines, x, y, options) {
      const settings = options || {};
      const size = settings.size || 9;
      const lineHeight = settings.lineHeight || size * 0.42;
      setType(size, settings.weight || "normal", settings.color || COLORS.ink);
      doc.text(lines, x, y, { lineHeightFactor: lineHeight / (size * 0.3528) });
      return y + lines.length * lineHeight;
    }

    function drawWrapped(value, x, y, width, options) {
      const settings = options || {};
      const lines = wrap(value, width, settings.size || 9, settings.weight || "normal");
      return drawLines(lines, x, y, settings);
    }

    function drawBrandMark(x, y, darkSurface) {
      setFill(COLORS.violet);
      doc.roundedRect(x, y, 11, 11, 2, 2, "F");
      setType(11.2, "bold", COLORS.night);
      doc.text("B/", x + 5.5, y + 5.5, { align: "center", baseline: "middle" });
      setType(10, "bold", darkSurface ? COLORS.white : COLORS.ink);
      doc.text("Balhence", x + 15, y + 7.3);
    }

    function drawContentHeader(kicker, title, description) {
      setFill(COLORS.night);
      doc.rect(0, 0, PAGE.width, 33, "F");
      drawBrandRule(0, 0, PAGE.width, 2.2);
      drawBrandMark(left, 10, true);
      setType(7.2, "bold", COLORS.teal);
      doc.text(cleanText(kicker).toUpperCase(), right, 12, { align: "right" });
      setType(15, "bold", COLORS.white);
      doc.text(cleanText(title), right, 21, { align: "right" });
      setType(8, "normal", [174, 188, 210]);
      doc.text(cleanText(description), right, 27, { align: "right" });
      cursorY = 45;
      continuationTitle = cleanText(title);
    }

    function addContentPage(kicker, title, description) {
      doc.addPage("a4", "portrait");
      drawContentHeader(kicker, title, description);
    }

    function ensureSpace(height) {
      if (cursorY + height <= PAGE.contentBottom) return;
      addContentPage("CONTINUED", continuationTitle, "Draft planning details continued");
    }

    function drawSectionTitle(number, title, description) {
      const descriptionLines = description ? wrap(description, contentWidth - 9, 8, "normal") : [];
      const height = 13 + descriptionLines.length * 3.8;
      ensureSpace(height + 8);
      setFill(COLORS.violet);
      doc.roundedRect(left, cursorY - 3.3, 6.5, 6.5, 1.4, 1.4, "F");
      setType(6.4, "bold", COLORS.night);
      doc.text(cleanText(number), left + 3.25, cursorY + 1.1, { align: "center" });
      setType(12.5, "bold", COLORS.ink);
      doc.text(cleanText(title), left + 10, cursorY + 1.2);
      cursorY += 7;
      if (descriptionLines.length) {
        cursorY = drawLines(descriptionLines, left + 10, cursorY, { size: 8, lineHeight: 3.8, color: COLORS.muted });
      }
      cursorY += 3;
    }

    function drawRows(rows) {
      rows.forEach((row) => {
        const labelText = cleanText(row[0]).toUpperCase();
        const valueLines = wrap(row[1], contentWidth - 52, 8.8, "normal");
        const rowHeight = Math.max(9.4, valueLines.length * 4 + 4.5);
        ensureSpace(rowHeight);
        setStroke(COLORS.line);
        doc.setLineWidth(0.25);
        doc.line(left, cursorY, right, cursorY);
        setType(7, "bold", COLORS.muted);
        doc.text(labelText, left, cursorY + 5.3);
        drawLines(valueLines, left + 52, cursorY + 5.3, { size: 8.8, lineHeight: 4, color: COLORS.inkSoft });
        cursorY += rowHeight;
      });
      cursorY += 4;
    }

    function drawList(label, items, options) {
      const settings = options || {};
      const normalized = safeList(items, settings.empty || "None selected");
      ensureSpace(12);
      setType(7, "bold", settings.labelColor || COLORS.muted);
      doc.text(cleanText(label).toUpperCase(), left, cursorY + 2);
      cursorY += 6;

      normalized.forEach((item, index) => {
        const lines = wrap(item, contentWidth - 9, settings.size || 8.6, "normal");
        const lineHeight = settings.lineHeight || 4.25;
        const itemHeight = Math.max(6.2, lines.length * lineHeight + 1.2);
        ensureSpace(itemHeight);
        setFill(settings.dotColor || (index % 2 === 0 ? COLORS.indigo : COLORS.teal));
        doc.circle(left + 1.8, cursorY + 1.7, 0.9, "F");
        drawLines(lines, left + 6, cursorY + 2.8, {
          size: settings.size || 8.6,
          lineHeight,
          color: settings.color || COLORS.inkSoft,
        });
        cursorY += itemHeight;
      });
      cursorY += 4;
    }

    function drawCallout(title, body, tone) {
      const warning = tone === "warning";
      const background = warning ? COLORS.warningPaper : COLORS.paperDeep;
      const headingColor = warning ? COLORS.warningInk : COLORS.ink;
      const bodyLines = wrap(body, contentWidth - 14, 8.2, "normal");
      const height = 15 + bodyLines.length * 4.1;
      ensureSpace(height);
      setFill(background);
      doc.roundedRect(left, cursorY, contentWidth, height, 3, 3, "F");
      setFill(warning ? [255, 197, 110] : COLORS.teal);
      doc.roundedRect(left + 5, cursorY + 5, 3, height - 10, 1.2, 1.2, "F");
      setType(8, "bold", headingColor);
      doc.text(cleanText(title), left + 12, cursorY + 8);
      drawLines(bodyLines, left + 12, cursorY + 13, { size: 8.2, lineHeight: 4.1, color: warning ? COLORS.warningInk : COLORS.muted });
      cursorY += height + 4;
    }

    function drawCover() {
      setFill(COLORS.paper);
      doc.rect(0, 0, PAGE.width, PAGE.height, "F");
      setFill(COLORS.night);
      doc.rect(0, 0, PAGE.width, 92, "F");
      drawBrandRule(0, 0, PAGE.width, 3);
      drawBrandMark(left, 16, true);

      setType(7, "bold", COLORS.teal);
      doc.text("DRAFT PLANNING BRIEF", left, 44);
      setType(28, "bold", COLORS.white);
      doc.text("Pentest scope brief", left, 58);
      drawWrapped("A bounded starting point for a web and API penetration test.", left, 70, 146, {
        size: 11,
        lineHeight: 5.2,
        color: [178, 190, 211],
      });
      setType(6.6, "bold", [131, 148, 176]);
      doc.text("GENERATED", right, 43, { align: "right" });
      setType(8.6, "normal", COLORS.white);
      doc.text(cleanText(model.generatedDisplay), right, 50, { align: "right" });

      setFill(COLORS.warningPaper);
      doc.roundedRect(left, 101, contentWidth, 19, 3, 3, "F");
      setFill([255, 197, 110]);
      doc.roundedRect(left + 5, 106, 22, 8, 2, 2, "F");
      setType(6.2, "bold", COLORS.warningInk);
      doc.text("NON-BINDING", left + 16, 111.2, { align: "center" });
      drawWrapped(model.status, left + 33, 108.3, contentWidth - 39, {
        size: 7.7,
        lineHeight: 3.7,
        color: COLORS.warningInk,
      });

      setFill(COLORS.nightTwo);
      doc.roundedRect(left, 130, contentWidth, 74, 5, 5, "F");
      drawBrandRule(left + 8, 136, 44, 0.9);
      setType(6.7, "bold", COLORS.teal);
      doc.text("PLANNING RECOMMENDATION", left + 8, 142);
      setType(20, "bold", COLORS.white);
      doc.text(cleanText(model.recommendation.name), left + 8, 153);
      drawWrapped(model.recommendation.intro, left + 8, 162, contentWidth - 16, {
        size: 8.7,
        lineHeight: 4.2,
        color: [184, 198, 220],
      });

      setStroke(COLORS.lineDark);
      doc.setLineWidth(0.3);
      doc.line(left + 8, 175, right - 8, 175);
      setType(6.2, "bold", [126, 145, 174]);
      doc.text("INDICATIVE TEST WINDOW", left + 8, 182);
      doc.text("COMMERCIAL NEXT STEP", left + 96, 182);
      drawWrapped(model.recommendation.indicativeWindow, left + 8, 189, 78, {
        size: 8.3,
        lineHeight: 3.8,
        weight: "bold",
        color: COLORS.white,
      });
      drawWrapped(model.recommendation.commercialRoute, left + 96, 189, 78, {
        size: 8.3,
        lineHeight: 3.8,
        weight: "bold",
        color: COLORS.white,
      });

      setType(6.5, "bold", COLORS.muted);
      doc.text("RECOMMENDATION RULE", left, 213);
      cursorY = drawWrapped(model.recommendation.rule, left, 219, contentWidth, {
        size: 7.4,
        lineHeight: 3.5,
        color: COLORS.inkSoft,
      }) + 3;
      setType(6.5, "bold", COLORS.muted);
      doc.text("WHY THIS PATH", left, cursorY);
      cursorY += 5;
      safeList(model.recommendation.factors, "No effort factors selected").forEach((factor, index) => {
        const lines = wrap(factor, contentWidth - 8, 7.6, "normal");
        const height = Math.max(5.5, lines.length * 3.6 + 0.8);
        setFill(index % 2 === 0 ? COLORS.indigo : COLORS.teal);
        doc.circle(left + 1.7, cursorY + 1.1, 0.75, "F");
        drawLines(lines, left + 5.5, cursorY + 2.1, { size: 7.6, lineHeight: 3.6, color: COLORS.inkSoft });
        cursorY += height;
      });
      setType(6.6, "normal", COLORS.muted);
      doc.text("Scope remains subject to asset validation and signed rules of engagement.", left, 274);
    }

    drawCover();

    addContentPage("01 / SCOPE BOUNDARY", "Business objective and target boundary", "What is being tested and which trust boundaries must hold");
    drawSectionTitle("01", "Business outcome", "The decision this assessment needs to support.");
    drawRows([
      ["Primary trigger", model.businessOutcome.trigger],
      ["Evidence audience", model.businessOutcome.evidenceAudience],
      ["Evidence deadline", model.businessOutcome.evidenceDeadline],
    ]);
    drawSectionTitle("02", "Target surfaces", "The deployable boundary, counts, and exposure model.");
    drawList("In-scope surfaces", model.targetBoundary.surfaces);
    drawRows([
      ["Web applications", model.targetBoundary.webApplicationCount],
      ["API groups", model.targetBoundary.apiGroupCount],
      ["Exposure", model.targetBoundary.exposure],
    ]);
    drawSectionTitle("03", "Trust model", "Roles, tenancy, authentication, and integration boundaries.");
    drawRows([
      ["User roles", model.trustModel.roleCount],
      ["Tenant model", model.trustModel.tenantModel],
      ["Integrations", model.trustModel.integrationCount],
    ]);
    drawList("Authentication paths", model.trustModel.authenticationPaths);

    addContentPage("02 / TEST PLAN", "Testing and evidence plan", "Priority abuse paths, operating conditions, and expected outputs");
    drawSectionTitle("04", "Critical workflows", "Where manual business-logic testing should go deepest.");
    drawList("Priority abuse paths", model.testingPriorities.workflows);
    drawRows([["Business-logic depth", model.testingPriorities.businessLogicDepth]]);
    drawSectionTitle("05", "Environment and readiness", "The safety context and inputs already available.");
    drawRows([
      ["Environment", model.environmentAndReadiness.environment],
      ["Safety window", model.environmentAndReadiness.safetyWindow],
    ]);
    drawList("Inputs marked available", model.environmentAndReadiness.availableInputs, { empty: "None marked available" });
    drawSectionTitle("06", "Evidence and timing", "The target calendar and decision-ready deliverables.");
    drawRows([
      ["Preferred start", model.evidenceAndTiming.preferredStart],
      ["Remediation window", model.evidenceAndTiming.retestWindow],
    ]);
    drawList("Required outputs", model.evidenceAndTiming.deliverables);

    addContentPage("03 / READINESS", "Readiness actions and guardrails", "What must be resolved before a signed testing window begins");
    drawCallout(
      model.readinessGaps.length ? `${model.readinessGaps.length} readiness action${model.readinessGaps.length === 1 ? "" : "s"} open` : "Readiness inputs selected",
      model.readinessGaps.length ? "Resolve these items during scope review before relying on the indicative test window." : "Validate that every selected input is current before the statement of work is issued.",
      model.readinessGaps.length ? "warning" : "default"
    );
    drawSectionTitle("07", "Readiness action plan", "Open prerequisites that affect safety, access, or scheduling.");
    drawList("Actions", model.readinessGaps, { empty: "No preparation gaps selected; validate every input during scope review." });
    drawSectionTitle("08", "Planning assumptions", "Conditions used to produce this draft recommendation.");
    drawList("Assumptions", model.assumptions);
    const extendedGovernancePage = model.readinessGaps.length > 6;
    if (extendedGovernancePage) {
      addContentPage("04 / GOVERNANCE", "Scope guardrails and next step", "Exclusions, decision checkpoint, and the path to a signed engagement");
    }
    drawSectionTitle("09", "Exclusions", "Always excluded unless separately authorized and agreed in writing.");
    drawList("Outside this draft", model.exclusions);
    if (extendedGovernancePage) {
      drawSectionTitle("10", "Decision checkpoint", "The planning result to validate during a short technical scope review.");
      drawRows([
        ["Engagement path", model.recommendation.name],
        ["Indicative test window", model.recommendation.indicativeWindow],
        ["Commercial next step", model.recommendation.commercialRoute],
      ]);
    }
    drawCallout("Next validation step", model.nextValidationStep, "default");
    drawCallout("Security note", model.securityNote, "warning");

    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      doc.setPage(pageNumber);
      setStroke(COLORS.line);
      doc.setLineWidth(0.25);
      doc.line(left, 283, right, 283);
      setType(7, "normal", COLORS.muted);
      doc.text("Draft planning brief | Not authorization", left, 289);
      doc.text("balhence.com | contact@balhence.com", PAGE.width / 2, 289, { align: "center" });
      doc.text(`Page ${pageNumber} of ${pageCount}`, right, 289, { align: "right" });
    }

    return doc;
  }

  function create(model) {
    const doc = buildPdf(model);
    const bytes = doc.output("arraybuffer");
    return new Blob([bytes], { type: "application/pdf" });
  }

  function dateStamp(model) {
    const parsed = new Date(model.generatedAtISO);
    const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function download(model) {
    const blob = create(model);
    const filename = `balhence-draft-pentest-scope-${dateStamp(model)}.pdf`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { blob, filename };
  }

  window.BalhenceScopePdf = Object.freeze({ create, download });
})();
