import { QuestionBank } from "@/features/admin/cms/questions/QuestionBank";

export const metadata = { title: "Domande" };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <QuestionBank initial={{ status: one(sp.status), category: one(sp.category), q: one(sp.q), tag: one(sp.tag) }} />;
}
