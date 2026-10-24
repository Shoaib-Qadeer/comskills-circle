import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { buildMapHubs } from "../src/lib/community-map";

const a = new ObjectId(), b = new ObjectId(), t = new ObjectId(), p1 = new ObjectId(), p2 = new ObjectId();
const people = [
  { _id: a, name: "A", fields: ["bioinformatics", "ai-ml"], batch: "b1", role: "participant" as const, isAdmin: false },
  { _id: b, name: "B", fields: ["ai-ml"], batch: null, role: "participant" as const, isAdmin: false },
  { _id: t, name: "T", fields: ["education"], batch: "b1", role: "team" as const, isAdmin: false },
];
const projects = [
  { _id: p1, title: "Crop genomes", status: "in_progress" as const, proposedBy: a },
  { _id: p2, title: "Done one", status: "completed" as const, proposedBy: b },
];

describe("community map hubs", () => {
  const { hubsOf, lenses } = buildMapHubs(people as never, projects, new Map([[String(p1), [String(b)]]]), (id) => (id === "b1" ? "Batch 1" : null));
  it("field hubs count members, biggest first", () => {
    expect(lenses.field[0]).toMatchObject({ id: "ai-ml", count: 2 });
  });
  it("team members get the team hub instead of their batch; no batch has its own hub", () => {
    expect(hubsOf.get(String(t))!.batch).toEqual(["team"]);
    expect(hubsOf.get(String(b))!.batch).toEqual(["none"]);
    expect(lenses.batch.find((h) => h.id === "b:b1")).toMatchObject({ label: "Batch 1", count: 1 });
  });
  it("project hubs: proposer + accepted members of active projects only", () => {
    expect(lenses.project).toHaveLength(1);
    expect(lenses.project[0]).toMatchObject({ label: "Crop genomes", count: 2 });
    expect(hubsOf.get(String(b))!.project).toEqual([`p:${p1}`]);
    expect(hubsOf.get(String(t))!.project).toEqual([]);
  });
});
