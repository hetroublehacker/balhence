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
  calendar: Object.freeze({
    // Optional public HTTPS scheduling page. Leave empty until Balhence has
    // configured and reviewed a real calendar provider.
    bookingUrl: "",
  }),
  engagement: Object.freeze({
    provider: "giscus",
    repo: "hetroublehacker/balhence",
    repoId: "R_kgDORgQN5Q",
    // Discussions and the giscus app must be enabled before these public
    // values are populated. Incomplete configuration intentionally renders
    // no reactions or comments UI and makes no request to giscus.
    category: "",
    categoryId: "",
  }),
  analytics: Object.freeze({
    googleAnalyticsId: "G-Q850E2X4NN",
  }),
});
