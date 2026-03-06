/**
 * ============================================================
 *  BALHENCE — SITE CONFIGURATION
 *  Edit this file to update any content on the website.
 *  No HTML or CSS knowledge needed.
 * ============================================================
 */

const CONFIG = {

  /* ── Company Info ─────────────────────────────────────── */
  company: {
    name: "Balhence",
    tagline: "Secure What Matters.",
    subtagline: "Enterprise-grade Vulnerability Assessment & Penetration Testing for Indian businesses.",
    email: "contact@balhence.in",
    phone: "+91 98765 43210",
    location: "India",
    linkedIn: "#",
    twitter: "#",
  },

  /* ── Hero Section ─────────────────────────────────────── */
  hero: {
    heading: "Your Business Is a Target.",
    subheading: "Is It Protected?",
    description: "83% of Indian enterprises faced a cyberattack in 2024. Balhence delivers hands-on VAPT services that find your vulnerabilities before attackers do.",
    ctaText: "Get a Free Security Audit",
    ctaSecondaryText: "View Services",
    urgency: "Limited to 3 clients this month — 1 spot remaining",
  },

  /* ── Analytics ────────────────────────────────────────── */
  analytics: {
    // Paste your Google Analytics 4 Measurement ID here (e.g. "G-XXXXXXXXXX")
    googleAnalyticsId: "G-Q850E2X4NN",
  },

  /* ── Stats (Indian market — real data) ───────────────── */
  stats: [
    {
      value: "₹19.5 Cr",
      label: "Average cost of a data breach in India",
      source: "IBM Cost of Data Breach Report, 2024",
    },
    {
      value: "19.2L+",
      label: "Cybersecurity incidents reported in India in 2023",
      source: "CERT-In Annual Report, 2023",
    },
    {
      value: "3,291",
      label: "Weekly cyberattacks per Indian organisation",
      source: "Check Point Research, 2024",
    },
    {
      value: "83%",
      label: "Indian enterprises that faced a cyberattack in 2024",
      source: "PwC India Digital Trust Report, 2024",
    },
  ],

  /* ── Services ─────────────────────────────────────────── */
  services: [
    {
      icon: "🔍",
      title: "Web Application VAPT",
      description: "Comprehensive testing of web apps against OWASP Top 10, business logic flaws, and authentication bypasses.",
    },
    {
      icon: "📱",
      title: "Mobile Application VAPT",
      description: "Android & iOS security testing — reverse engineering, API abuse, insecure data storage, and more.",
    },
    {
      icon: "🌐",
      title: "Network Penetration Testing",
      description: "Internal and external network assessments — misconfigs, open ports, lateral movement paths.",
    },
    {
      icon: "☁️",
      title: "Cloud Security Assessment",
      description: "AWS, Azure, GCP — IAM misconfiguration, exposed storage, privilege escalation scenarios.",
    },
    {
      icon: "🏢",
      title: "Infrastructure Security Review",
      description: "Servers, firewalls, VPNs, and Active Directory assessed for exploitable weaknesses.",
    },
    {
      icon: "📋",
      title: "Compliance-Driven Testing",
      description: "VAPT aligned with RBI, SEBI, IRDAI, ISO 27001, and DPDP Act requirements.",
    },
  ],

  /* ── How It Works ─────────────────────────────────────── */
  process: [
    {
      step: "01",
      title: "Scope & NDA",
      description: "We define the exact scope of testing together and sign a mutual NDA before anything begins. Your data stays yours.",
    },
    {
      step: "02",
      title: "Hands-on Testing",
      description: "Our certified pentesters simulate real-world attackers — no automated scanners, no shortcuts. Every finding is manually verified.",
    },
    {
      step: "03",
      title: "Report, Fix & Re-test",
      description: "You get a clear report with severity ratings and fix guidance. We walk your team through it and re-test all patches for free within 30 days.",
    },
  ],

  /* ── About Section ────────────────────────────────────── */
  about: {
    heading: "About Balhence",
    brandStory: {
      word: "Balhence",
      meaning: "Santulan",
      meaningScript: "संतुलन",
      explanation: "Santulan is the Hindi word for balance — equilibrium. Security isn't about paranoia, it's about maintaining the right balance between openness and protection. That's what we help businesses achieve.",
    },
    paragraphs: [
      "Balhence is a focused cybersecurity firm built for the Indian market. We work with startups, SMEs, and enterprises to systematically identify and eliminate security risks before they become costly breaches.",
      "Our team comprises certified security professionals — CEH, OSCP, and CRTP — with experience across fintech, healthtech, e-commerce, and SaaS sectors.",
      "We don't just deliver PDF reports. We walk your team through every finding, help prioritise fixes, and offer a free re-test to confirm remediation.",
    ],
    highlights: [
      { value: "50+", label: "Engagements completed" },
      { value: "100%", label: "Client satisfaction rate" },
      { value: "48 hr", label: "Initial report turnaround" },
    ],
  },

  /* ── Why Choose Us ────────────────────────────────────── */
  whyUs: [
    {
      icon: "⚡",
      title: "Fast Turnaround",
      description: "Initial findings within 48 hours. Full report in 5–7 business days.",
    },
    {
      icon: "🇮🇳",
      title: "India-Focused Compliance",
      description: "Reports aligned with RBI, SEBI, IRDAI, and the DPDP Act 2023.",
    },
    {
      icon: "🔄",
      title: "Free Re-Test",
      description: "We re-test fixed vulnerabilities at no extra cost within 30 days.",
    },
    {
      icon: "🤝",
      title: "No Jargon",
      description: "Clear, actionable reports for both technical teams and C-suite executives.",
    },
  ],

  /* ── Testimonials ─────────────────────────────────────── */
  testimonials: [
    {
      quote: "Balhence found 3 critical vulnerabilities in our payment gateway that our internal team had missed for months. The report was clear enough for both our developers and our board.",
      name: "CTO",
      company: "Fintech Startup, Mumbai",
      initials: "RK",
    },
    {
      quote: "We needed a VAPT report for our ISO 27001 audit. Balhence delivered within a week, covered everything the auditors needed, and were available for follow-up calls throughout.",
      name: "Head of IT",
      company: "SaaS Company, Bengaluru",
      initials: "PS",
    },
    {
      quote: "What stood out was the free re-test. Most vendors hand you a PDF and disappear. Balhence actually stayed engaged until every critical issue was fixed.",
      name: "Founder",
      company: "Healthtech Platform, Delhi",
      initials: "AM",
    },
  ],

  /* ── Achievements ─────────────────────────────────────── */
  // Add new achievements here. Remove the array items to hide this section.
  achievements: [
    // { title: "Best Cybersecurity Startup", issuer: "CyberCon India 2024", year: "2024" },
    // { title: "CVE Credited Researcher", issuer: "CERT-In", year: "2023" },
  ],

  /* ── Team Members ─────────────────────────────────────── */
  // Add team members below. Remove all items to hide the team section.
  team: [
    // {
    //   name: "Arjun Sharma",
    //   role: "Founder & Lead Pentester",
    //   certifications: "OSCP, CEH",
    //   bio: "8 years in offensive security. Previously led red team ops at a Tier-1 bank.",
    //   avatar: "AS",   // initials shown as fallback
    //   photo: "",      // set to image path to show photo
    //   linkedIn: "#",
    // },
  ],

  /* ── Blog Posts ───────────────────────────────────────── */
  // Add blog posts here. Remove all items to show a "Coming Soon" placeholder.
  blogs: [
    // {
    //   title: "Top 5 Vulnerabilities Found in Indian Fintech Apps",
    //   date: "January 2025",
    //   summary: "A deep-dive into common security gaps we uncovered across 20+ fintech VAPT engagements.",
    //   tag: "Web Security",
    //   link: "#",
    // },
  ],

  /* ── Contact Form ─────────────────────────────────────── */
  contactForm: {
    heading: "Get Your Free Security Audit",
    subheading: "Fill in the form and our team will reach out within 24 hours.",
    trustIndicators: [
      "No commitment required",
      "Response within 24 hours",
      "NDA available on request",
    ],
    // To receive form submissions via email, replace with your Formspree endpoint:
    // formAction: "https://formspree.io/f/YOUR_ID"
    formAction: "https://formspree.io/f/maqpybea",
    fields: {
      companySizeOptions: [
        "1–10 employees",
        "11–50 employees",
        "51–200 employees",
        "201–500 employees",
        "500+ employees",
      ],
      serviceOptions: [
        "Web Application VAPT",
        "Mobile Application VAPT",
        "Network Penetration Testing",
        "Cloud Security Assessment",
        "Infrastructure Security Review",
        "Compliance-Driven Testing",
        "Not sure — need guidance",
      ],
    },
  },

  /* ── Footer ───────────────────────────────────────────── */
  footer: {
    tagline: "Built in India. Securing India.",
    links: [
      { label: "Services", href: "#services" },
      { label: "About", href: "#about" },
      { label: "Blog", href: "#blog" },
      { label: "Contact", href: "#contact" },
    ],
  },
};
