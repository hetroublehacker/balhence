/**
 * Small runtime configuration for the static Balhence website.
 * Keep public values only. Never put API keys or private credentials here.
 */
window.BALHENCE_CONFIG = Object.freeze({
  company: Object.freeze({
    name: "Balhence",
    email: "contact@balhence.com",
  }),
  forms: Object.freeze({
    endpoint: "https://formspree.io/f/maqpybea",
  }),
  analytics: Object.freeze({
    googleAnalyticsId: "G-Q850E2X4NN",
  }),
});
