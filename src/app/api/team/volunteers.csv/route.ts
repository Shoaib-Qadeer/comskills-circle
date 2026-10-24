import { requireTeam } from "@/lib/auth";
import { route } from "@/lib/api";
import { csvResponse } from "@/lib/csv";
import { appUrl } from "@/lib/mail";
import { parseVolunteerFilters, volunteerList } from "@/lib/volunteers";

const FOR_LABEL = { comskills: "Comskills", other: "Other causes", both: "Both" } as const;

/** CSV of the filtered volunteer list. */
export const GET = route(async (req) => {
  await requireTeam();
  const { items } = await volunteerList(parseVolunteerFilters(req.url));
  return csvResponse(
    "comskills-volunteers.csv",
    ["member", "batch", "field of study", "open to volunteer", "for", "areas", "hours per month", "profile"],
    items.map((v) => [v.name, v.batch ?? "", v.fieldOfStudy, v.open ? "yes" : "no", v.for ? FOR_LABEL[v.for] : "", v.areas.join("; "), v.hoursPerMonth ?? "", appUrl(`/members/${v.id}`)]),
  );
});
