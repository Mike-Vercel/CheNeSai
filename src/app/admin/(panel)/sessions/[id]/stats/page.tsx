import { SessionStats } from "@/features/admin/cms/stats/SessionStats";

export const metadata = { title: "Statistiche serata" };

export default async function SessionStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionStats key={id} id={id} />;
}
