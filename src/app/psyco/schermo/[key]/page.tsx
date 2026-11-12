import { DisplayApp } from "@/features/psyco/DisplayApp";

export const metadata = { title: "Schermo" };

/** Schermo pubblico TV/PC: nessun account, chiave lunga e casuale, solo stato pubblico. */
export default async function Schermo({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <DisplayApp displayKey={decodeURIComponent(key)} />;
}
