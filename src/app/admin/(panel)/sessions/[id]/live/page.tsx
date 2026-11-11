import { LiveControl } from "@/features/admin/live/LiveControl";

export const metadata = { title: "Regia live" };

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveControl sessionId={id} />;
}
