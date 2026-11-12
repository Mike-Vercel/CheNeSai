import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { db } from "./psyco-helpers";

/**
 * Aiuti per i test end-to-end di GIRAMENTE!: le partite si giocano DAVVERO dall'interfaccia
 * (clic, tasti 1–4/Invio, campi di testo); dal database si leggono solo la fase (per sapere cosa
 * fare) e le soluzioni (per rispondere giusto o sbagliato apposta).
 */
export const GM_SHOTS = process.env.GIRAMENTE_SHOTS_DIR ?? path.join("test-results", "giramente-shots");
mkdirSync(GM_SHOTS, { recursive: true });
export async function gmShot(page: Page, name: string) {
  await page.screenshot({ path: path.join(GM_SHOTS, `${name}.png`) });
}

export interface RoomInfo {
  id: string;
  phase: string;
  round_no: number;
  stage: string | null;
  current_play_id: string | null;
  turn_order: string[];
  turn_index: number;
  devices: string;
  display_key: string;
  code: string;
  paused_at: Date | null;
}

export async function roomInfo(roomId: string): Promise<RoomInfo> {
  const sql = db();
  try {
    const [r] = await sql<RoomInfo[]>`select id, phase, round_no, stage, current_play_id, turn_order, turn_index, devices, display_key, code, paused_at from giramente_rooms where id = ${roomId}`;
    return r;
  } finally {
    await sql.end();
  }
}

export interface PlayInfo {
  id: string;
  competitor_id: string;
  stage: string;
  status: string;
  jolly_offer: boolean;
  jolly_chosen: string | null;
  colpo_offered: boolean;
  colpo_accepted: boolean | null;
  pool: string | null;
  answer_index: number | null;
  solution: string | null;
  false_index: number | null;
}

export async function plays(roomId: string, where: "current" | "open", currentId?: string | null): Promise<PlayInfo[]> {
  const sql = db();
  try {
    return where === "current"
      ? await sql<PlayInfo[]>`
          select p.id, p.competitor_id, p.stage, p.status, p.jolly_offer, p.jolly_chosen, p.colpo_offered, p.colpo_accepted, z.pool, z.answer_index, z.solution, z.false_index
          from giramente_plays p left join giramente_puzzles z on z.id = p.puzzle_id where p.id = ${currentId ?? null}`
      : await sql<PlayInfo[]>`
          select p.id, p.competitor_id, p.stage, p.status, p.jolly_offer, p.jolly_chosen, p.colpo_offered, p.colpo_accepted, z.pool, z.answer_index, z.solution, z.false_index
          from giramente_plays p left join giramente_puzzles z on z.id = p.puzzle_id where p.room_id = ${roomId} and p.status = 'open' order by p.turn_no`;
  } finally {
    await sql.end();
  }
}

export async function competitorIds(roomId: string): Promise<{ id: string; name: string }[]> {
  const sql = db();
  try {
    return await sql<{ id: string; name: string }[]>`select id, name from giramente_competitors where room_id = ${roomId} and active order by seat`;
  } finally {
    await sql.end();
  }
}

const safe = async (p: Promise<unknown>) => {
  try {
    await p;
    return true;
  } catch {
    return false;
  }
};

export interface DriveOpts {
  roomId: string;
  host: Page;
  /** pagina che agisce per ciascun concorrente (dispositivo condiviso: sempre la stessa) */
  pageFor: (competitorId: string) => Page;
  /** il concorrente risponde giusto? */
  correct: (competitorId: string, round: number) => boolean;
  /** usa i tasti (PC) invece dei clic */
  keyboard?: (page: Page) => boolean;
  /** foto alle prime occorrenze di ogni momento */
  onPhase?: (r: RoomInfo, seen: number) => Promise<void>;
  maxMs?: number;
}

/** Gioca la partita dall'interfaccia finché arriva la fase FINAL. */
export async function driveUi(o: DriveOpts): Promise<void> {
  const until = Date.now() + (o.maxMs ?? 600_000);
  const seen = new Map<string, number>();
  let lastKey = "";
  let stuck = 0;
  while (Date.now() < until) {
    const r = await roomInfo(o.roomId);
    if (r.phase === "FINAL") return;
    const key = `${r.phase}:${r.round_no}:${r.stage}:${r.turn_index}:${r.current_play_id}`;
    if (key !== lastKey) {
      const n = (seen.get(`${r.phase}:${r.round_no}:${r.stage}`) ?? 0) + 1;
      seen.set(`${r.phase}:${r.round_no}:${r.stage}`, n);
      if (o.onPhase) await o.onPhase(r, n);
      lastKey = key;
      stuck = 0;
    } else stuck++;
    const t = 8000;
    switch (r.phase) {
      case "INTRO":
      case "ROUND_INTRO":
      case "TURN_RESULT":
      case "REVEAL":
      case "ROUND_RESULTS":
        await safe(o.host.getByRole("button", { name: "AVANTI ›" }).click({ timeout: t }));
        break;
      case "CHOICE": {
        const p = o.pageFor(r.turn_order[r.turn_index]);
        if (o.keyboard?.(p)) {
          await safe(p.getByRole("button", { name: /VERDE/ }).waitFor({ timeout: t }));
          await p.keyboard.press(r.round_no === 3 ? "2" : "1");
        } else await safe(p.getByRole("button", { name: /VERDE/ }).click({ timeout: t }));
        break;
      }
      case "SPIN": {
        const p = o.pageFor(r.turn_order[r.turn_index]);
        if (o.keyboard?.(p)) {
          await safe(p.getByRole("button", { name: /GIRA!/ }).waitFor({ timeout: t }));
          await p.keyboard.press("Enter");
        } else await safe(p.getByRole("button", { name: /GIRA!/ }).click({ timeout: t }));
        break;
      }
      case "SPINNING":
        await o.host.waitForTimeout(1500);
        break;
      case "WHEEL_RESULT": {
        const [pl] = await plays(o.roomId, "current", r.current_play_id);
        const p = o.pageFor(pl.competitor_id);
        if (pl.jolly_offer && !pl.jolly_chosen) await safe(p.getByRole("button", { name: /OCCHIO FURBO/ }).click({ timeout: t }));
        else if (pl.colpo_offered && pl.colpo_accepted === null) await safe(p.getByRole("button", { name: /ACCETTO/ }).click({ timeout: t }));
        else await safe(o.host.getByRole("button", { name: "AVANTI ›" }).click({ timeout: 4000 }));
        break;
      }
      case "QUESTION": {
        const [pl] = await plays(o.roomId, "current", r.current_play_id);
        const p = o.pageFor(pl.competitor_id);
        const ok = o.correct(pl.competitor_id, r.round_no);
        if (pl.pool === "ruota") {
          const idx = ok ? pl.answer_index! : (pl.answer_index! + 1) % 4;
          if (o.keyboard?.(p)) {
            await safe(p.locator(".gm-option").first().waitFor({ timeout: t }));
            await p.keyboard.press(String(idx + 1));
          } else await safe(p.locator(".gm-option").nth(idx).click({ timeout: t }));
        } else {
          const input = p.getByLabel("La tua risposta");
          if (await safe(input.fill(ok ? pl.solution!.toLowerCase() : "non lo so", { timeout: t }))) {
            if (o.keyboard?.(p)) await input.press("Enter");
            else await safe(p.getByRole("button", { name: /CONFERMA/ }).click({ timeout: t }));
          }
        }
        break;
      }
      case "TURN_READY":
        await safe(o.host.getByRole("button", { name: /— INIZIA/ }).click({ timeout: t }));
        break;
      case "PLAY": {
        const open = await plays(o.roomId, "open");
        for (const pl of open) {
          const p = o.pageFor(pl.competitor_id);
          const ok = o.correct(pl.competitor_id, r.round_no);
          const form = p.locator(`form:has(#sol-${pl.id})`);
          if (!(await safe(form.waitFor({ timeout: t })))) continue;
          if (pl.stage === "falsa") await safe(form.locator(".gm-option").nth(ok ? pl.false_index! : (pl.false_index! + 1) % 4).click({ timeout: t }));
          await safe(form.locator(`#sol-${pl.id}`).fill(ok ? pl.solution!.toLowerCase() : "boh", { timeout: t }));
          await safe(form.getByRole("button", { name: pl.stage === "tabellone" ? "RISOLVI" : "CONFERMA" }).click({ timeout: t }));
          await safe(form.waitFor({ state: "detached", timeout: t }));
        }
        break;
      }
      default:
        await o.host.waitForTimeout(500);
    }
    if (stuck > 40) throw new Error(`partita ferma in ${key}`);
    await o.host.waitForTimeout(250);
  }
  throw new Error("partita troppo lunga");
}

export async function expectNoSolutionOnScreen(page: Page, solutions: string[]) {
  const text = (await page.locator("body").innerText()).toUpperCase();
  for (const s of solutions) if (s && s.length > 3) expect(text.includes(s.toUpperCase()), `soluzione visibile: ${s}`).toBe(false);
}
