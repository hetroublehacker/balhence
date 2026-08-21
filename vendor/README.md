# Vendored browser dependency

## jsPDF 4.2.1

- Upstream: https://github.com/parallax/jsPDF
- Package: https://www.npmjs.com/package/jspdf/v/4.2.1
- File: `jspdf-4.2.1.umd.min.js`
- License: MIT, preserved in `jspdf-4.2.1.LICENSE.txt`
- npm package integrity: `sha512-YyAXyvnmjTbR4bHQRLzex3CuINCDlQnBqoSYyjJwTP2x9jDLuKDzy7aKUl0hgx3uhcl7xzg32agn5vlie6HIlQ==`
- Vendored file SHA-512: `a6539dbe2566c2ce18dc902f6e7a5f29bda157128cd650b0b22def984958463fad8832df7d9e055548f96bcbf2289f6922097c242007109e03d6250a05e72cc2`
- Script integrity: `sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3`

The scope planner loads this same-origin file before `scope-pdf.js`. It does not use a CDN at runtime.

When updating:

1. Verify the current release and security notes against the official repository and npm package.
2. Download the exact npm tarball and verify its published integrity.
3. Replace the UMD build and license together.
4. Update every checksum and the HTML `integrity` attribute.
5. Regenerate compact, standard, and maximum-length PDFs and repeat structural and visual validation.

## Three.js 0.185.1

- Upstream: https://github.com/mrdoob/three.js
- Package: https://www.npmjs.com/package/three/v/0.185.1
- Runtime file: `three-experience-0.185.1.module.min.js`
- Reproducible entry: `three-experience-entry.js`
- License: MIT, preserved in `three-0.185.1.LICENSE.txt`
- npm package integrity: `sha512-5aojFCXKwnjBRZvUnt3WFfEcvUJgkN5LlijRFN95hMy8WVkG4I0QNcJE+OuWvuJ0bOdStrbfXn0pkd6/QyiAlg==`
- Runtime file SHA-512: `389fa3e4c4709fa02a9eebd2df753cc0f2f9c599b1377eef89257e37090721cd09fb05d65c036bdae1738d864f3b2361ffe3ffee93f1916437040a7f8453736a`
- Runtime file integrity: `sha384-uDCjHnoAKUEJH/9EDkhvidfOFWkdPnZa1/K+lLFEViPCfUdjZ3F6SJzuA5WqGNat`
- Build tool: esbuild 0.28.2, npm integrity `sha512-HKVLS8dvII+xoKW9kmqxbRKrnWEXfJJr/FZhhJmiqIB0e053QNYFqOBouTMO/k5sID4MvCiUCvv8b9M4h32wIA==`

The runtime file is a browser ESM bundle tree-shaken from the exact Three.js
package against `three-experience-entry.js`. To reproduce it, extract the
published Three.js tarball, point the `three` alias at its
`build/three.module.js`, and bundle the entry with:

```bash
esbuild vendor/three-experience-entry.js --bundle --minify --format=esm --platform=browser --tree-shaking=true --legal-comments=inline --alias:three=/absolute/path/to/three/build/three.module.js --outfile=vendor/three-experience-0.185.1.module.min.js
```

## GSAP 3.15.0 and ScrollTrigger 3.15.0

- Upstream: https://github.com/greensock/GSAP
- Package: https://www.npmjs.com/package/gsap/v/3.15.0
- Files: `gsap-3.15.0.min.js` and `ScrollTrigger-3.15.0.min.js`
- License: GreenSock standard no-charge license, referenced in `gsap-3.15.0.LICENSE.txt`
- npm package integrity: `sha512-dMW4CWBTUK1AEEDeZc1g4xpPGIrSf9fJF960qbTZmN/QwZIWY5wgliS6JWl9/25fpTGJrMRtSjGtOmPnfjZB+A==`
- GSAP SHA-512: `a09f106da413850a0967ba04bfedbd8df3cce8270ffb35318773ca26cd6fc8e871d14ada52b13b3d081e22dbb774eb82272af35a9a1832c5639243c40736d4ab`
- ScrollTrigger SHA-512: `39a204eee7783f4e0486706e844726d3041271e2316e2da9574de804b4bff85e9a9a97f1b27c5c2313a9ec7d9e17d1bb37490486dd1503338b1be7532d2a35ed`
- GSAP script integrity: `sha384-XmJ9SoHtVOHoQUcKvFAzVXwdkKo1Ie3bhmSoIAkcdsHGaIrVJIkmozyq0FJeb/Ly`
- ScrollTrigger script integrity: `sha384-wl5TeDVvOWt30Pbf8aSo2ZrzsOjddu3avOBvHe+p+OhJt9gP6w9YXmDkN5DK2/dF`

The homepage experience loader requests these same-origin files only for an
eligible desktop visitor who reaches the interactive story. Mobile, reduced
motion, slow-update, data-saving, low-memory, and WebGL-ineligible clients keep
the static semantic layout and do not download the advanced libraries.

When updating either animation dependency:

1. Check the official release notes and license.
2. Download the exact npm tarball and verify the published package integrity.
3. Replace the distribution file and license reference together.
4. Update every checksum and the loader's integrity value.
5. Re-run desktop, fallback, reduced-motion, resize, context-loss, and overflow tests.
