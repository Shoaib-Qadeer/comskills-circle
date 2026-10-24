// Fills a DEVELOPMENT database with fake classmates, opportunities and connections so you can
// see the app populated. Refuses to run against production.
//   MONGODB_URI=... MONGODB_DB=compass-dev npm run db:seed
import { ObjectId } from "mongodb";
import { collections, ensureIndexes, getDb } from "../src/lib/db";
import { normalizeUrl } from "../src/lib/url";
import { fallbackScore } from "../src/lib/fallback-match";
import type { ConnectionDoc, IntroRequestDoc, MatchDoc, OpportunityDoc, UserDoc } from "../src/lib/types";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("Refusing to seed a production database.");
  process.exit(1);
}

const day = (n: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + n));

const PEOPLE: Partial<UserDoc>[] = [
  { name: "Amina Adil", headline: "AI for early disease detection", fields: ["ai-ml", "digital-health", "public-health"], visibility: "open", preferredLocations: ["Paris", "Remote"], targetRoles: ["ML / AI intern"], skillsOffered: ["Python", "CV review"] },
  { name: "Ilyas Ghafoor", headline: "Neuroscience research, then a PhD", fields: ["neuroscience", "cognitive-science", "research-academia"], visibility: "class", preferredLocations: ["Paris"], targetRoles: ["Lab internship"] },
  { name: "Léa Martin", headline: "Climate data for cities", fields: ["climate", "data-science", "policy-governance"], visibility: "open", preferredLocations: ["Paris", "Europe"], targetRoles: ["Data science intern"], skillsOffered: ["Statistics", "French practice"] },
  { name: "Kenji Sato", headline: "Frugal hardware for clinics", fields: ["frugal-innovation", "digital-health", "design-ux"], visibility: "class", preferredLocations: ["Anywhere"], targetRoles: ["NGO / field project"] },
  { name: "Sofia Rossi", headline: "Biodiversity monitoring with sensors", fields: ["ecology", "sustainability", "data-science"], visibility: "class", preferredLocations: ["Europe"], targetRoles: ["Research intern"] },
  { name: "Omar Haddad", headline: "Learning science and edtech", fields: ["education-learning", "cognitive-science", "ai-ml"], visibility: "open", preferredLocations: ["Paris", "Remote"], targetRoles: ["Product / UX intern"], skillsOffered: ["Design", "Public speaking"] },
  { name: "Priya Nair", headline: "Ethics of AI in healthcare", fields: ["ethics-ai", "digital-health", "policy-governance"], visibility: "class", preferredLocations: ["Paris", "Geneva"], targetRoles: ["Policy intern"] },
  { name: "Lucas Dubois", headline: "Agritech for smallholder farmers", fields: ["agriculture-food", "frugal-innovation", "entrepreneurship"], visibility: "private", preferredLocations: ["Anywhere"], targetRoles: ["Startup intern"] },
  { name: "Mei Chen", headline: "Computational biology", fields: ["life-sciences", "biotech", "data-science"], visibility: "private", preferredLocations: ["Paris"], targetRoles: ["Lab internship"] },
  { name: "Tomás Silva", headline: "Energy systems and policy", fields: ["energy", "climate", "economics"], visibility: "class", preferredLocations: ["Europe", "Remote"], targetRoles: ["Policy intern", "Research intern"] },
  { name: "Hana Yilmaz", headline: "Mental health and digital tools", fields: ["psychology", "digital-health", "design-ux"], visibility: "open", preferredLocations: ["Paris"], targetRoles: ["Research intern"], skillsOffered: ["Interview prep"] },
  { name: "Noah Becker", headline: "Planetary health and open science", fields: ["planetary-health", "open-science", "research-academia"], visibility: "class", preferredLocations: ["Paris", "Remote"], targetRoles: ["Research intern"] },
  { name: "Fatima Zahra", headline: "NGO programmes for water access", fields: ["ngo-development", "public-health", "sustainability"], visibility: "private", preferredLocations: ["Anywhere"], targetRoles: ["NGO / field project"] },
  { name: "Ravi Kumar", headline: "Robotics for lab automation", fields: ["robotics", "software-eng", "biotech"], visibility: "class", preferredLocations: ["Paris"], targetRoles: ["ML / AI intern"] },
  { name: "Elena Petrova", headline: "Social science of tech adoption", fields: ["social-sciences", "ethics-ai", "education-learning"], visibility: "class", preferredLocations: ["Europe"], targetRoles: ["Research intern"] },
];

const OPPS: Partial<OpportunityDoc>[] = [
  { title: "ML intern — medical imaging", organization: "Health AI Lab", location: "Paris", remote: "hybrid", type: "internship", deadline: day(9), durationMonths: 6, paid: true, frenchRequired: false, fields: ["ai-ml", "digital-health"], tags: ["computer vision"], summary: "Build deep-learning models for early detection on imaging data. Suits students with Python and some ML." },
  { title: "Research internship in social cognition", organization: "Brain & Behaviour Institute", location: "Paris", remote: "onsite", type: "internship", deadline: day(25), durationMonths: 6, paid: true, frenchRequired: false, fields: ["neuroscience", "cognitive-science"], tags: ["eeg"], summary: "Join a lab running EEG studies on social decision-making. Good for future PhD applicants." },
  { title: "Urban climate data analyst intern", organization: "City Climate Office", location: "Paris", remote: "hybrid", type: "internship", deadline: day(2), durationMonths: 6, paid: true, frenchRequired: true, fields: ["climate", "data-science"], tags: ["gis"], summary: "Analyse heat-island data to inform city policy. French required for stakeholder meetings." },
  { title: "Frugal medical devices summer school", organization: "Open Hardware Network", location: "Geneva", remote: "onsite", type: "summer_school", deadline: day(40), durationMonths: null, paid: null, frenchRequired: false, fields: ["frugal-innovation", "digital-health"], tags: ["prototyping"], summary: "Two weeks of building low-cost diagnostic tools. For makers interested in global health." },
  { title: "Biodiversity sensing intern (3 months)", organization: "EcoSense", location: "Lyon", remote: "onsite", type: "internship", deadline: day(18), durationMonths: 3, paid: false, frenchRequired: false, fields: ["ecology", "data-science"], tags: ["acoustics"], summary: "Deploy acoustic sensors and analyse bird calls. Short and unpaid, good for field experience." },
  { title: "EdTech product intern", organization: "LearnLoop", location: "Remote", remote: "remote", type: "internship", deadline: null, durationMonths: 6, paid: true, frenchRequired: false, fields: ["education-learning", "design-ux"], tags: ["product"], summary: "Shape features of an adaptive learning app with user research. For people who like product and pedagogy." },
  { title: "AI policy fellowship", organization: "Digital Futures Forum", location: "Brussels", remote: "hybrid", type: "fellowship", deadline: day(30), durationMonths: 6, paid: true, frenchRequired: false, fields: ["ethics-ai", "policy-governance"], tags: ["regulation"], summary: "Work on AI regulation briefs with policymakers. For students interested in governance." },
  { title: "Climate hackathon", organization: "Planet Hack", location: "Paris", remote: "onsite", type: "competition", deadline: day(12), durationMonths: null, paid: null, frenchRequired: false, fields: ["climate", "sustainability", "software-eng"], tags: ["hackathon"], summary: "A 48-hour build sprint on climate adaptation tools. Teams of 3–5." },
  { title: "Energy modelling intern", organization: "GridLab", location: "Remote", remote: "remote", type: "internship", deadline: day(-5), durationMonths: 6, paid: true, frenchRequired: false, fields: ["energy", "data-science"], tags: ["modelling"], summary: "Model renewable integration scenarios. This one has closed." },
  { title: "Digital mental health research assistant", organization: "MindTech Lab", location: "Paris", remote: "hybrid", type: "internship", deadline: day(21), durationMonths: 6, paid: true, frenchRequired: null, fields: ["psychology", "digital-health"], tags: ["ux research"], summary: "Run user studies for a mental-health app. Suits psychology and design backgrounds." },
  { title: "Lab automation robotics intern", organization: "BioRobotics", location: "Paris", remote: "onsite", type: "internship", deadline: day(35), durationMonths: 5, paid: true, frenchRequired: false, fields: ["robotics", "biotech"], tags: ["python"], summary: "Program liquid-handling robots for biology labs. For engineers who like wet-lab problems." },
  { title: "Open science community event", organization: "Open Research Paris", location: "Paris", remote: "onsite", type: "event", deadline: day(6), durationMonths: null, paid: null, frenchRequired: false, fields: ["open-science", "research-academia"], tags: ["networking"], summary: "An evening of talks on reproducible research. Free, good for meeting researchers." },
];

const CONNS: Partial<ConnectionDoc>[] = [
  { name: "Dr. Claire Fontaine", role: "Postdoc in neuropsychology", organization: "Brain Institute", location: "Paris", fields: ["neuroscience", "psychology"], contactPreference: "ask_first", note: "Happy to talk about lab internships." },
  { name: "Marc Leroy", role: "Data scientist", organization: "Climate startup", location: "Paris", fields: ["climate", "data-science"], contactPreference: "direct" },
  { name: "Dr. Aisha Bello", role: "Global health researcher", organization: "WHO collaborating centre", location: "Geneva", fields: ["public-health", "digital-health"], contactPreference: "ask_first" },
  { name: "Jonas Weber", role: "Founder", organization: "Agritech startup", location: "Berlin", fields: ["agriculture-food", "entrepreneurship"], contactPreference: "direct" },
  { name: "Dr. Yuki Tanaka", role: "ML researcher", organization: "AI lab", location: "Paris", fields: ["ai-ml", "ethics-ai"], contactPreference: "ask_first" },
  { name: "Sara Lopez", role: "Product lead", organization: "EdTech company", location: "Remote", fields: ["education-learning", "design-ux"], contactPreference: "direct" },
  { name: "Pierre Garnier", role: "Policy advisor", organization: "Energy agency", location: "Paris", fields: ["energy", "policy-governance"], contactPreference: "ask_first" },
  { name: "Dr. Nadia Rahman", role: "Ecologist", organization: "Natural history museum", location: "Paris", fields: ["ecology", "open-science"], contactPreference: "direct" },
];

async function main() {
  const db = await getDb();
  console.log(`Seeding database "${db.databaseName}"…`);
  await ensureIndexes();
  const c = await collections();
  await Promise.all([c.users.deleteMany({ email: /@example\.test$/ }), c.opportunities.deleteMany({ url: /example\.test/ })]);

  const now = new Date();
  const users: UserDoc[] = PEOPLE.map((p, i) => ({
    _id: new ObjectId(),
    email: `${p.name!.split(" ")[0].toLowerCase()}@example.test`,
    name: p.name!,
    photoUrl: null,
    onboarded: true,
    visibility: p.visibility!,
    headline: p.headline!,
    summary: `${p.headline}. Looking for a 6-month internship that builds toward this.`,
    fields: p.fields!,
    freeTags: [],
    targetRoles: p.targetRoles || [],
    preferredLocations: p.preferredLocations || [],
    openToFrench: i % 4 === 0,
    skillsOffered: p.skillsOffered || [],
    collaborateOn: p.visibility === "open" ? "A hackathon team or a reading group" : "",
    links: { linkedin: `https://www.linkedin.com/in/example-${i}` },
    isAdmin: false,
    hasPosted: true,
    createdAt: now,
    updatedAt: now,
  }));
  await c.users.insertMany(users);

  const opps: OpportunityDoc[] = OPPS.map((o, i) => ({
    _id: new ObjectId(),
    url: `https://jobs.example.test/posting/${i + 1}`,
    urlKey: normalizeUrl(`https://jobs.example.test/posting/${i + 1}`)!,
    postedBy: users[i % users.length]._id,
    title: o.title!,
    organization: o.organization ?? null,
    location: o.location ?? null,
    remote: o.remote ?? null,
    type: o.type!,
    deadline: o.deadline ?? null,
    startDate: null,
    durationMonths: o.durationMonths ?? null,
    paid: o.paid ?? null,
    frenchRequired: o.frenchRequired ?? null,
    fields: o.fields!,
    tags: o.tags || [],
    eligibility: "Master's students",
    summary: o.summary!,
    taggedFor: i === 1 ? [users[1]._id] : [],
    posterNote: i === 1 ? "This is exactly your thesis topic!" : null,
    matchCount: 0,
    createdAt: new Date(now.getTime() - i * 36e5 * 7),
    updatedAt: now,
  }));
  await c.opportunities.insertMany(opps);

  // Rule-based matches so the dev UI is populated without an LLM
  const matches: MatchDoc[] = [];
  for (const o of opps) {
    for (const u of users) {
      if (String(u._id) === String(o.postedBy)) continue;
      if (o.frenchRequired && !u.openToFrench) continue;
      const s = fallbackScore(u, o);
      const tagged = o.taggedFor.some((t) => String(t) === String(u._id));
      if (s.score >= 60 || tagged)
        matches.push({
          _id: new ObjectId(),
          userId: u._id,
          opportunityId: o._id,
          score: s.score,
          reason: s.reason,
          basic: true,
          source: tagged ? "tagged" : "auto",
          taggedBy: tagged ? o.postedBy : null,
          taggedNote: tagged ? o.posterNote : null,
          seen: false,
          saved: false,
          dismissed: false,
          createdAt: now,
        });
    }
  }
  if (matches.length) await c.matches.insertMany(matches);
  for (const o of opps) await c.opportunities.updateOne({ _id: o._id }, { $set: { matchCount: matches.filter((m) => String(m.opportunityId) === String(o._id)).length } });

  const conns: ConnectionDoc[] = CONNS.map((x, i) => ({
    _id: new ObjectId(),
    name: x.name!,
    role: x.role ?? null,
    organization: x.organization ?? null,
    location: x.location ?? null,
    fields: x.fields!,
    linkedin: `https://www.linkedin.com/in/example-contact-${i}`,
    contactPreference: x.contactPreference!,
    note: x.note ?? null,
    addedBy: users[(i * 2) % users.length]._id,
    createdAt: now,
  }));
  await c.connections.insertMany(conns);

  const intros: IntroRequestDoc[] = [0, 2, 4].map((ci, k) => ({
    _id: new ObjectId(),
    connectionId: conns[ci]._id,
    requesterId: users[(k + 5) % users.length]._id,
    addedBy: conns[ci].addedBy,
    message: `Hi! Could you introduce me to ${conns[ci].name}? I'm exploring this field for my internship.`,
    status: (["pending", "accepted", "done"] as const)[k],
    createdAt: now,
    updatedAt: now,
  }));
  await c.introRequests.insertMany(intros);

  console.log(`Seeded ${users.length} classmates, ${opps.length} opportunities, ${matches.length} matches, ${conns.length} connections, ${intros.length} intro requests.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
