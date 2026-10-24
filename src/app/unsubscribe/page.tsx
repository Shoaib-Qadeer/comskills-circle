import { UnsubscribeView } from "@/components/UnsubscribeView";

export const metadata = { title: "Unsubscribe" };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ u?: string; s?: string }> }) {
  const { u = "", s = "" } = await searchParams;
  return <UnsubscribeView u={u} s={s} />;
}
