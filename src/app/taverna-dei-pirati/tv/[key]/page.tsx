import { TvApp } from "@/features/tig/tv/TvApp";

export const metadata = { title: "TV" };

/** TV del locale: nessun account, chiave lunga e casuale, solo stato pubblico. `?live=1` = vista per la diretta (niente QR né codici). */
export default async function TigTv({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ live?: string }> }) {
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  return <TvApp displayKey={decodeURIComponent(key)} live={sp.live === "1"} />;
}
