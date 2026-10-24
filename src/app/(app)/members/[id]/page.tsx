import { MemberProfile } from "@/components/members/MemberProfile";

export const metadata = { title: "Member" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberProfile id={id} />;
}
