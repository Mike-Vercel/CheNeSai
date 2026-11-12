import { DisplayApp } from "@/features/giramente/DisplayApp";

export const metadata = { title: "Schermo" };

/** Schermo TV/PC pubblico: nessun account, chiave lunga e casuale, solo stato pubblico. ?live=1 = vista per la diretta. */
export default async function Schermo({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ live?: string }> }) {
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  return <DisplayApp displayKey={decodeURIComponent(key)} live={sp.live === "1"} />;
}
