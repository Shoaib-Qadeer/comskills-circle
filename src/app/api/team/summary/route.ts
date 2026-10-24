import { requireTeam } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { parseFilters, teamScholarshipData } from "@/lib/team";

/** Scholarship summary for the Comskills team (team members and admins only). */
export const GET = route(async (req) => {
  const user = await requireTeam();
  return json(await teamScholarshipData(parseFilters(req.url), user._id));
});
