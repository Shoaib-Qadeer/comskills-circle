import { requireTeam } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { parseVolunteerFilters, volunteerList } from "@/lib/volunteers";

/** Members open to volunteering, filtered (team and admins only). */
export const GET = route(async (req) => {
  await requireTeam();
  return json(await volunteerList(parseVolunteerFilters(req.url)));
});
