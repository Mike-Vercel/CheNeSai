import { Rehearsal } from "@/features/admin/live/Rehearsal";

export const metadata = { title: "Prova generale" };

export default async function RehearsalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Rehearsal sessionId={id} />;
}
