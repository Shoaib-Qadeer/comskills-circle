export type Field = { slug: string; label: string; color: string; emoji: string };

// Canonical fields for an AI × planetary-health × research cohort.
// The LLM maps free text onto these slugs so "AI" and "artificial intelligence" become one hub.
export const FIELDS: Field[] = [
  { slug: "ai-ml", label: "AI & Machine Learning", color: "#8B5CF6", emoji: "🤖" },
  { slug: "data-science", label: "Data Science", color: "#6366F1", emoji: "📊" },
  { slug: "software-eng", label: "Software Engineering", color: "#3B82F6", emoji: "💻" },
  { slug: "robotics", label: "Robotics", color: "#0EA5E9", emoji: "🦾" },
  { slug: "digital-health", label: "Digital Health", color: "#14B8A6", emoji: "🩺" },
  { slug: "public-health", label: "Public Health", color: "#10B981", emoji: "🏥" },
  { slug: "neuroscience", label: "Neuroscience", color: "#EC4899", emoji: "🧠" },
  { slug: "cognitive-science", label: "Cognitive Science", color: "#F472B6", emoji: "💭" },
  { slug: "psychology", label: "Psychology", color: "#FB7185", emoji: "🫶" },
  { slug: "life-sciences", label: "Life Sciences", color: "#22C55E", emoji: "🧬" },
  { slug: "biotech", label: "Biotech", color: "#84CC16", emoji: "🧪" },
  { slug: "ecology", label: "Ecology & Biodiversity", color: "#4ADE80", emoji: "🌿" },
  { slug: "climate", label: "Climate", color: "#38BDF8", emoji: "🌍" },
  { slug: "sustainability", label: "Sustainability", color: "#2DD4BF", emoji: "♻️" },
  { slug: "energy", label: "Energy", color: "#FACC15", emoji: "⚡" },
  { slug: "agriculture-food", label: "Agriculture & Food", color: "#A3E635", emoji: "🌾" },
  { slug: "planetary-health", label: "Planetary Health", color: "#34D399", emoji: "🪐" },
  { slug: "education-learning", label: "Education & Learning", color: "#F59E0B", emoji: "📚" },
  { slug: "social-sciences", label: "Social Sciences", color: "#FB923C", emoji: "🧑‍🤝‍🧑" },
  { slug: "policy-governance", label: "Policy & Governance", color: "#F97316", emoji: "🏛️" },
  { slug: "economics", label: "Economics", color: "#EAB308", emoji: "💹" },
  { slug: "design-ux", label: "Design & UX", color: "#E879F9", emoji: "🎨" },
  { slug: "frugal-innovation", label: "Frugal Innovation & Fablab", color: "#FDBA74", emoji: "🛠️" },
  { slug: "entrepreneurship", label: "Entrepreneurship", color: "#F43F5E", emoji: "🚀" },
  { slug: "open-science", label: "Open Science", color: "#67E8F9", emoji: "🔓" },
  { slug: "research-academia", label: "Research & Academia", color: "#A78BFA", emoji: "🔬" },
  { slug: "ngo-development", label: "NGOs & Development", color: "#5EEAD4", emoji: "🤝" },
  { slug: "ethics-ai", label: "Ethics of AI", color: "#C084FC", emoji: "⚖️" },
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

export const OPPORTUNITY_TYPES = [
  { value: "internship", label: "Internship" },
  { value: "fellowship", label: "Fellowship" },
  { value: "summer_school", label: "Summer school" },
  { value: "competition", label: "Competition" },
  { value: "event", label: "Event" },
  { value: "job", label: "Job" },
  { value: "other", label: "Other" },
] as const;

export const SUGGESTED_ROLES = [
  "Research intern",
  "ML / AI intern",
  "Data science intern",
  "Lab internship",
  "Policy intern",
  "Product / UX intern",
  "Startup intern",
  "NGO / field project",
];

export const SUGGESTED_LOCATIONS = ["Paris", "Remote", "Île-de-France", "Elsewhere in France", "Europe", "Anywhere"];

export const SUGGESTED_SKILLS = [
  "Python",
  "Statistics",
  "CV review",
  "Interview prep",
  "Design",
  "Writing",
  "French practice",
  "Literature reviews",
  "Prototyping",
  "Public speaking",
];
