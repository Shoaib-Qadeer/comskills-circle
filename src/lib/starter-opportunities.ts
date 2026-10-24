import type { OppType, RemoteMode } from "./types";

/**
 * Curated starter opportunities so the board isn't empty on day one.
 * Researched in October 2026 from the organisations' own postings or reputable listings.
 * Values that a posting doesn't state are left null rather than guessed.
 * Internships in France longer than two months must pay the legal minimum "gratification", hence paid: true for those.
 */
export type StarterOpportunity = {
  id: string; // stable slug, keeps imports idempotent
  domain: string; // the theme it was chosen for (shown in the admin import list)
  url: string;
  title: string;
  organization: string;
  location: string;
  remote: RemoteMode | null;
  type: OppType;
  deadline: string | null;
  startDate: string | null;
  durationMonths: number | null;
  paid: boolean | null;
  frenchRequired: boolean | null;
  fields: string[];
  tags: string[];
  eligibility: string;
  summary: string;
};

const ENS_BOARD = "https://master-cogsci.ens.psl.eu/en/internships/offers/";
const ENS_ELIGIBILITY_M2 =
  "Listed for M2 students on the ENS Cogmaster internship board. Contact the lab to ask whether students from other master's programmes can apply.";
const ENS_ELIGIBILITY_M1 =
  "Listed for M1 students on the ENS Cogmaster internship board. Contact the lab to ask whether students from other master's programmes can apply.";

export const STARTER_OPPORTUNITIES: StarterOpportunity[] = [
  /* ---------------- Policy making ---------------- */
  {
    id: "oecd-internship-programme",
    domain: "Policy making",
    url: "https://www.oecd.org/en/about/careers/internships.html",
    title: "OECD Internship Programme",
    organization: "OECD",
    location: "Paris",
    remote: "hybrid",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["policy-governance", "economics"],
    tags: ["international organisation", "policy analysis", "rolling applications"],
    eligibility:
      "Full-time students (bachelor's, master's or PhD) in a field linked to OECD work, mainly nationals of OECD member countries. Excellent English or French.",
    summary:
      "Work inside an OECD directorate on research and policy analysis, from economics and education to environment and digital policy. Interns in Paris receive €1,000 a month; internships last one to six months and applications are accepted on an ongoing basis.",
  },
  {
    id: "unesco-internship-all-sectors",
    domain: "Policy making",
    url: "https://careers.unesco.org/job/Multiple-INTERNSHIP-All-Sectors-Bureaus/1331682557",
    title: "UNESCO Internship: All Sectors and Bureaus",
    organization: "UNESCO",
    location: "Paris (headquarters) or field offices",
    remote: "onsite",
    type: "internship",
    deadline: "2026-12-31",
    startDate: null,
    durationMonths: 6,
    paid: false,
    frenchRequired: false,
    fields: ["policy-governance", "education-learning"],
    tags: ["united nations", "talent pool"],
    eligibility:
      "Aged 20+; final-year bachelor's, master's or PhD students, or graduates within the last 12 months. Excellent English or French.",
    summary:
      "Join UNESCO's internship talent pool for placements across its programme sectors and central services. Internships run one to six months and are unpaid; an application stays in the pool for six months.",
  },

  /* ---------------- Environmental science and climate change ---------------- */
  {
    id: "iiasa-yssp-2027",
    domain: "Environmental science (climate change)",
    url: "https://www.heysuccess.com/opportunity/International-Institute-for-Applied-Systems-Analysis-(IIASA)-Young-Scientists-Summer-Program-2027-6432",
    title: "IIASA Young Scientists Summer Program 2027",
    organization: "International Institute for Applied Systems Analysis (IIASA)",
    location: "Laxenburg, Austria",
    remote: "onsite",
    type: "fellowship",
    deadline: "2027-01-15",
    startDate: "2027-06-01",
    durationMonths: 3,
    paid: null,
    frenchRequired: false,
    fields: ["climate", "energy", "ecology", "research-academia"],
    tags: ["systems analysis", "summer research", "phd level"],
    eligibility:
      "Aimed at advanced PhD students (about two years before completion) whose topic fits IIASA research. Priority to residents of member-organisation countries.",
    summary:
      "A three-month research stay (1 June to 28 August 2027) with IIASA scientists working on energy, climate, biodiversity or population questions. Many member organisations fund about €1,700 a month plus travel; others need their own funding.",
  },
  {
    id: "wmo-internship-dppd-2026",
    domain: "Environmental science (climate change)",
    url: "https://estm.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001/job/36754",
    title: "WMO Internship: Partnerships and Climate Finance",
    organization: "World Meteorological Organization (WMO)",
    location: "Geneva",
    remote: "onsite",
    type: "internship",
    deadline: "2026-09-22",
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["climate", "policy-governance"],
    tags: ["united nations", "climate finance", "partnerships"],
    eligibility:
      "Master's-level study in international relations, development, climate studies, business, economics or law. Fluent English; French is an advantage.",
    summary:
      "A six-month internship in WMO's Private Sector and Philanthropic Engagement Unit, researching partners and supporting climate-finance work such as the WMO Commons. Paid CHF 1,500 a month; this call closed on 22 September 2026, so watch for the next one.",
  },

  /* ---------------- AI and education ---------------- */
  {
    id: "unesco-internship-education-sector",
    domain: "AI and education",
    url: "https://careers.unesco.org/job/Multiple-INTERNSHIP-Education-Sector/1347773857/",
    title: "UNESCO Internship: Education Sector",
    organization: "UNESCO",
    location: "Paris (headquarters) or field offices",
    remote: "onsite",
    type: "internship",
    deadline: "2026-12-31",
    startDate: null,
    durationMonths: 6,
    paid: false,
    frenchRequired: false,
    fields: ["education-learning", "policy-governance", "data-science"],
    tags: ["united nations", "education policy", "research"],
    eligibility:
      "Aged 20+; final-year bachelor's, master's or PhD students, or graduates within the last 12 months. Excellent English or French.",
    summary:
      "Support UNESCO's Education Sector with project work, education research and data analysis, partnerships and policy briefs. One to six months, unpaid; the sector prioritises Africa and gender equality.",
  },
  {
    id: "ens-lscp-big-data-education",
    domain: "AI and education",
    url: ENS_BOARD,
    title: "Big data analyses of educational achievement",
    organization: "LSCP, École normale supérieure (PSL)",
    location: "Paris",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["education-learning", "data-science", "cognitive-science"],
    tags: ["big data", "research internship", "m2"],
    eligibility: ENS_ELIGIBILITY_M2,
    summary:
      "A research internship analysing large-scale data on educational achievement at LSCP, the cognitive science and psycholinguistics lab of ENS. Six months, paid at least the legal gratification.",
  },
  {
    id: "ens-dec-virtual-agent-children",
    domain: "AI and education",
    url: ENS_BOARD,
    title: "Do young children learn better from an informative or affiliative virtual agent?",
    organization: "Département d'études cognitives, ENS (PSL)",
    location: "Paris",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: null,
    paid: null,
    frenchRequired: false,
    fields: ["education-learning", "ai-ml", "cognitive-science"],
    tags: ["virtual agents", "child development", "m2"],
    eligibility: ENS_ELIGIBILITY_M2,
    summary:
      "Test whether young children learn more from a virtual agent that is informative or one that is socially warm. A strong fit for AI-in-education interests; the board doesn't list the duration.",
  },

  /* ---------------- AI and the human mind ---------------- */
  {
    id: "ens-jean-nicod-trust-ai-justice",
    domain: "AI and the human mind",
    url: ENS_BOARD,
    title: "Evaluating users' trust in an AI assistant for the justice system",
    organization: "Institut Jean Nicod, ENS (PSL)",
    location: "Paris",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 5,
    paid: true,
    frenchRequired: false,
    fields: ["ai-ml", "cognitive-science", "ethics-ai"],
    tags: ["llm", "trust", "law", "m1"],
    eligibility: ENS_ELIGIBILITY_M1,
    summary:
      "An M1 internship studying how far people trust an AI assistant designed for the justice system. Four to five months, from February to June or July.",
  },
  {
    id: "ens-lnc2-learning-humans-machines",
    domain: "AI and the human mind",
    url: ENS_BOARD,
    title: "Learning and decision making in humans and machines",
    organization: "LNC2, ENS (PSL) and Inserm",
    location: "Paris",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["ai-ml", "cognitive-science", "neuroscience"],
    tags: ["decision making", "computational modelling", "m2"],
    eligibility: ENS_ELIGIBILITY_M2,
    summary:
      "Compare how humans and machine-learning systems learn and make decisions, at the cognitive and computational neuroscience lab of ENS and Inserm. Six months, M2 level.",
  },

  /* ---------------- AI and neuroscience ---------------- */
  {
    id: "ens-lscp-decoding-language-brain",
    domain: "AI and neuroscience",
    url: ENS_BOARD,
    title: "Decoding natural language from the human brain",
    organization: "LSCP, École normale supérieure (PSL)",
    location: "Paris",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["neuroscience", "ai-ml", "cognitive-science"],
    tags: ["brain decoding", "language", "m2"],
    eligibility: ENS_ELIGIBILITY_M2,
    summary:
      "A research internship on decoding natural language from human brain activity, at LSCP (ENS). Six months, M2 level.",
  },
  {
    id: "ens-lscp-single-word-brain-ai",
    domain: "AI and neuroscience",
    url: ENS_BOARD,
    title: "Single-word processing in the human brain and AI models",
    organization: "LSCP, École normale supérieure (PSL)",
    location: "Paris",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["neuroscience", "ai-ml", "cognitive-science"],
    tags: ["language models", "neural pathways", "m2"],
    eligibility: ENS_ELIGIBILITY_M2,
    summary:
      "Compare the neural pathways and mechanisms behind single-word processing in the human brain and in AI models, at LSCP (ENS). Six months, full time, M2 level.",
  },

  /* ---------------- Education policy for inclusive education ---------------- */
  {
    id: "unicef-internship-programme",
    domain: "Inclusive education policy",
    url: "https://www.unicef.org/careers/internships",
    title: "UNICEF Internship Programme",
    organization: "UNICEF",
    location: "New York headquarters and country offices worldwide",
    remote: "hybrid",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["education-learning", "policy-governance", "ngo-development"],
    tags: ["united nations", "children's rights", "rolling intakes"],
    eligibility:
      "Enrolled in, or graduated within two years from, a bachelor's, master's or PhD programme. Fluent English, French or Spanish.",
    summary:
      "Internships across UNICEF's work for children, including education programmes, at headquarters or country offices, in person, hybrid or remote. Six to 26 weeks with a monthly stipend; intakes are rolling through the year.",
  },
  {
    id: "ens-lscp-reading-disability",
    domain: "Inclusive education policy",
    url: ENS_BOARD,
    title: "Gene-environment interplay in reading ability, disability and recovery",
    organization: "LSCP, École normale supérieure (PSL)",
    location: "Paris",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["education-learning", "cognitive-science", "life-sciences"],
    tags: ["reading", "learning disabilities", "m2"],
    eligibility: ENS_ELIGIBILITY_M2,
    summary:
      "Research how genes and environment shape reading ability, reading disability and recovery, at LSCP (ENS). Useful evidence for inclusive education; six months, M2 level.",
  },

  /* ---------------- Midwifery ---------------- */
  {
    id: "who-internship-programme",
    domain: "Midwifery",
    url: "https://www.who.int/careers/internships",
    title: "WHO Internship Programme",
    organization: "World Health Organization (WHO)",
    location: "Geneva and regional or country offices",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 5.5,
    paid: true,
    frenchRequired: false,
    fields: ["public-health", "policy-governance"],
    tags: ["maternal health", "midwifery", "united nations"],
    eligibility:
      "Aged 20+, enrolled in (or within 18 months of finishing) a health, social, management or communications degree, after three years of full-time study. Fluent in a working language of the office.",
    summary:
      "WHO posts internships year-round, including in teams working on maternal, newborn and reproductive health. Six to 24 weeks, with a living allowance for interns who need financial support; apply only through WHO vacancy notices.",
  },
  {
    id: "unfpa-internships",
    domain: "Midwifery",
    url: "https://www.unfpa.org/jobs",
    title: "UNFPA internships (maternal health and midwifery)",
    organization: "UNFPA, the UN sexual and reproductive health agency",
    location: "New York headquarters and regional or country offices",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: null,
    frenchRequired: false,
    fields: ["public-health", "ngo-development"],
    tags: ["midwifery", "maternal health", "reproductive health"],
    eligibility:
      "Postgraduate students, final-year bachelor's students, or graduates starting within a year of graduating. English required; another UN language is an asset.",
    summary:
      "UNFPA posts internships on its jobs page, including maternal-health roles; a recent six-month example supported the State of the World's Midwifery work in Asia-Pacific. There is no salary, but a stipend may be paid if no other institution funds you.",
  },

  /* ---------------- Policy design and climate change ---------------- */
  {
    id: "eea-traineeship",
    domain: "Policy design and climate change",
    url: "https://www.eea.europa.eu/en/about/careers/traineeships",
    title: "European Environment Agency traineeship",
    organization: "European Environment Agency (EEA)",
    location: "Copenhagen",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 5,
    paid: true,
    frenchRequired: false,
    fields: ["climate", "policy-governance", "sustainability"],
    tags: ["eu", "environmental policy", "blue book"],
    eligibility:
      "Recruited through the European Commission's Blue Book traineeship (mainly EU citizens with a completed three-year degree and good English). The EEA doesn't accept unsolicited applications.",
    summary:
      "Work where environmental science meets EU policy, on knowledge, communications and environmental legislation. Places are filled through the five-month Blue Book traineeship, which pays a monthly grant.",
  },
  {
    id: "ec-blue-book-traineeship",
    domain: "Policy design and climate change",
    url: "https://traineeships.ec.europa.eu/index_en",
    title: "European Commission Blue Book traineeship",
    organization: "European Commission",
    location: "Brussels, Luxembourg and EU bodies",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 5,
    paid: true,
    frenchRequired: false,
    fields: ["policy-governance", "climate", "economics"],
    tags: ["eu", "blue book", "policy design"],
    eligibility:
      "Mainly EU citizens, with a limited number of places for others. A completed three-year degree and good English; no age limit.",
    summary:
      "A five-month paid traineeship (about €1,537 a month) in the Commission and EU bodies, including teams working on climate and environment policy. Registration for March 2027 is closed; check the site's calendar for the next window.",
  },

  /* ---------------- Women's empowerment ---------------- */
  {
    id: "un-women-internship-programme",
    domain: "Women's empowerment",
    url: "https://www.unwomen.org/en/about-us/employment/internship-programme",
    title: "UN Women Internship Programme",
    organization: "UN Women",
    location: "Headquarters and offices worldwide",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: null,
    frenchRequired: false,
    fields: ["policy-governance", "social-sciences", "ngo-development"],
    tags: ["gender equality", "women's rights", "united nations"],
    eligibility:
      "Master's, post-master's or PhD students, final-year bachelor's students, or graduates starting within two years of graduating.",
    summary:
      "Internships on gender equality and women's empowerment across UN Women's offices, available throughout the year. Two to six months, full time; interns may receive a stipend for daily costs if no institution sponsors them.",
  },
  {
    id: "un-women-push-forward-istanbul-2026",
    domain: "Women's empowerment",
    url: "https://www.devex.com/jobs/un-women-internship-push-forward-for-gender-equality-and-women-s-empowerment-istanbul-turkiye-1455821",
    title: "UN Women Internship: Push Forward for Gender Equality",
    organization: "UN Women, Regional Office for Europe and Central Asia",
    location: "Istanbul",
    remote: "onsite",
    type: "internship",
    deadline: "2026-08-28",
    startDate: "2026-09-01",
    durationMonths: 6,
    paid: null,
    frenchRequired: false,
    fields: ["social-sciences", "policy-governance"],
    tags: ["gender equality", "civic space", "research"],
    eligibility:
      "Postgraduate students, final-year bachelor's students, or graduates within two years. Excellent English.",
    summary:
      "Research gender push-back narratives and shrinking civic space across Europe and Central Asia, and support the regional Push Forward strategy. This call closed on 28 August 2026; similar roles are posted on UN Women's careers site.",
  },

  /* ---------------- Medical technology ---------------- */
  {
    id: "stryker-packaging-medical-devices-2027",
    domain: "Medical technology",
    url: "https://stryker.wd1.myworkdayjobs.com/en-US/StrykerCareers/job/Internship-Packaging-Engineering---Medical-Devices---6-Months---Start-Spring-2027_R572042",
    title: "Internship: Packaging Engineering for Medical Devices",
    organization: "Stryker",
    location: "Schönkirchen (near Kiel), Germany",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: "2027-03-01",
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["digital-health", "design-ux"],
    tags: ["medical devices", "engineering", "prototyping"],
    eligibility:
      "Master's students in engineering, packaging technology, product design or a related field (or bachelor's graduates). English at B2 minimum; German is a plus.",
    summary:
      "Help design and test packaging for medical-technology products, from user needs to prototype testing. Six months from March or April 2027, paid €2,222.85 a month for 35 hours a week.",
  },
  {
    id: "ge-healthcare-deep-learning-imaging",
    domain: "Medical technology",
    url: "https://www.wizbii.com/company/general-electric/job/stage-deep-learning-for-medical-image-processing",
    title: "Deep learning for medical image processing",
    organization: "GE HealthCare",
    location: "Buc (near Versailles), France",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: null,
    fields: ["ai-ml", "digital-health", "software-eng"],
    tags: ["medical imaging", "deep learning", "computer vision"],
    eligibility: "Deep learning, machine learning and object-oriented programming (C++, Python). Fluent English.",
    summary:
      "Develop deep-learning methods that detect surgical tools in real-time X-ray images during interventional radiology, in the Image Acquisition team at GE HealthCare's European headquarters. Six months; check the listing is still open before applying.",
  },

  /* ---------------- Medicine and neurology ---------------- */
  {
    id: "pasteur-audition-biomarkers",
    domain: "Medicine and neurology",
    url: ENS_BOARD,
    title: "From auditory nerve models to biomarkers of hearing disorders",
    organization: "Institut de l'Audition, Institut Pasteur",
    location: "Paris",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["neuroscience", "life-sciences", "digital-health"],
    tags: ["audiology", "biomarkers", "computational modelling"],
    eligibility: ENS_ELIGIBILITY_M2,
    summary:
      "Use models of the auditory nerve to develop electrophysiological biomarkers of hearing disorders, at the Institut de l'Audition (Institut Pasteur). Six months, M2 level.",
  },
  {
    id: "cesp-speech-biomarkers-psychiatry",
    domain: "Medicine and neurology",
    url: ENS_BOARD,
    title: "Speech-based digital biomarkers in psychiatry",
    organization: "CESP (Inserm), MOODs team",
    location: "Paris area",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 5,
    paid: true,
    frenchRequired: false,
    fields: ["digital-health", "ai-ml", "psychology"],
    tags: ["psychiatry", "speech", "biomarkers"],
    eligibility: ENS_ELIGIBILITY_M2,
    summary:
      "Develop speech-based digital biomarkers for psychiatric conditions with the MOODs team at CESP (Inserm). Five months in the second semester of 2026–27, M2 level.",
  },

  /* ---------------- Psychology ---------------- */
  {
    id: "irba-nanterre-peripersonal-anxiety",
    domain: "Psychology",
    url: ENS_BOARD,
    title: "Peripersonal space and anxiety",
    organization: "IRBA and Université Paris Nanterre",
    location: "Brétigny-sur-Orge and Nanterre",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["psychology", "neuroscience"],
    tags: ["anxiety", "clinical psychology", "m2"],
    eligibility: ENS_ELIGIBILITY_M2,
    summary:
      "Study how anxiety changes the space people treat as close to their body, with the French Armed Forces Biomedical Research Institute and Université Paris Nanterre. Six months, M2 level.",
  },
  {
    id: "ens-dec-charitable-giving",
    domain: "Psychology",
    url: ENS_BOARD,
    title: "The psychology of charitable giving",
    organization: "Département d'études cognitives, ENS (PSL)",
    location: "Paris",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: null,
    durationMonths: 6,
    paid: true,
    frenchRequired: false,
    fields: ["psychology", "cognitive-science", "economics"],
    tags: ["decision making", "prosocial behaviour", "m1"],
    eligibility: "Listed for M1 and M2 students on the ENS Cogmaster internship board. Contact the lab to ask whether students from other master's programmes can apply.",
    summary:
      "A research internship on why and how people give to charity, at the Département d'études cognitives (ENS). Six months, open to M1 and M2 students.",
  },
  {
    id: "ens-lnc2-motivation-theory",
    domain: "Psychology",
    url: ENS_BOARD,
    title: "Testing a theory of human motivation as constrained optimisation",
    organization: "LNC2, ENS (PSL) and Inserm",
    location: "Paris",
    remote: "onsite",
    type: "internship",
    deadline: null,
    startDate: "2026-10-01",
    durationMonths: null,
    paid: null,
    frenchRequired: false,
    fields: ["psychology", "cognitive-science"],
    tags: ["motivation", "computational modelling", "part-time", "m1"],
    eligibility: "Listed for M1 students and gap-year students on the ENS Cogmaster internship board. Contact the lab to ask whether students from other programmes can apply.",
    summary:
      "Experimentally test a theory that explains human motivation as approximately solving constrained optimisation problems, at LNC2 (ENS and Inserm). A flexible M1 internship from October 2026, at least one day a week.",
  },
];
