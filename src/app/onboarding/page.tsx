import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { HOME_PATH } from "@/lib/auth-messages";
import { meDTO } from "@/lib/serialize";
import { getSettings } from "@/lib/settings";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "approved") redirect("/pending");
  if (user.onboarded) redirect(HOME_PATH);
  return <OnboardingWizard me={meDTO(user, await getSettings())} />;
}
