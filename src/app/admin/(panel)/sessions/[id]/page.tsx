import { SessionEditor } from "@/features/admin/cms/editor/SessionEditor";

export const metadata = { title: "Editor serata" };

export default async function SessionEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionEditor key={id} id={id} />;
}
