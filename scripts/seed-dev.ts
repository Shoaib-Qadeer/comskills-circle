// Fills a LOCAL database with invented members, projects, opportunities, tracker entries and a news post,
// so you can click around without real people. Everyone gets the password "comskills demo 1".
//
//   MONGODB_URI=mongodb://127.0.0.1:27017 npm run db:seed          (add --reset to remove earlier demo data first)
//
// It refuses to run against MongoDB Atlas (mongodb+srv / mongodb.net) unless you add --force,
// so you can't fill the real community with fake people by accident.
import type { ObjectId } from "mongodb";
import { collections, ensureIndexes } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { newUserDoc } from "../src/lib/accounts";
import { getSettings, saveSettings } from "../src/lib/settings";
import { deleteUserCascade } from "../src/lib/users";
import { normalizeUrl } from "../src/lib/url";
import { matchOpportunity, matchProposal } from "../src/lib/matching";
import { dateFromKey, localDayKey } from "../src/lib/time";
import type { AnnouncementDoc, OpportunityDoc, ProposalDoc, ScholarshipDoc, UserDoc } from "../src/lib/types";

const DOMAIN = "demo.comskills.invalid";
const PASSWORD = "comskills demo 1";

const PEOPLE = [
  { name: "Areeba Khalid", uni: "COMSATS University Islamabad", city: "Islamabad", study: "BS Bioinformatics", fields: ["bioinformatics", "data-science"], skills: ["Python", "R", "RNA-seq"], looking: ["scholarship", "research"], batch: "batch-1", vol: true },
  { name: "Hamza Raza", uni: "NUST", city: "Rawalpindi", study: "BS Computer Science", fields: ["ai-ml", "software-eng"], skills: ["Python", "PyTorch", "React"], looking: ["internship", "collaborators"], batch: "batch-1", vol: false },
  { name: "Maryam Siddiqui", uni: "University of Karachi", city: "Karachi", study: "MPhil Microbiology", fields: ["microbiology", "public-health"], skills: ["PCR", "Lab safety", "SPSS"], looking: ["scholarship"], batch: "batch-1", vol: true },
  { name: "Usman Tariq", uni: "LUMS", city: "Lahore", study: "BS Economics", fields: ["economics-business", "entrepreneurship"], skills: ["Excel", "Research writing"], looking: ["job", "collaborators"], batch: "batch-2", vol: false },
  { name: "Fatima Noor", uni: "Quaid-i-Azam University", city: "Islamabad", study: "BS Biotechnology", fields: ["biotechnology", "molecular-biology"], skills: ["CRISPR", "Cell culture", "Python"], looking: ["research", "scholarship"], batch: "batch-2", vol: true },
  { name: "Bilal Akhtar", uni: "FAST-NUCES", city: "Lahore", study: "BS Software Engineering", fields: ["software-eng", "cybersecurity"], skills: ["Go", "Docker", "Linux"], looking: ["job", "internship"], batch: "batch-2", vol: false },
  { name: "Sana Javed", uni: "Aga Khan University", city: "Karachi", study: "MBBS", fields: ["medicine-health", "public-health"], skills: ["Clinical research", "R"], looking: ["research"], batch: "batch-2", vol: true },
  { name: "Zain Abbasi", uni: "University of Azad Jammu & Kashmir", city: "Muzaffarabad", study: "BS Environmental Science", fields: ["environmental-science", "climate"], skills: ["GIS", "Python", "Field surveys"], looking: ["scholarship", "collaborators"], batch: "batch-1", vol: true },
];
const TEAM = { name: "Nida Hassan", title: "Mentor, scholarships" };

const day = (n: number) => dateFromKey(localDayKey(new Date(Date.now() + n * 86_400_000)));

async function main() {
  const uri = process.env.MONGODB_URI || "";
  if (!uri) throw new Error("Set MONGODB_URI first.");
  if (/mongodb\+srv|mongodb\.net/.test(uri) && !process.argv.includes("--force")) {
    throw new Error("This looks like MongoDB Atlas. The seed script only fills local databases. Add --force if you really mean it.");
  }
  await ensureIndexes();
  const c = await collections();

  if (process.argv.includes("--reset")) {
    const old = await c.users.find({ email: { $regex: `@${DOMAIN.replace(/\./g, "\\.")}$` } }, { projection: { _id: 1 } }).toArray();
    for (const u of old) await deleteUserCascade(u._id);
    await c.opportunities.deleteMany({ url: { $regex: "^https://example\\.org/demo-" } });
    await c.announcements.deleteMany({ title: { $regex: "^\\[Demo\\]" } });
    console.log(`Removed ${old.length} demo members and their content.`);
  }

  const settings = await getSettings(true);
  if (!settings.batches.length) {
    await saveSettings({ ...settings, batches: [{ id: "batch-1", label: "Batch 1", archived: false }, { id: "batch-2", label: "Batch 2", archived: false }] }, "seed");
  }

  const passwordHash = await hashPassword(PASSWORD);
  const now = new Date();
  const ids: ObjectId[] = [];
  const mk = async (p: Partial<UserDoc> & { name: string }, i: number) => {
    const email = `${p.name.toLowerCase().replace(/[^a-z]+/g, ".")}@${DOMAIN}`;
    const existing = await c.users.findOne({ email }, { projection: { _id: 1 } });
    if (existing) return existing._id;
    const doc: Omit<UserDoc, "_id"> = {
      ...newUserDoc({ name: p.name, email, passwordHash, batch: p.batch ?? null, saysTeam: p.role === "team", now }),
      ...p,
      email,
      emailVerifiedAt: now,
      status: "approved",
      onboarded: true,
      whatsapp: `+92300${String(1000000 + i).slice(-7)}`,
      lastSeenAt: now,
    };
    return (await c.users.insertOne(doc as UserDoc)).insertedId;
  };
  for (const [i, p] of PEOPLE.entries()) {
    ids.push(
      await mk(
        {
          name: p.name,
          university: p.uni,
          city: p.city,
          fieldOfStudy: p.study,
          fields: p.fields,
          skills: p.skills,
          tools: [],
          experience: `Coursework and a small project in ${p.study.replace(/^\w+ /, "")}.`,
          lookingFor: p.looking as UserDoc["lookingFor"],
          batch: p.batch,
          volunteering: p.vol ? { open: true, for: i % 2 ? "both" : "comskills", areas: i % 2 ? ["Mentoring", "Outreach"] : ["Content & design"], hoursPerMonth: 4 + (i % 3) * 2 } : { open: false, for: null, areas: [], hoursPerMonth: null },
        },
        i,
      ),
    );
  }
  const teamId = await mk({ name: TEAM.name, role: "team", teamTitle: TEAM.title, fieldOfStudy: "MS Education", fields: ["education", "research-academia"], skills: ["Mentoring"] }, 99);

  // Projects
  const proposals: Omit<ProposalDoc, "_id">[] = [
    { proposedBy: ids[0], title: "Open dataset of Pakistani crop genomes", problem: "Public genome data for many local crops is scattered or missing.", idea: "Collect published reads, clean them and publish a searchable dataset with a small website.", peopleNeeded: { count: 3, skills: ["Python", "RNA-seq", "React"] }, commitment: { hoursPerWeek: 4, duration: "3 months" }, fields: ["bioinformatics", "agriculture-food"], tags: ["genomics"], links: [], status: "team_forming", acceptingMembers: true, statusChangedAt: now, matchCount: 0, createdAt: now, updatedAt: now },
    { proposedBy: ids[7], title: "Air-quality map for Muzaffarabad", problem: "There is no public air-quality data for the city.", idea: "Build low-cost sensors with students and map readings online every week.", peopleNeeded: { count: 2, skills: ["GIS", "Python"] }, commitment: { hoursPerWeek: 3, duration: "2 months" }, fields: ["environmental-science", "climate"], tags: ["sensors"], links: [], status: "open", acceptingMembers: true, statusChangedAt: now, matchCount: 0, createdAt: now, updatedAt: now },
    { proposedBy: ids[1], title: "Urdu study-buddy chatbot", problem: "Many first-year students struggle with English-only course material.", idea: "A chatbot that explains course concepts in simple Urdu and Roman Urdu.", peopleNeeded: { count: 2, skills: ["Python", "Prompting"] }, commitment: { hoursPerWeek: 5, duration: "6 weeks" }, fields: ["ai-ml", "education"], tags: ["nlp"], links: [], status: "in_progress", acceptingMembers: false, statusChangedAt: now, matchCount: 0, createdAt: now, updatedAt: now },
  ];
  const propIds: ObjectId[] = [];
  for (const p of proposals) {
    const ex = await c.proposals.findOne({ title: p.title, proposedBy: p.proposedBy });
    propIds.push(ex?._id ?? (await c.proposals.insertOne(p as ProposalDoc)).insertedId);
  }
  await c.proposalMembers.updateOne({ proposalId: propIds[0], userId: ids[4] }, { $setOnInsert: { status: "accepted", note: "Happy to help with the lab side.", invitedBy: null, createdAt: now, decidedAt: now } }, { upsert: true });
  await c.proposalMembers.updateOne({ proposalId: propIds[2], userId: ids[5] }, { $setOnInsert: { status: "accepted", note: "I can host the backend.", invitedBy: null, createdAt: now, decidedAt: now } }, { upsert: true });

  // Opportunities
  const opp = (o: Partial<OpportunityDoc> & { url: string; title: string }): Omit<OpportunityDoc, "_id"> => ({
    urlKey: normalizeUrl(o.url)!, postedBy: ids[2], organization: null, location: null, remote: null, type: "other", country: null, degreeLevel: [], funding: null,
    deadline: null, startDate: null, durationMonths: null, paid: null, fields: [], tags: [], eligibility: null, summary: "", taggedFor: [], posterNote: null, matchCount: 0, createdAt: now, updatedAt: now, ...o,
  });
  const opps = [
    opp({ url: "https://example.org/demo-erasmus-bioinformatics", title: "Erasmus Mundus Master in Bioinformatics (demo)", organization: "Erasmus+", country: "Italy", type: "scholarship", degreeLevel: ["master"], funding: "full", deadline: day(20), fields: ["bioinformatics"], tags: ["genomics"], summary: "A fully funded two-year master's across European universities. Suits students who mix biology with programming." }),
    opp({ url: "https://example.org/demo-ra-genomics", title: "Research assistant, genomics lab (demo)", organization: "Demo University", country: "Pakistan", remote: "remote", type: "research", degreeLevel: ["bachelor", "master"], paid: true, deadline: day(6), fields: ["bioinformatics", "molecular-biology"], tags: ["rna-seq"], summary: "Part-time RA analysing sequencing data. Suits final-year students." }),
    opp({ url: "https://example.org/demo-climate-fellowship", title: "Young Climate Leaders Fellowship (demo)", organization: "Demo Foundation", country: "Online", remote: "remote", type: "fellowship", degreeLevel: ["any"], fields: ["climate", "social-impact"], summary: "A 3-month online fellowship with mentors and a small project grant." }),
  ];
  const oppIds: ObjectId[] = [];
  for (const o of opps) {
    const ex = await c.opportunities.findOne({ urlKey: o.urlKey });
    oppIds.push(ex?._id ?? (await c.opportunities.insertOne(o as OpportunityDoc)).insertedId);
  }

  // Tracker entries
  const entry = (userId: ObjectId, e: Partial<ScholarshipDoc> & { name: string; country: string; stage: ScholarshipDoc["stage"] }): Omit<ScholarshipDoc, "_id"> => ({
    userId, link: null, opportunityId: null, deadline: null, submittedAt: null, expectedResultAt: null, rejectedAt: null, lesson: null, programme: null, university: null, startDate: null,
    rejectedVisibility: "team", announceConsent: false, announcedAt: null, remindersSent: [], history: [{ stage: e.stage, at: now }], createdAt: now, updatedAt: now, ...e,
  });
  const entries = [
    entry(ids[0], { name: "DAAD EPOS", country: "Germany", stage: "applying", deadline: day(5) }),
    entry(ids[2], { name: "Chevening", country: "United Kingdom", stage: "applied", submittedAt: day(-20), expectedResultAt: day(60) }),
    entry(ids[4], { name: "Fulbright", country: "United States", stage: "rejected", rejectedAt: day(-10), lesson: "Start the essays earlier." }),
    entry(ids[6], { name: "Türkiye Burslari", country: "Turkey", stage: "accepted", programme: "MSc Public Health", university: "Demo University", announceConsent: true }),
  ];
  for (const e of entries) {
    if (!(await c.scholarships.findOne({ userId: e.userId, name: e.name }))) await c.scholarships.insertOne(e as ScholarshipDoc);
  }

  // News
  if (!(await c.announcements.findOne({ title: "[Demo] Welcome to Comskills Circle" }))) {
    const a: Omit<AnnouncementDoc, "_id"> = {
      authorId: teamId, title: "[Demo] Welcome to Comskills Circle", body: "This is where the team shares programme updates, events and wins.\n\nStart by finishing your profile, then look at Projects to find a team.",
      category: "programme", link: null, pinned: true, pinnedUntil: null, reactionCounts: { "👍": 0, "🎉": 0, "❤️": 0, "🙌": 0, "💡": 0 }, emailedAt: null, emailedCount: 0, scholarshipId: null, createdAt: now, editedAt: null,
    };
    await c.announcements.insertOne(a as AnnouncementDoc);
  }

  // Matching (uses the AI if LLM_API_KEY is set, otherwise basic matching)
  for (const id of propIds) await matchProposal(id);
  for (const id of oppIds) await matchOpportunity(id);

  console.log(`Done: ${ids.length + 1} demo members (password "${PASSWORD}"), ${propIds.length} projects, ${oppIds.length} opportunities.`);
  console.log(`Sign in as e.g. ${PEOPLE[0].name.toLowerCase().replace(/[^a-z]+/g, ".")}@${DOMAIN}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
