export type Field = { slug: string; label: string; color: string; emoji: string };

// Canonical fields for a Comskills audience (computer science × biosciences, Pakistani universities).
// The AI maps free text onto these slugs so "AI" and "machine learning" become one hub on the map.
export const FIELDS: Field[] = [
  { slug: "computer-science", label: "Computer Science", color: "#6366F1", emoji: "💻" },
  { slug: "software-eng", label: "Software Engineering", color: "#3B82F6", emoji: "🛠️" },
  { slug: "ai-ml", label: "AI & Machine Learning", color: "#8B5CF6", emoji: "🤖" },
  { slug: "data-science", label: "Data Science", color: "#818CF8", emoji: "📊" },
  { slug: "cybersecurity", label: "Cybersecurity", color: "#0EA5E9", emoji: "🔐" },
  { slug: "electrical-electronics", label: "Electrical & Electronics", color: "#FACC15", emoji: "⚡" },
  { slug: "mechanical-civil", label: "Mechanical & Civil Engineering", color: "#FB923C", emoji: "🏗️" },
  { slug: "bioinformatics", label: "Bioinformatics", color: "#22C55E", emoji: "🧬" },
  { slug: "biotechnology", label: "Biotechnology", color: "#84CC16", emoji: "🧪" },
  { slug: "molecular-biology", label: "Molecular Biology & Genetics", color: "#4ADE80", emoji: "🔬" },
  { slug: "microbiology", label: "Microbiology", color: "#A3E635", emoji: "🦠" },
  { slug: "biochemistry", label: "Biochemistry", color: "#34D399", emoji: "⚗️" },
  { slug: "medicine-health", label: "Medicine & Health", color: "#14B8A6", emoji: "🩺" },
  { slug: "pharmacy", label: "Pharmacy", color: "#2DD4BF", emoji: "💊" },
  { slug: "public-health", label: "Public Health", color: "#10B981", emoji: "🏥" },
  { slug: "environmental-science", label: "Environmental Science", color: "#65A30D", emoji: "🌿" },
  { slug: "climate", label: "Climate", color: "#38BDF8", emoji: "🌍" },
  { slug: "agriculture-food", label: "Agriculture & Food", color: "#BEF264", emoji: "🌾" },
  { slug: "physics", label: "Physics", color: "#60A5FA", emoji: "⚛️" },
  { slug: "chemistry", label: "Chemistry", color: "#67E8F9", emoji: "🧫" },
  { slug: "mathematics-stats", label: "Mathematics & Statistics", color: "#A78BFA", emoji: "📐" },
  { slug: "psychology", label: "Psychology", color: "#FB7185", emoji: "🧠" },
  { slug: "education", label: "Education", color: "#F59E0B", emoji: "📚" },
  { slug: "social-sciences", label: "Social Sciences", color: "#FDBA74", emoji: "🧑‍🤝‍🧑" },
  { slug: "economics-business", label: "Economics & Business", color: "#EAB308", emoji: "💹" },
  { slug: "entrepreneurship", label: "Entrepreneurship", color: "#F43F5E", emoji: "🚀" },
  { slug: "design-media", label: "Design & Media", color: "#E879F9", emoji: "🎨" },
  { slug: "policy-law", label: "Policy & Law", color: "#F97316", emoji: "🏛️" },
  { slug: "research-academia", label: "Research & Academia", color: "#C084FC", emoji: "🎓" },
  { slug: "social-impact", label: "Social Impact & NGOs", color: "#5EEAD4", emoji: "🤝" },
];

export const FIELD_SLUGS = FIELDS.map((f) => f.slug);
const BY_SLUG = new Map(FIELDS.map((f) => [f.slug, f]));

export function getField(slug: string): Field {
  return BY_SLUG.get(slug) ?? { slug, label: slug, color: "#94A3B8", emoji: "✨" };
}

export function isFieldSlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}

export function onlyValidFields(slugs: string[]): string[] {
  return Array.from(new Set(slugs.filter(isFieldSlug)));
}

/* ---------------- "Looking for" (fixed list) ---------------- */

export const LOOKING_FOR = [
  { value: "scholarship", label: "Scholarships", emoji: "🎓" },
  { value: "research", label: "Research", emoji: "🔬" },
  { value: "job", label: "Jobs", emoji: "💼" },
  { value: "internship", label: "Internships", emoji: "🧭" },
  { value: "collaborators", label: "Collaborators", emoji: "🤝" },
] as const;
export type LookingFor = (typeof LOOKING_FOR)[number]["value"];
export const LOOKING_FOR_VALUES = LOOKING_FOR.map((l) => l.value) as LookingFor[];
export const lookingForLabel = (v: string) => LOOKING_FOR.find((l) => l.value === v)?.label ?? v;

/* ---------------- Volunteering (fixed list) ---------------- */

export const VOLUNTEER_AREAS = ["Mentoring", "Session hosting", "Content & design", "Tech/website", "Outreach", "Event logistics", "Research support", "Other"] as const;
export type VolunteerArea = (typeof VOLUNTEER_AREAS)[number];

export const VOLUNTEER_FOR = [
  { value: "comskills", label: "Comskills" },
  { value: "other", label: "Other causes" },
  { value: "both", label: "Both" },
] as const;
export type VolunteerFor = (typeof VOLUNTEER_FOR)[number]["value"];

/* ---------------- Suggestions (free text is allowed too) ---------------- */

export const SUGGESTED_SKILLS = [
  "Python",
  "Data analysis",
  "Machine learning",
  "Web development",
  "Statistics",
  "Bioinformatics pipelines",
  "Wet-lab techniques",
  "PCR",
  "Cell culture",
  "Scientific writing",
  "Literature reviews",
  "UI/UX design",
  "Public speaking",
  "Project management",
];

export const SUGGESTED_TOOLS = ["Python", "R", "Excel", "SPSS", "MATLAB", "Git", "Linux", "PyTorch", "TensorFlow", "Figma", "Canva", "LaTeX", "Docker", "BLAST", "ImageJ"];

export const FIELD_OF_STUDY_EXAMPLES = ["BS Computer Science", "BS Biotechnology", "MPhil Bioinformatics", "BS Software Engineering", "MBBS", "BS Microbiology"];

/* ---------------- Opportunity types (kept from Compass until the opportunities phase) ---------------- */

export const OPPORTUNITY_TYPES = [
  { value: "internship", label: "Internship" },
  { value: "fellowship", label: "Fellowship" },
  { value: "summer_school", label: "Summer school" },
  { value: "competition", label: "Competition" },
  { value: "event", label: "Event" },
  { value: "job", label: "Job" },
  { value: "other", label: "Other" },
] as const;
