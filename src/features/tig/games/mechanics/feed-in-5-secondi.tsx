"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { likesText, type FeedReveal, type FeedView, type Post } from "@/lib/tig/games/mechanics/feed-in-5-secondi";
import type { OptionSubmission } from "@/lib/tig/games/mechanics/m1/common";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit, WatchTv } from "../kit/ui";
import { ArtSvg } from "./m1/art";

type P = PlayerGameProps<FeedView, null, OptionSubmission, FeedReveal>;
type T = TvGameProps<FeedView, FeedReveal>;

/** Cuore dei «mi piace» (disegnato, non preso da app reali). */
function Heart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 20.5C6.5 16.4 3 13.3 3 9.3 3 6.6 5.1 4.5 7.7 4.5c1.7 0 3.3.9 4.3 2.3 1-1.4 2.6-2.3 4.3-2.3 2.6 0 4.7 2.1 4.7 4.8 0 4-3.5 7.1-9 11.2z" fill="#ff3b4e" />
    </svg>
  );
}

/**
 * Un post inventato. Tutte le misure sono in unità del contenitore (cqw = 1% della larghezza del post):
 * la stessa scheda funziona in TV e sul telefono.
 */
function PostCard({ post, index, mark = false, className }: { post: Post; index: number; mark?: boolean; className?: string }) {
  const initials = post.author.replace("@", "").slice(0, 2).toUpperCase();
  return (
    <article
      className={clsx("@container overflow-hidden rounded-[1rem] border-2 bg-[#0f131b]", mark ? "border-[#c6ff3d] shadow-[0_0_40px_-8px_rgba(198,255,61,0.7)]" : "border-white/12", className)}
      aria-label={`Post ${index + 1} di ${post.author}, ${post.place}, ${post.ago} fa, ${post.likes} mi piace: ${post.caption}. Foto: ${post.alt}`}
    >
      <header className="flex items-center gap-[3cqw] px-[4cqw] py-[3cqw]">
        <span className="tg-num grid h-[11cqw] w-[11cqw] shrink-0 place-items-center rounded-full bg-[#2a3242] text-[5cqw] text-[#c6ff3d]">{initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[5.6cqw] font-extrabold leading-tight">{post.author}</span>
          <span className="block truncate text-[4.4cqw] font-semibold leading-tight text-white/60">
            {post.place} · {post.ago}
          </span>
        </span>
        <span className="tg-num shrink-0 rounded-md bg-white/10 px-[2cqw] text-[4.4cqw] text-white/70">{index + 1}/5</span>
      </header>
      <ArtSvg art={post.art} label={post.alt} className="block aspect-square w-full" />
      <footer className="flex flex-col gap-[1.5cqw] px-[4cqw] py-[3cqw]">
        <span className="flex items-center gap-[2cqw] text-[5.4cqw] font-extrabold">
          <Heart className="h-[6.5cqw] w-[6.5cqw]" /> {likesText(post.likes)} mi piace
        </span>
        <span className="line-clamp-2 text-[4.8cqw] font-semibold leading-snug text-white/85">{post.caption}</span>
      </footer>
    </article>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ optionId: picked });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <PostCard post={reveal.posts[reveal.post]} index={reveal.post} mark className="mx-auto w-full max-w-[420px]" />
        <Panel className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={view.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Tutto il feed">
          {reveal.posts.map((post, i) => (i === reveal.post ? null : <PostCard key={post.author} post={post} index={i} className="opacity-80" />))}
        </div>
      </PlayerFrame>
    );
  }

  if (p.stage === "play" && elapsed < view.endMs) {
    return (
      <PlayerFrame view={view} p={p}>
        <WatchTv untilMs={view.endMs} elapsed={elapsed} what="Cinque post scorrono in TV: account, luogo, like, foto. Occhi aperti." />
        {view.posts && (
          <ol className="sr-only">
            {view.posts.map((post, i) => (
              <li key={post.author}>
                Post {i + 1}: {post.author}, {post.place}, {post.ago}, {post.likes} mi piace. {post.caption}. Foto: {post.alt}
              </li>
            ))}
          </ol>
        )}
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="Invia la risposta" />}
    >
      <Panel className="flex flex-col gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#c6ff3d]">Il feed è sparito</p>
        <p className="text-2xl font-extrabold leading-snug">{view.prompt}</p>
        <ChoiceList label="Risposte" options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} big />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play", 100);
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);

  if (p.stage === "reveal" && reveal) {
    return (
      <TvFrame view={view} p={p} subtitle={`La domanda era sul post ${reveal.post + 1} di 5`}>
        <div className="grid h-full grid-cols-[0.8fr_1.2fr] gap-[2cqw]">
          <div className="relative h-full min-h-0" style={{ containerType: "size" }}>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: "min(100cqw, 68.5cqh)", height: "min(146cqw, 100cqh)" }}>
              <PostCard post={reveal.posts[reveal.post]} index={reveal.post} mark className="tg-pop h-full w-full" />
            </div>
          </div>
          <div className="flex min-h-0 flex-col justify-center gap-[1.2cqw]">
            <TvPanel className="flex flex-col gap-[0.8cqw]">
              <p className="text-[2cqw] font-extrabold leading-tight">{reveal.prompt}</p>
              {view.options.map((o, i) => (
                <TvOption key={o.id} index={i} text={o.text} size="sm" state={o.id === reveal.solutionId ? "right" : "dim"} />
              ))}
            </TvPanel>
            <TvExplain text={reveal.explain} />
          </div>
        </div>
      </TvFrame>
    );
  }

  const feedOn = p.stage === "play" && elapsed < view.endMs && view.posts;
  if (feedOn) {
    const started = elapsed >= view.startMs;
    const idx = Math.min(4, Math.max(0, Math.floor((elapsed - view.startMs) / view.postMs)));
    const lead = Math.max(1, Math.ceil((view.startMs - elapsed) / 500));
    return (
      <TvFrame view={view} p={p} hideTimer subtitle="Cinque post, poco più di un secondo l'uno. Guardate i particolari.">
        <div className="grid h-full grid-cols-[1fr_1.3fr_1fr] items-center gap-[3cqw]">
          <div className="flex flex-col items-end gap-[1cqw]">
            <p className="tg-display text-[2.4cqw] text-white/70">Post</p>
            <p className="tg-num text-[11cqw] leading-none text-[#c6ff3d]" aria-live="polite">{started ? idx + 1 : 0}</p>
            <p className="tg-display text-[2.4cqw] text-white/70">di 5</p>
          </div>
          {/* colonna «a misura»: la finestra del feed (proporzioni di un post) si adatta a larghezza e altezza */}
          <div className="relative h-full" style={{ containerType: "size" }}>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.2rem]" style={{ width: "min(100cqw, 68.5cqh)", height: "min(146cqw, 100cqh)" }}>
              {started ? (
                <div className="absolute inset-x-0 top-0 transition-transform duration-300 ease-out" style={{ transform: `translateY(-${idx * 20}%)`, height: "500%" }}>
                  {view.posts!.map((post, i) => (
                    <div key={post.author} className="h-[20%] w-full">
                      <PostCard post={post} index={i} className="h-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tg-glass tg-glass-lime grid h-full place-items-center">
                  <div className="text-center">
                    <p className="tg-display text-[8cqw] text-white/80">Il feed parte tra</p>
                    <p className="tg-num tg-pop text-[30cqw] leading-none text-[#c6ff3d]" key={lead}>
                      {lead}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-[0.8cqw]" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={clsx("h-[1.2cqw] w-[9cqw] rounded-full transition-colors", started && i <= idx ? "bg-[#c6ff3d]" : "bg-white/15")} />
            ))}
          </div>
        </div>
      </TvFrame>
    );
  }

  return (
    <TvFrame view={view} p={p} subtitle="Il feed è sparito. Una domanda sola: rispondete dal telefono.">
      <div className="flex h-full flex-col items-center justify-center gap-[1.6cqw]">
        <p className="tg-rise max-w-[80cqw] text-center text-[3cqw] font-extrabold leading-tight">{view.prompt}</p>
        <div className="grid w-full max-w-[84cqw] grid-cols-2 gap-[1cqw]">
          {view.options.map((o, i) => (
            <TvOption key={o.id} index={i} text={o.text} />
          ))}
        </div>
      </div>
    </TvFrame>
  );
}

export const feedIn5SecondiUi = defineUi(Player, Tv);
