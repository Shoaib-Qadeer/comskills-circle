import { requireTeam } from "@/lib/auth";
import { route } from "@/lib/api";
import { csvResponse } from "@/lib/csv";
import { STAGE_LABEL } from "@/lib/scholarships";
import { parseFilters, teamScholarshipData } from "@/lib/team";

/** CSV of the (filtered) scholarship entries, for the team's spreadsheets. */
export const GET = route(async (req) => {
  const user = await requireTeam();
  const d = await teamScholarshipData(parseFilters(req.url), user._id);
  return csvResponse(
    "comskills-scholarships.csv",
    ["member", "batch", "scholarship", "country", "stage", "deadline", "submitted", "expected result", "rejected on", "lesson", "programme", "university", "start date", "rejection visible to", "ok to announce", "announced", "link", "last updated"],
    d.entries.map((e) => [
      e.owner?.name ?? "",
      e.ownerBatch ?? "",
      e.name,
      e.country,
      STAGE_LABEL[e.stage],
      e.deadline ?? "",
      e.submittedAt ?? "",
      e.expectedResultAt ?? "",
      e.rejectedAt ?? "",
      e.lesson ?? "",
      e.programme ?? "",
      e.university ?? "",
      e.startDate ?? "",
      e.stage === "rejected" ? (e.rejectedVisibility === "members" ? "all members" : "team only") : "",
      e.announceConsent ? "yes" : "",
      e.announcedAt ? e.announcedAt.slice(0, 10) : "",
      e.link ?? "",
      e.updatedAt.slice(0, 10),
    ]),
  );
});
