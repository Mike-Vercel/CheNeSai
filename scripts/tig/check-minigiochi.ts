/**
 * Controllo rapido dei contenuti di TAVOLI IN GUERRA!: `npx tsx scripts/tig/check-minigiochi.ts [codice…]`.
 * Valida ogni variante con il `contentSchema` della meccanica, controlla id unici e regole brevi,
 * e prova `publicView`/`score` con tre tavoli finti. Senza argomenti controlla tutte le meccaniche.
 */
import { MECHANIC_MODULES } from "../../src/lib/tig/games/mechanics";
import type { PhaseCtx } from "../../src/lib/tig/games/contract";

async function main() {
  const wanted = process.argv.slice(2);
  let bad = 0;
  for (const m of MECHANIC_MODULES) {
    if (wanted.length && !wanted.includes(m.def.code)) continue;
    let raw: unknown[] = [];
    try {
      raw = (await import(`../../content/tig/minigiochi/${m.def.code}.ts`)).default as unknown[];
    } catch (e) {
      console.log(`✗ ${m.def.code}: file contenuti mancante (${(e as Error).message.split("\n")[0]})`);
      bad++;
      continue;
    }
    const ids = new Set<string>();
    raw.forEach((v, i) => {
      const r = m.def.contentSchema.safeParse(v);
      if (!r.success) {
        bad++;
        console.log(`✗ ${m.def.code}[${i}] ${(v as { id?: string }).id ?? ""}\n  ${r.error.message.replace(/\n/g, "\n  ")}`);
        return;
      }
      const id = (r.data as { id: string }).id;
      if (ids.has(id)) {
        bad++;
        console.log(`✗ ${m.def.code}: id duplicato ${id}`);
      }
      ids.add(id);
      const ctx: PhaseCtx = {
        gameInstanceId: "g",
        startsAt: 0,
        deadlineAt: m.def.timerSec * 1000,
        teams: [1, 2, 3].map((n) => ({ teamId: `t${n}`, tableNo: n, members: [`t${n}a`, `t${n}b`, `t${n}c`], captainId: `t${n}a` })),
        participants: ["t1", "t2", "t3"],
        seed: `check-${id}`,
      };
      m.def.publicView(r.data, ctx);
      const subs = m.extras.demoSubmissions(r.data, ctx, "check");
      const out = m.def.score({ content: r.data, ctx, submissions: subs });
      m.def.reveal(r.data, out);
    });
    console.log(`${m.def.code}: ${raw.length} varianti${m.def.rule.length > 140 ? ` · REGOLA TROPPO LUNGA (${m.def.rule.length})` : ""}`);
  }
  if (bad) {
    console.log(`\n${bad} problemi`);
    process.exit(1);
  }
  console.log("\nTutto valido.");
}

void main();
