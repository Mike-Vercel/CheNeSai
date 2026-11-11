"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Panel, Textarea, useToast } from "@/components/ui";
import { api } from "@/lib/realtime/api-client";
import { errorMessage, fieldErrors } from "../api";
import { InfoNote, LinkButton, PageHeader, Segmented } from "../common";
import { downloadText } from "../format";
import type { ImportReport } from "../types";

const JSON_EXAMPLE = `{
  "format": "quizzone-questions",
  "version": 1,
  "questions": [
    {
      "type": "single",
      "text": "Qual è la capitale dell'Australia?",
      "category": "Geografia",
      "difficulty": 2,
      "tags": ["capitali", "oceania"],
      "presenter": "professore",
      "answers": ["Sydney", "Canberra", "Melbourne", "Perth"],
      "correct": [1],
      "durationSeconds": 15,
      "notes": "Fonte: sito ufficiale del governo australiano"
    },
    {
      "type": "multiple",
      "text": "Quali di questi sono pianeti del Sistema solare?",
      "category": "Scienza",
      "difficulty": 3,
      "tags": ["spazio"],
      "presenter": "regina",
      "answers": ["Marte", "Plutone", "Venere", "Cerere"],
      "correct": [0, 2],
      "durationSeconds": 25,
      "notes": "Fonte: IAU 2006, Plutone e Cerere sono pianeti nani"
    }
  ]
}
`;

const CSV_EXAMPLE = `tipo;testo;categoria;difficolta;presentatore;A;B;C;D;corrette;durata;tag
singola;Qual è la capitale dell'Australia?;Geografia;2;professore;Sydney;Canberra;Melbourne;Perth;B;20;capitali|oceania
multipla;Quali di questi sono pianeti del Sistema solare?;Scienza;3;regina;Marte;Plutone;Venere;Cerere;A|C;25;spazio
`;

const CHATGPT_PROMPT = `Sei un autore di quiz per una serata al pub ("CHE NE SAI?!"). Genera 20 domande di cultura generale in italiano sull'argomento: [SCRIVI QUI L'ARGOMENTO].

Regole:
- Ogni domanda ha ESATTAMENTE 4 risposte, tutte diverse tra loro, brevi (max 120 caratteri).
- "type": "single" = una sola risposta corretta; "multiple" = almeno 2 risposte corrette.
- "correct" contiene gli indici (0 = prima risposta, 3 = quarta) delle risposte corrette.
- "difficulty" da 1 (facilissima) a 5 (difficilissima); mescola le difficoltà.
- "presenter" è uno tra "professore", "regina", "palmino".
- Testo della domanda max 400 caratteri, chiaro e senza ambiguità; categoria max 60 caratteri.
- Varia la posizione della risposta corretta.
- In "notes" indica SEMPRE la fonte usata per verificare la risposta.
- Non inventare fatti: se non sei sicuro di una risposta, non includere quella domanda.

Rispondi SOLO con un JSON valido, senza testo prima o dopo, esattamente in questo formato:
{ "format": "quizzone-questions", "version": 1, "questions": [ { "type": "single", "text": "...", "category": "...", "difficulty": 2, "tags": [], "presenter": "professore", "answers": ["A","B","C","D"], "correct": [0], "durationSeconds": 15, "notes": "fonte..." } ] }`;

type Format = "json" | "csv";

function detect(text: string): Format {
  const t = text.trimStart();
  return t.startsWith("{") || t.startsWith("[") ? "json" : "csv";
}

function countRows(text: string, format: Format): number | null {
  if (format === "json") {
    try {
      const v: unknown = JSON.parse(text);
      if (Array.isArray(v)) return v.length;
      if (v && typeof v === "object" && Array.isArray((v as { questions?: unknown }).questions)) return (v as { questions: unknown[] }).questions.length;
      return null;
    } catch {
      return null;
    }
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return 0;
  const head = lines[0].toLowerCase();
  return head.includes("testo") || head.includes("text") ? lines.length - 1 : lines.length;
}

export function ImportQuestions() {
  const toast = useToast();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<(ImportReport & { total: number | null; dry: boolean }) | null>(null);
  const [busy, setBusy] = useState<"dry" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [helpTab, setHelpTab] = useState<Format | "prompt">("prompt");
  const format = detect(text);

  async function call(dry: boolean) {
    if (!text.trim()) return;
    setError(null);
    let parsed: unknown = null;
    if (format === "json") {
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        setError(`Il JSON non è valido: ${e instanceof Error ? e.message : "errore di sintassi"}. Controlla virgole e parentesi.`);
        return;
      }
    }
    setBusy(dry ? "dry" : "import");
    try {
      const url = `/api/admin/questions/import${dry ? "?dry=1" : ""}`;
      const r =
        format === "json"
          ? await api<ImportReport>(url, { method: "POST", json: parsed, timeoutMs: 60000 })
          : await api<ImportReport>(url, { method: "POST", body: text, headers: { "Content-Type": "text/csv; charset=utf-8" }, timeoutMs: 60000 });
      setReport({ ...r, total: r.total ?? countRows(text, format) ?? 0, dry });
      if (!dry) {
        toast("ok", `${r.imported} domande importate come bozze`);
        setText("");
        setFileName(null);
      }
    } catch (e) {
      const fe = fieldErrors(e);
      setError(Object.keys(fe).length ? `${errorMessage(e)}: ${Object.entries(fe).map(([k, v]) => `${k || "file"} ${v}`).join("; ")}` : errorMessage(e));
      setReport(null);
    } finally {
      setBusy(null);
    }
  }

  async function onFile(f: File | null) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setError("File troppo grande (max 5 MB)");
      return;
    }
    setText(await f.text());
    setFileName(f.name);
    setReport(null);
    setError(null);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(CHATGPT_PROMPT);
      toast("ok", "Prompt copiato negli appunti");
    } catch {
      toast("error", "Copia non riuscita: seleziona il testo e copialo a mano");
    }
  }

  const valid = report && report.total !== null ? Math.max(0, report.total - report.errors.length) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/admin/questions", label: "Domande" }}
        title="Importa domande"
        subtitle="Da file JSON o CSV, anche generati con ChatGPT"
        actions={
          <>
            <LinkButton href="/api/admin/questions/export?format=json" download>
              ⬇ Esporta tutto JSON
            </LinkButton>
            <LinkButton href="/api/admin/questions/export?format=csv" download>
              ⬇ Esporta tutto CSV
            </LinkButton>
          </>
        }
      />

      <InfoNote tone="warn">
        Le domande importate entrano <strong>sempre come bozze</strong> con la risposta corretta <strong>da confermare</strong>. Prima di usarle in una serata
        controlla ogni risposta (soprattutto se generata da un&apos;intelligenza artificiale) e confermala dalla lista{" "}
        <Link href="/admin/questions?status=draft" className="font-bold underline">
          Da confermare
        </Link>
        .
      </InfoNote>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="1 · Incolla o carica il file">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border-2 border-white/10 bg-white/5 px-4 text-[15px] font-extrabold hover:bg-white/10">
                📂 Scegli file .json / .csv
                <input type="file" accept=".json,.csv,.txt,application/json,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              </label>
              {fileName && <span className="text-sm text-white/60">{fileName}</span>}
              {text.trim() && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold">Formato rilevato: {format.toUpperCase()}</span>}
            </div>
            <Textarea
              aria-label="Contenuto da importare"
              className="min-h-72 font-mono text-xs"
              placeholder={'Incolla qui il JSON { "format": "quizzone-questions", … } oppure il CSV con intestazione tipo;testo;categoria;…'}
              value={text}
              spellCheck={false}
              onChange={(e) => {
                setText(e.target.value);
                setReport(null);
              }}
            />
            {error && <InfoNote tone="danger">{error}</InfoNote>}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={!text.trim()} loading={busy === "dry"} onClick={() => call(true)}>
                Verifica (prova senza salvare)
              </Button>
              <Button variant="gold" disabled={!report || !report.dry || busy !== null || valid === 0} loading={busy === "import"} onClick={() => call(false)}>
                Importa {valid !== null && report?.dry ? `${valid} domande` : ""}
              </Button>
            </div>
            <p className="text-xs text-white/50">Prima esegui la verifica: l&apos;importazione salva solo le righe valide, quelle con errori vengono scartate.</p>

            {report && (
              <div className="space-y-2" aria-live="polite">
                {report.dry ? (
                  <InfoNote tone={report.errors.length ? "warn" : "ok"}>
                    Verifica completata: <strong>{valid ?? "?"} valide</strong>
                    {report.total !== null && ` su ${report.total}`}, <strong>{report.errors.length} con errori</strong>.
                  </InfoNote>
                ) : (
                  <InfoNote tone="ok">
                    Importate <strong>{report.imported}</strong> domande come bozze
                    {report.errors.length ? `, ${report.errors.length} scartate` : ""}.{" "}
                    <Link href="/admin/questions?status=draft" className="font-bold underline">
                      Vai a &laquo;Da confermare&raquo; →
                    </Link>
                  </InfoNote>
                )}
                {report.errors.length > 0 && (
                  <ul className="max-h-80 space-y-1.5 overflow-y-auto rounded-xl border border-flame/40 bg-[#3d0914]/40 p-3 text-sm">
                    {report.errors.map((e) => (
                      <li key={e.index}>
                        <p className="font-bold text-[#ffc2cd]">
                          Riga {e.index + 1}
                          {e.text ? `: «${e.text.slice(0, 80)}»` : ""}
                        </p>
                        <ul className="ml-4 list-disc text-xs text-white/75">
                          {e.issues.map((i, k) => (
                            <li key={k}>{i}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Panel>

        <Panel title="2 · Formato e prompt per ChatGPT">
          <Segmented
            label="Guida"
            value={helpTab}
            onChange={setHelpTab}
            options={[
              { value: "prompt", label: "Prompt ChatGPT" },
              { value: "json", label: "Formato JSON" },
              { value: "csv", label: "Formato CSV" },
            ]}
          />
          {helpTab === "prompt" && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-white/70">
                Copia questo testo in ChatGPT, sostituisci l&apos;argomento e incolla qui la risposta. Poi verifica una per una le risposte corrette.
              </p>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-[#0f0519] p-3 text-xs text-white/85">{CHATGPT_PROMPT}</pre>
              <Button variant="gold" onClick={copyPrompt}>
                📋 Copia il prompt
              </Button>
            </div>
          )}
          {helpTab === "json" && (
            <div className="mt-3 space-y-2 text-sm text-white/75">
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <code>type</code>: <code>single</code> (una corretta) o <code>multiple</code> (almeno due corrette)
                </li>
                <li>
                  <code>answers</code>: esattamente 4 risposte diverse; <code>correct</code>: indici 0–3 delle corrette
                </li>
                <li>
                  <code>difficulty</code> 1–5, <code>presenter</code> professore | regina | palmino, <code>durationSeconds</code> 3–120 (facoltativo)
                </li>
                <li>
                  Facoltativi: <code>tags</code>, <code>correctPoints</code>, <code>wrongPenalty</code>, <code>notes</code> (fonte)
                </li>
              </ul>
              <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-[#0f0519] p-3 text-xs text-white/85">{JSON_EXAMPLE}</pre>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => downloadText("esempio-quizzone.json", JSON_EXAMPLE)}>
                  ⬇ Scarica esempio JSON
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setText(JSON_EXAMPLE)}>
                  Usa l&apos;esempio
                </Button>
              </div>
            </div>
          )}
          {helpTab === "csv" && (
            <div className="mt-3 space-y-2 text-sm text-white/75">
              <p>
                Separatore <code>;</code> (anche <code>,</code>), prima riga di intestazione:
              </p>
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#0f0519] p-3 text-xs">tipo;testo;categoria;difficolta;presentatore;A;B;C;D;corrette;durata;tag</pre>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <code>tipo</code>: singola o multipla · <code>corrette</code>: lettere come <code>A</code> oppure <code>A|C</code>
                </li>
                <li>
                  <code>durata</code> in secondi (facoltativa) · <code>tag</code> separati da <code>|</code>
                </li>
                <li>Testi con punto e virgola vanno tra virgolette doppie. Excel: salva come &laquo;CSV UTF-8&raquo;.</li>
              </ul>
              <pre className="max-h-60 overflow-auto rounded-xl border border-white/10 bg-[#0f0519] p-3 text-xs text-white/85">{CSV_EXAMPLE}</pre>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => downloadText("esempio-quizzone.csv", "﻿" + CSV_EXAMPLE, "text/csv")}>
                  ⬇ Scarica esempio CSV
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setText(CSV_EXAMPLE)}>
                  Usa l&apos;esempio
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
