import { CommunityMapLoader } from "@/components/members/CommunityMapLoader";
import { MembersTabs } from "@/components/members/MembersTabs";

export const metadata = { title: "Community map" };

export default function MapPage() {
  return (
    <div>
      <MembersTabs active="map" />
      <CommunityMapLoader />
    </div>
  );
}
