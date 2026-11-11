import postgres from "postgres";

/**
 * Connessione Postgres server-side (mai esposta al browser).
 * In produzione usare la stringa del pooler Supabase in "transaction mode"
 * (porta 6543): per questo i prepared statement sono disabilitati.
 */
declare global {
  var __qzSql: postgres.Sql | undefined;
}

function createClient(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL non configurata");
  return postgres(url, {
    prepare: false,
    // Mai meno di 10 per istanza: su Vercel una stessa istanza serve in parallelo TV, telefoni e
    // passi automatici; con 3 collegamenti un comando in transazione che chiede un'altra query
    // poteva aspettare per sempre un collegamento libero (partita bloccata).
    max: Math.max(10, Number(process.env.DATABASE_POOL_MAX ?? 10) || 10),
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { application_name: "quizzone" },
    // int8 (bigint) come number: versioni e id restano ben sotto 2^53.
    types: {
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: number) => x.toString(),
        parse: (x: string) => Number(x),
      },
    },
    onnotice: () => {},
  });
}

export function getSql(): postgres.Sql {
  if (!globalThis.__qzSql) globalThis.__qzSql = createClient();
  return globalThis.__qzSql;
}

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;
/** Qualsiasi esecutore di query: connessione principale o transazione. */
export type Db = postgres.Sql | postgres.TransactionSql;

export function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}
