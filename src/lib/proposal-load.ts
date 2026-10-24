import { ApiError } from "./auth";
import { collections, toObjectId } from "./db";
import type { ProposalDoc, UserDoc } from "./types";

/** Loads a proposal by id or throws 404. */
export async function loadProposal(id: string): Promise<ProposalDoc> {
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Project not found.");
  const { proposals } = await collections();
  const p = await proposals.findOne({ _id: oid });
  if (!p) throw new ApiError(404, "Project not found. It may have been deleted.");
  return p;
}

/** The proposer, or an admin. */
export function assertCanManage(p: ProposalDoc, user: Pick<UserDoc, "_id" | "isAdmin">) {
  const own = p.proposedBy && String(p.proposedBy) === String(user._id);
  if (!own && !user.isAdmin) throw new ApiError(403, "Only the person who proposed this project can do that.");
}
