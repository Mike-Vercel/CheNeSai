import { QuestionEditor } from "@/features/admin/cms/questions/QuestionEditor";

export const metadata = { title: "Modifica domanda" };

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestionEditor key={id} id={id} />;
}
