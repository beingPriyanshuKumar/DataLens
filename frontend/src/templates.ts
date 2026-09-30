import type { TemplateDefinition } from "./types";

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "jobs",
    title: "Job Openings",
    description: "Find active job postings with roles, companies, locations, and salaries.",
    category: "Talent & Careers",
    slots: [
      { id: "role", label: "Role / Title", placeholder: "e.g. AI Engineer", defaultValue: "Full Stack Engineer" },
      { id: "location", label: "Location", placeholder: "e.g. Remote, India, Bangalore", defaultValue: "Remote, India" },
      { id: "experience", label: "Experience Level", placeholder: "e.g. Junior, Senior", defaultValue: "Senior" },
      { id: "count", label: "Target Count", placeholder: "e.g. 20", defaultValue: "25" },
    ],
    assemblePrompt: (v) =>
      `Find ${v.count || "20"} active job openings for ${v.experience || ""} ${v.role || "software engineer"} located in ${v.location || "Remote"}. Include company name, job title, location, salary range if mentioned, and direct application URL.`,
  },
  {
    id: "funding",
    title: "Startup Funding Rounds",
    description: "Track recent venture funding rounds with investors, amounts, and dates.",
    category: "Venture Capital",
    slots: [
      { id: "sector", label: "Sector / Industry", placeholder: "e.g. Generative AI, FinTech", defaultValue: "AI & ML" },
      { id: "region", label: "Geography", placeholder: "e.g. India, Southeast Asia, US", defaultValue: "India" },
      { id: "timeframe", label: "Timeframe", placeholder: "e.g. last 6 months, 2026", defaultValue: "in 2026" },
      { id: "count", label: "Target Count", placeholder: "e.g. 15", defaultValue: "20" },
    ],
    assemblePrompt: (v) =>
      `Extract ${v.count || "15"} recent startup funding rounds in the ${v.sector || "AI"} sector in ${v.region || "India"} announced ${v.timeframe || "recently"}. Include startup name, round stage, funding amount, lead investors, and announcement date.`,
  },
  {
    id: "sponsors",
    title: "Hackathon Sponsors",
    description: "Collect past and prospective tech sponsors, sponsor tiers, and tracks.",
    category: "Community & Events",
    slots: [
      { id: "type", label: "Event Type / Focus", placeholder: "e.g. Web3, AI, Student Hackathons", defaultValue: "Tech Hackathons" },
      { id: "location", label: "Region", placeholder: "e.g. India, Global", defaultValue: "India" },
      { id: "count", label: "Target Count", placeholder: "e.g. 20", defaultValue: "30" },
    ],
    assemblePrompt: (v) =>
      `List ${v.count || "20"} companies actively sponsoring ${v.type || "hackathons"} in ${v.location || "India"}. Include company name, sponsorship tier or tracks supported, developer tools offered, and sponsorship contact page.`,
  },
  {
    id: "pricing",
    title: "Competitor Pricing",
    description: "Benchmark SaaS subscription pricing, tiers, and feature limits.",
    category: "Market Intelligence",
    slots: [
      { id: "niche", label: "Software Category", placeholder: "e.g. CRM, Vector Database, Form Builder", defaultValue: "AI Code Assistants" },
      { id: "count", label: "Target Count", placeholder: "e.g. 10", defaultValue: "15" },
    ],
    assemblePrompt: (v) =>
      `Benchmark pricing plans for ${v.count || "10"} leading ${v.niche || "SaaS products"}. Include product name, free tier availability, starter tier price per month, enterprise tier notes, and key feature limitations.`,
  },
  {
    id: "events",
    title: "Upcoming Conferences",
    description: "Gather upcoming tech summits, submission deadlines, and speaker calls.",
    category: "Events",
    slots: [
      { id: "topic", label: "Domain / Tech", placeholder: "e.g. Python, Cloud Native, Cybersecurity", defaultValue: "Artificial Intelligence & Data" },
      { id: "year", label: "Year / Dates", placeholder: "e.g. 2026, Q3-Q4", defaultValue: "2026" },
      { id: "count", label: "Target Count", placeholder: "e.g. 15", defaultValue: "20" },
    ],
    assemblePrompt: (v) =>
      `Collect ${v.count || "15"} upcoming conferences on ${v.topic || "tech"} in ${v.year || "2026"}. Include conference name, location/format (virtual vs in-person), dates, Call for Papers deadline, and ticket pricing.`,
  },
  {
    id: "grants",
    title: "Scholarships & Grants",
    description: "Discover open grants, eligibility criteria, award amounts, and deadlines.",
    category: "Education & Research",
    slots: [
      { id: "field", label: "Discipline / Audience", placeholder: "e.g. Computer Science, Women in Tech", defaultValue: "Computer Science Students" },
      { id: "region", label: "Eligible Region", placeholder: "e.g. India, International", defaultValue: "India" },
      { id: "count", label: "Target Count", placeholder: "e.g. 15", defaultValue: "20" },
    ],
    assemblePrompt: (v) =>
      `Find ${v.count || "15"} open scholarships and academic grants for ${v.field || "STEM students"} in ${v.region || "India"}. Include scholarship name, granting organization, award amount, eligibility criteria, and application deadline.`,
  },
  {
    id: "papers",
    title: "Research Papers",
    description: "Extract high-impact research preprints and papers on emerging topics.",
    category: "Academic & R&D",
    slots: [
      { id: "subject", label: "Research Topic", placeholder: "e.g. Small Language Models, Agentic Reasoning", defaultValue: "Autonomous AI Agents" },
      { id: "year", label: "Year Published", placeholder: "e.g. 2025-2026", defaultValue: "2025 or 2026" },
      { id: "count", label: "Target Count", placeholder: "e.g. 15", defaultValue: "20" },
    ],
    assemblePrompt: (v) =>
      `List ${v.count || "15"} influential research papers on ${v.subject || "AI"} published in ${v.year || "2026"}. Include paper title, authors, publication venue/arXiv ID, main benchmark results, and PDF URL.`,
  },
  {
    id: "tenders",
    title: "Government Tenders & RFPs",
    description: "Find active public tenders, procurement notices, and RFP deadlines.",
    category: "Public Sector",
    slots: [
      { id: "sector", label: "Procurement Sector", placeholder: "e.g. IT Software, Renewable Energy", defaultValue: "Software Development & IT Infrastructure" },
      { id: "agency", label: "Jurisdiction / Country", placeholder: "e.g. India (GeM / State portals)", defaultValue: "India" },
      { id: "count", label: "Target Count", placeholder: "e.g. 10", defaultValue: "15" },
    ],
    assemblePrompt: (v) =>
      `Find ${v.count || "10"} active public tenders and RFPs for ${v.sector || "IT services"} in ${v.agency || "India"}. Include tender title, issuing department, estimated contract value, closing date, and portal link.`,
  },
];

export const HINGLISH_EXAMPLE = {
  label: "Hinglish Example",
  prompt: "Bangalore mein remote AI engineers ki fresh job openings dhundho jisme minimum 20 LPA package ho aur apply link verified ho.",
};
