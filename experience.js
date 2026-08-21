(function () {
  "use strict";

  const processSection = document.querySelector("[data-process-experience]");
  const reportSection = document.querySelector("[data-report-story]");
  if (!processSection || !reportSection) return;

  const EXPERIENCE_QUERY = "(min-width: 1024px) and (min-height: 680px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (update: fast)";
  const experienceMedia = window.matchMedia(EXPERIENCE_QUERY);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const libraryIntegrity = Object.freeze({
    gsap: "sha384-XmJ9SoHtVOHoQUcKvFAzVXwdkKo1Ie3bhmSoIAkcdsHGaIrVJIkmozyq0FJeb/Ly",
    scrollTrigger: "sha384-wl5TeDVvOWt30Pbf8aSo2ZrzsOjddu3avOBvHe+p+OhJt9gP6w9YXmDkN5DK2/dF",
  });
  const stages = Object.freeze([
    Object.freeze({ index: "01", title: "Scope boundary", detail: "Assets, roles, environments, and limits", status: "Boundary mapped" }),
    Object.freeze({ index: "02", title: "Authorization", detail: "Rules, windows, contacts, and stop conditions", status: "Rules locked" }),
    Object.freeze({ index: "03", title: "Manual validation", detail: "A controlled exploit path becomes reproducible evidence", status: "Path verified" }),
    Object.freeze({ index: "04", title: "Verified closure", detail: "Fix guidance, walkthrough, and a bounded re-test", status: "Closure tracked" }),
  ]);

  let proximityObserver = null;
  let librariesPromise = null;
  let gsapMedia = null;
  let hasEnteredLoadRange = false;
  let idleHandle = 0;
  let webgl2Support;

  function capabilityAllowed() {
    if (!experienceMedia.matches) return false;
    if (connection && connection.saveData) return false;
    if (Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory < 4) return false;
    if (Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency < 4) return false;
    return supportsWebGL2();
  }

  function supportsWebGL2() {
    if (typeof webgl2Support === "boolean") return webgl2Support;
    try {
      const testCanvas = document.createElement("canvas");
      const context = testCanvas.getContext("webgl2", { antialias: false, powerPreference: "low-power" });
      if (!context) {
        webgl2Support = false;
        return webgl2Support;
      }
      const loseContext = context.getExtension("WEBGL_lose_context");
      if (loseContext) loseContext.loseContext();
      webgl2Support = true;
      return webgl2Support;
    } catch (error) {
      webgl2Support = false;
      return webgl2Support;
    }
  }

  function loadClassicScript(source, integrity, readyCheck) {
    if (readyCheck()) return Promise.resolve();
    const existing = document.querySelector(`script[data-experience-library="${source}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.integrity = integrity;
      script.crossOrigin = "anonymous";
      script.dataset.experienceLibrary = source;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error(`Could not load ${source}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  function loadLibraries() {
    if (librariesPromise) return librariesPromise;
    librariesPromise = Promise.all([
      import("/vendor/three-experience-0.185.1.module.min.js"),
      loadClassicScript("/vendor/gsap-3.15.0.min.js", libraryIntegrity.gsap, () => Boolean(window.gsap))
        .then(() => loadClassicScript(
          "/vendor/ScrollTrigger-3.15.0.min.js",
          libraryIntegrity.scrollTrigger,
          () => Boolean(window.ScrollTrigger)
        )),
    ]).then(([THREE]) => {
      if (!window.gsap || !window.ScrollTrigger) throw new Error("The scroll animation libraries are unavailable.");
      return { THREE, gsap: window.gsap, ScrollTrigger: window.ScrollTrigger };
    });
    return librariesPromise;
  }

  function scheduleStart() {
    if (!hasEnteredLoadRange || !capabilityAllowed() || gsapMedia) return;
    const start = () => {
      idleHandle = 0;
      if (!capabilityAllowed() || gsapMedia) return;
      loadLibraries().then(startExperience).catch(() => {
        processSection.classList.add("is-experience-unavailable");
      });
    };

    if ("requestIdleCallback" in window) {
      idleHandle = window.requestIdleCallback(start, { timeout: 700 });
    } else {
      idleHandle = window.setTimeout(start, 40);
    }
  }

  function startExperience(libraries) {
    if (gsapMedia) return;
    const { THREE, gsap, ScrollTrigger } = libraries;
    gsap.registerPlugin(ScrollTrigger);
    gsapMedia = gsap.matchMedia();
    gsapMedia.add(EXPERIENCE_QUERY, () => {
      if (!capabilityAllowed()) return undefined;
      const destroyProcess = createProcessExperience(THREE, gsap, ScrollTrigger);
      const destroyReport = createReportExperience(gsap, ScrollTrigger);
      return () => {
        destroyReport();
        destroyProcess();
      };
    });
  }

  function createProcessExperience(THREE, gsap, ScrollTrigger) {
    const story = processSection.querySelector("[data-process-story]");
    const visual = processSection.querySelector("[data-process-visual]");
    const canvas = processSection.querySelector("[data-process-canvas]");
    const stepsContainer = processSection.querySelector("[data-process-steps]");
    const steps = Array.from(processSection.querySelectorAll("[data-process-step]"));
    const labels = new Map(Array.from(processSection.querySelectorAll("[data-process-node]")).map((label) => [label.dataset.processNode, label]));
    const status = processSection.querySelector("[data-process-status]");
    const index = processSection.querySelector("[data-process-index]");
    const title = processSection.querySelector("[data-process-title]");
    const detail = processSection.querySelector("[data-process-detail]");
    if (!story || !visual || !canvas || !stepsContainer || steps.length !== 4) return () => {};

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (error) {
      processSection.classList.add("is-experience-unavailable");
      return () => {};
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    camera.position.set(0, 0, 11.2);

    const graph = new THREE.Group();
    graph.scale.setScalar(0.76);
    scene.add(graph);

    const nodeDefinitions = Object.freeze({
      user: Object.freeze({ position: [-3.25, 0, 0], stage: 0 }),
      web: Object.freeze({ position: [-1.8, 1.45, 0.1], stage: 0 }),
      identity: Object.freeze({ position: [-1.9, -1.45, -0.05], stage: 0 }),
      api: Object.freeze({ position: [0, 0, 0.25], stage: 0 }),
      "tenant-a": Object.freeze({ position: [1.9, 1.45, 0.05], stage: 1 }),
      "tenant-b": Object.freeze({ position: [1.9, -1.45, 0.05], stage: 1 }),
      evidence: Object.freeze({ position: [3.75, 0, 0], stage: 2 }),
    });
    const edgeDefinitions = Object.freeze([
      Object.freeze({ from: "user", to: "web", stage: 0 }),
      Object.freeze({ from: "identity", to: "web", stage: 0 }),
      Object.freeze({ from: "web", to: "api", stage: 0 }),
      Object.freeze({ from: "api", to: "tenant-a", stage: 1 }),
      Object.freeze({ from: "api", to: "tenant-b", stage: 2, finding: true }),
      Object.freeze({ from: "tenant-b", to: "evidence", stage: 2, finding: true }),
      Object.freeze({ from: "tenant-a", to: "evidence", stage: 3 }),
    ]);
    const pathNames = ["user", "web", "api", "tenant-b", "evidence"];
    const nodePositions = new Map();
    const nodeMeshes = new Map();
    const edgeLines = [];
    const disposableGeometries = [];
    const disposableMaterials = [];

    const nodeGeometry = new THREE.SphereGeometry(0.115, 12, 8);
    disposableGeometries.push(nodeGeometry);
    Object.entries(nodeDefinitions).forEach(([name, definition]) => {
      const position = new THREE.Vector3(...definition.position);
      const material = new THREE.MeshBasicMaterial({ color: 0x53647f, transparent: true, opacity: 0.82 });
      const mesh = new THREE.Mesh(nodeGeometry, material);
      mesh.position.copy(position);
      graph.add(mesh);
      nodePositions.set(name, position);
      nodeMeshes.set(name, { mesh, material, stage: definition.stage });
      disposableMaterials.push(material);
    });

    edgeDefinitions.forEach((definition) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        nodePositions.get(definition.from),
        nodePositions.get(definition.to),
      ]);
      const material = new THREE.LineBasicMaterial({ color: 0x30425f, transparent: true, opacity: 0.32 });
      const line = new THREE.Line(geometry, material);
      graph.add(line);
      edgeLines.push({ definition, material });
      disposableGeometries.push(geometry);
      disposableMaterials.push(material);
    });

    const boundaryCurve = new THREE.EllipseCurve(1.9, 0, 1.05, 2.35, 0, Math.PI * 2, false, 0);
    const boundaryGeometry = new THREE.BufferGeometry().setFromPoints(
      boundaryCurve.getPoints(64).map((point) => new THREE.Vector3(point.x, point.y, -0.1))
    );
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0x5a6d8d, transparent: true, opacity: 0.28 });
    const boundary = new THREE.LineLoop(boundaryGeometry, boundaryMaterial);
    graph.add(boundary);
    disposableGeometries.push(boundaryGeometry);
    disposableMaterials.push(boundaryMaterial);

    const ambientPositions = [];
    for (let point = 0; point < 24; point += 1) {
      ambientPositions.push(
        Math.sin(point * 2.17) * 4.3,
        Math.cos(point * 1.43) * 2.65,
        -1.2 + (point % 5) * 0.12
      );
    }
    const ambientGeometry = new THREE.BufferGeometry();
    ambientGeometry.setAttribute("position", new THREE.Float32BufferAttribute(ambientPositions, 3));
    const ambientMaterial = new THREE.PointsMaterial({ color: 0x5eead4, size: 0.025, transparent: true, opacity: 0.24 });
    const ambient = new THREE.Points(ambientGeometry, ambientMaterial);
    graph.add(ambient);
    disposableGeometries.push(ambientGeometry);
    disposableMaterials.push(ambientMaterial);

    const probeGeometry = new THREE.SphereGeometry(0.08, 10, 7);
    const probeMaterial = new THREE.MeshBasicMaterial({ color: 0x9b8cff });
    const probe = new THREE.Mesh(probeGeometry, probeMaterial);
    graph.add(probe);
    disposableGeometries.push(probeGeometry);
    disposableMaterials.push(probeMaterial);

    const progressState = { value: 0 };
    const pointerState = { x: 0, y: 0 };
    let activeStage = -1;
    let renderFrame = 0;
    let destroyed = false;

    function resizeRenderer() {
      if (destroyed) return;
      const rect = visual.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      requestRender();
    }

    function updateDomStage(stage, progress) {
      if (stage !== activeStage) {
        activeStage = stage;
        const content = stages[stage];
        if (status) status.textContent = content.status;
        if (index) index.textContent = content.index;
        if (title) title.textContent = content.title;
        if (detail) detail.textContent = content.detail;
        steps.forEach((step, stepIndex) => step.classList.toggle("is-process-active", stepIndex === stage));
        labels.forEach((label, name) => {
          label.classList.toggle("is-node-active", nodeDefinitions[name].stage <= stage);
        });
      }
      visual.style.setProperty("--process-progress", progress.toFixed(4));
    }

    function updateProjectedLabels() {
      const rect = visual.getBoundingClientRect();
      graph.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      labels.forEach((label, name) => {
        const projected = nodePositions.get(name).clone().applyMatrix4(graph.matrixWorld).project(camera);
        const x = Math.max(70, Math.min(rect.width - 70, (projected.x * 0.5 + 0.5) * rect.width));
        const y = Math.max(70, Math.min(rect.height - 92, (-projected.y * 0.5 + 0.5) * rect.height));
        label.style.setProperty("--process-node-x", `${x.toFixed(1)}px`);
        label.style.setProperty("--process-node-y", `${y.toFixed(1)}px`);
      });
    }

    function renderScene() {
      renderFrame = 0;
      if (destroyed || document.hidden) return;
      const progress = Math.min(1, Math.max(0, progressState.value));
      const stage = Math.min(stages.length - 1, Math.floor(progress * stages.length));
      updateDomStage(stage, progress);

      graph.rotation.y = -0.075 + progress * 0.15 + pointerState.x * 0.035;
      graph.rotation.x = -0.025 + pointerState.y * 0.025;
      camera.position.z = 11.2 - progress * 0.72;
      camera.position.x = progress * 0.12;
      camera.lookAt(0, 0, 0);

      nodeMeshes.forEach(({ mesh, material, stage: nodeStage }) => {
        const active = nodeStage <= stage;
        material.color.setHex(stage === 3 && active ? 0x5eead4 : (active ? 0x9b8cff : 0x53647f));
        material.opacity = active ? 1 : 0.48;
        mesh.scale.setScalar(active ? 1.35 : 0.92);
      });

      edgeLines.forEach(({ definition, material }) => {
        const active = definition.stage <= stage;
        const findingActive = definition.finding && stage === 2;
        material.color.setHex(findingActive ? 0xff7d6e : (stage === 3 && active ? 0x5eead4 : (active ? 0x9b8cff : 0x30425f)));
        material.opacity = active ? (findingActive ? 0.96 : 0.76) : 0.24;
      });

      boundaryMaterial.color.setHex(stage >= 3 ? 0x5eead4 : (stage >= 1 ? 0x9b8cff : 0x5a6d8d));
      boundaryMaterial.opacity = stage >= 1 ? 0.7 : 0.28;
      boundary.scale.setScalar(stage >= 1 ? 1 : 0.92);

      const pathProgress = progress * (pathNames.length - 1);
      const pathIndex = Math.min(pathNames.length - 2, Math.floor(pathProgress));
      const segmentProgress = Math.min(1, pathProgress - pathIndex);
      probe.position.lerpVectors(nodePositions.get(pathNames[pathIndex]), nodePositions.get(pathNames[pathIndex + 1]), segmentProgress);
      probeMaterial.color.setHex(stage === 2 ? 0xffc56e : (stage === 3 ? 0x5eead4 : 0x9b8cff));
      probe.scale.setScalar(1 + Math.sin(progress * Math.PI * 8) * 0.12);

      renderer.render(scene, camera);
      updateProjectedLabels();
    }

    function requestRender() {
      if (!renderFrame && !destroyed) renderFrame = window.requestAnimationFrame(renderScene);
    }

    function onPointerMove(event) {
      const rect = visual.getBoundingClientRect();
      pointerState.x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      pointerState.y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
      requestRender();
    }

    function onPointerLeave() {
      pointerState.x = 0;
      pointerState.y = 0;
      requestRender();
    }

    function onVisibilityChange() {
      if (!document.hidden) requestRender();
    }

    function onContextLost(event) {
      event.preventDefault();
      webgl2Support = false;
      processSection.classList.add("is-experience-unavailable");
      if (gsapMedia) gsapMedia.revert();
      gsapMedia = null;
    }

    processSection.classList.remove("is-experience-unavailable");
    processSection.classList.add("is-experience-ready");
    visual.addEventListener("pointermove", onPointerMove, { passive: true });
    visual.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    canvas.addEventListener("webglcontextlost", onContextLost, false);

    const resizeObserver = new ResizeObserver(resizeRenderer);
    resizeObserver.observe(visual);
    resizeRenderer();
    renderScene();

    const tween = gsap.to(progressState, {
      value: 1,
      duration: 1,
      ease: "none",
      paused: true,
      onUpdate: requestRender,
    });
    const scrollTrigger = ScrollTrigger.create({
      trigger: story,
      endTrigger: stepsContainer,
      start: "top top+=96",
      end: "bottom bottom-=72",
      animation: tween,
      pin: visual,
      pinSpacing: false,
      scrub: 0.65,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefresh: resizeRenderer,
    });

    Promise.resolve(document.fonts && document.fonts.ready).then(() => {
      if (!destroyed) ScrollTrigger.refresh();
    });

    return () => {
      if (destroyed) return;
      destroyed = true;
      if (renderFrame) window.cancelAnimationFrame(renderFrame);
      scrollTrigger.kill(true);
      tween.kill();
      resizeObserver.disconnect();
      visual.removeEventListener("pointermove", onPointerMove);
      visual.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      steps.forEach((step) => step.classList.remove("is-process-active"));
      labels.forEach((label) => {
        label.classList.remove("is-node-active");
        label.style.removeProperty("--process-node-x");
        label.style.removeProperty("--process-node-y");
      });
      visual.style.removeProperty("--process-progress");
      processSection.classList.remove("is-experience-ready");
      disposableGeometries.forEach((geometry) => geometry.dispose());
      disposableMaterials.forEach((material) => material.dispose());
      const replacementCanvas = canvas.cloneNode(false);
      canvas.replaceWith(replacementCanvas);
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }

  function createReportExperience(gsap, ScrollTrigger) {
    const visual = reportSection.querySelector("[data-report-visual]");
    const back = reportSection.querySelector(".report-page.back");
    const middle = reportSection.querySelector(".report-page.middle");
    const front = reportSection.querySelector(".report-page.front");
    const rows = Array.from(reportSection.querySelectorAll("[data-report-step]"));
    if (!visual || !back || !middle || !front || rows.length !== 3) return () => {};

    reportSection.classList.add("report-scroll-ready");
    let activeRow = -1;
    const timeline = gsap.timeline({
      paused: true,
      defaults: { ease: "none" },
      onUpdate() {
        const next = Math.min(rows.length - 1, Math.floor(timeline.progress() * rows.length));
        if (next === activeRow) return;
        activeRow = next;
        rows.forEach((row, rowIndex) => row.classList.toggle("is-scroll-active", rowIndex === activeRow));
      },
    });
    timeline
      .fromTo(back, { x: 0, y: 0, rotation: -5, opacity: 0.5 }, { x: -24, y: 10, rotation: -7, opacity: 0.72 }, 0)
      .fromTo(middle, { x: 0, y: 0, rotation: 3, opacity: 0.75 }, { x: 8, y: -5, rotation: 5, opacity: 0.9 }, 0)
      .fromTo(front, { x: 0, y: 0, rotation: 0 }, { x: 17, y: -13, rotation: 1.35 }, 0);

    const scrollTrigger = ScrollTrigger.create({
      trigger: reportSection,
      start: "top 78%",
      end: "bottom 28%",
      animation: timeline,
      scrub: 0.45,
      invalidateOnRefresh: true,
    });

    return () => {
      scrollTrigger.kill(true);
      timeline.kill();
      reportSection.classList.remove("report-scroll-ready");
      rows.forEach((row) => row.classList.remove("is-scroll-active"));
      gsap.set([back, middle, front], { clearProps: "transform,opacity" });
    };
  }

  function stopExperience() {
    if (idleHandle) {
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
      idleHandle = 0;
    }
    if (gsapMedia) {
      gsapMedia.revert();
      gsapMedia = null;
    }
  }

  function onMediaChange() {
    if (experienceMedia.matches) scheduleStart();
  }

  function onConnectionChange() {
    if (connection && connection.saveData) stopExperience();
    else scheduleStart();
  }

  proximityObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    hasEnteredLoadRange = true;
    proximityObserver.disconnect();
    scheduleStart();
  }, { rootMargin: "1400px 0px" });
  proximityObserver.observe(reportSection);

  experienceMedia.addEventListener("change", onMediaChange);
  if (connection && typeof connection.addEventListener === "function") {
    connection.addEventListener("change", onConnectionChange);
  }
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) stopExperience();
  });
})();
