import { MongoClient, type Db, type Collection, ObjectId } from "mongodb";
import type {
  UserDoc,
  OpportunityDoc,
  MatchDoc,
  UsageDoc,
  RateDoc,
  EmailCodeDoc,
  OneTimeTokenDoc,
  EmailLogDoc,
  LlmLogDoc,
  PhotoDoc,
  ConnectRequestDoc,
  NotificationDoc,
  ProposalDoc,
  ProposalMemberDoc,
  ScholarshipDoc,
  AnnouncementDoc,
  ReactionDoc,
  ReportDoc,
} from "./types";

// Cache the client across hot reloads and serverless invocations.
const globalForMongo = globalThis as unknown as { _mongoClientPromise?: Promise<MongoClient> };

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
    globalForMongo._mongoClientPromise = client.connect();
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(process.env.MONGODB_DB || "comskills");
}

export async function collections() {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>("users") as Collection<UserDoc>,
    opportunities: db.collection<OpportunityDoc>("opportunities"),
    matches: db.collection<MatchDoc>("matches"),
    usage: db.collection<UsageDoc>("usage"),
    rates: db.collection<RateDoc>("rates"),
    emailCodes: db.collection<EmailCodeDoc>("emailCodes"),
    oneTimeTokens: db.collection<OneTimeTokenDoc>("oneTimeTokens"),
    emailLog: db.collection<EmailLogDoc>("emailLog"),
    llmLog: db.collection<LlmLogDoc>("llmLog"),
    photos: db.collection<PhotoDoc>("photos"),
    connectRequests: db.collection<ConnectRequestDoc>("connectRequests"),
    notifications: db.collection<NotificationDoc>("notifications"),
    proposals: db.collection<ProposalDoc>("proposals"),
    proposalMembers: db.collection<ProposalMemberDoc>("proposalMembers"),
    scholarships: db.collection<ScholarshipDoc>("scholarships"),
    announcements: db.collection<AnnouncementDoc>("announcements"),
    reactions: db.collection<ReactionDoc>("reactions"),
    reports: db.collection<ReportDoc>("reports"),
  };
}

let indexesEnsured = false;
/** Idempotent; called lazily on first auth so a fresh database works without running a script. */
export async function ensureIndexes() {
  if (indexesEnsured) return;
  const c = await collections();
  const results = await Promise.allSettled([
    c.users.createIndex({ email: 1 }, { unique: true }),
    c.opportunities.createIndex({ urlKey: 1 }, { unique: true, partialFilterExpression: { urlKey: { $type: "string" } } }),
    c.opportunities.createIndex({ createdAt: -1 }),
    c.matches.createIndex({ userId: 1, kind: 1, targetId: 1 }, { unique: true }),
    c.matches.createIndex({ kind: 1, targetId: 1, score: -1 }),
    c.rates.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.llmLog.createIndex({ at: 1 }, { expireAfterSeconds: 14 * 24 * 3600 }),
    c.users.createIndex({ status: 1 }),
    c.emailCodes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.emailCodes.createIndex({ email: 1, purpose: 1 }),
    c.oneTimeTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.emailLog.createIndex({ at: 1 }, { expireAfterSeconds: 30 * 24 * 3600 }),
    c.users.createIndex({ onboarded: 1, status: 1 }),
    c.connectRequests.createIndex({ pairKey: 1 }, { unique: true, partialFilterExpression: { status: "pending" } }),
    c.connectRequests.createIndex({ to: 1, status: 1 }),
    c.connectRequests.createIndex({ from: 1, status: 1 }),
    c.notifications.createIndex({ userId: 1, createdAt: -1 }),
    c.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 120 * 24 * 3600 }),
    c.proposals.createIndex({ status: 1, createdAt: -1 }),
    c.proposals.createIndex({ proposedBy: 1 }),
    c.proposalMembers.createIndex({ proposalId: 1, userId: 1 }, { unique: true }),
    c.proposalMembers.createIndex({ userId: 1, status: 1 }),
    c.scholarships.createIndex({ userId: 1, updatedAt: -1 }),
    c.scholarships.createIndex({ stage: 1, deadline: 1 }),
    c.announcements.createIndex({ pinned: -1, createdAt: -1 }),
    c.reactions.createIndex({ announcementId: 1, userId: 1, emoji: 1 }, { unique: true }),
    c.reports.createIndex({ resolved: 1, createdAt: -1 }),
  ]);
  // One bad index (e.g. a conflicting old one) shouldn't stop sign-in; log it for the admin instead.
  results.forEach((r) => r.status === "rejected" && console.error("[db] index failed", r.reason));
  indexesEnsured = true;
}

export function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : null;
}

export { ObjectId };
