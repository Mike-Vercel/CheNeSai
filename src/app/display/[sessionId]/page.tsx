import { DisplayClient } from "@/features/display/DisplayClient";

export const metadata = { title: "Schermo TV" };

export default async function DisplayPage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ k?: string }> }) {
  const { sessionId } = await params;
  const { k } = await searchParams;
  if (!k) {
    return (
      <main className="grid min-h-dvh place-items-center p-8 text-center">
        <p className="max-w-lg text-xl font-bold text-white/80">Apri lo schermo TV dal pannello di regia: il link contiene la chiave dello schermo.</p>
      </main>
    );
  }
  return <DisplayClient sessionId={sessionId} displayKey={k} />;
}
