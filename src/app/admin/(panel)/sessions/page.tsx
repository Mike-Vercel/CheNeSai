import { SessionsList } from "@/features/admin/cms/sessions/SessionsList";

export const metadata = { title: "Serate" };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <SessionsList openCreate={sp.new === "1"} />;
}
