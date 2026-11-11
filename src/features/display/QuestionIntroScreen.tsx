"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import type { PublicQuestion, PublicRound } from "@/lib/game-engine/types";
import { Logo } from "@/features/game/components/brand";
import { questionMoment } from "@/features/game/moment";
import { TvFrame } from "./TvScreens";

/**
 * Cartello "DOMANDA N. X" prima di ogni domanda (TV 16:9, show verticale, /tv): grande, al centro,
 * con il round in piccolo. Sull'ultima domanda del round un'etichetta in più; sull'ultima della
 * serata luci basse, occhio di bue che pulsa e "ULTIMA DOMANDA!" (con il rullo di tamburi).
 * Resta in scena mentre l'annunciatore dice il numero, poi compare la domanda (vedi DisplayApp).
 */
export function QuestionIntroScreen({ question: q, round, portrait = false }: { question: PublicQuestion; round: PublicRound | null; portrait?: boolean }) {
  const m = questionMoment({ question: q, round });
  const big = portrait ? "text-[17cqw]" : "text-[17cqh]";
  const mid = portrait ? "text-[8cqw]" : "text-[6.4cqh]";
  const small = portrait ? "text-[4.4cqw]" : "text-[3.2cqh]";
  return (
    <TvFrame calm>
      <div className={clsx("absolute left-1/2 z-20 -translate-x-1/2", portrait ? "top-[5cqh]" : "top-[3cqh]")}>
        <Logo size="tv" className={portrait ? "!h-[9cqh]" : "!h-[14cqh]"} />
      </div>

      {/* ultima domanda della serata: luci basse e occhio di bue che pulsa */}
      {m.lastOfGame && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            style={{ background: "radial-gradient(circle at 50% 52%, rgba(255,214,90,.22) 0, rgba(5,0,12,.78) 34%, rgba(5,0,12,.94) 100%)" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10"
            animate={{ opacity: [0.25, 0.7, 0.25], scale: [0.96, 1.04, 0.96] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            style={{ background: "radial-gradient(circle at 50% 52%, rgba(255,226,120,.28) 0, transparent 26%)" }}
          />
        </>
      )}

      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-[4cqw] text-center" data-testid="question-intro">
        {round && (
          <motion.p
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className={clsx("mb-[1.6cqh] font-display uppercase tracking-[0.08em] text-white/80", small)}
          >
            Round {round.index} · {round.title}
          </motion.p>
        )}

        {m.lastOfGame ? (
          <>
            <motion.p
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.08, 1], opacity: 1 }}
              transition={{ duration: 0.7, times: [0, 0.7, 1] }}
              className={clsx("font-display leading-none text-gold [text-shadow:0_0_5cqh_rgba(255,200,40,.75),0_0.8cqh_0_#6b1020]", portrait ? "text-[15cqw]" : "text-[15cqh]")}
            >
              ULTIMA DOMANDA!
            </motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className={clsx("mt-[2cqh] font-display text-white", mid)}>
              Domanda n. {q.number}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ delay: 0.8, duration: 1.4, repeat: Infinity }}
              className={clsx("mt-[1.2cqh] font-extrabold text-white/85", small)}
            >
              Tutto può ancora cambiare…
            </motion.p>
          </>
        ) : (
          <>
            <motion.p
              key={q.id}
              initial={{ scale: 0.55, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 190, damping: 14 }}
              className={clsx("font-display leading-[0.95] text-white [text-shadow:0_0.9cqh_0_#6b1020,0_0_4cqh_rgba(255,61,110,.45)]", big)}
            >
              DOMANDA
              <br />
              <span className="text-gold">N. {q.number}</span>
            </motion.p>
            {m.lastOfRound && (
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [0.6, 1.1, 1], opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.5 }}
                className={clsx(
                  "mt-[2.4cqh] rounded-full border-[0.5cqh] border-gold bg-[#ff3d6e] px-[3cqh] py-[0.8cqh] font-display text-white shadow-[0_0.6cqh_0_#6b1020]",
                  portrait ? "text-[6cqw]" : "text-[4.4cqh]",
                )}
              >
                ULTIMA DOMANDA DEL ROUND
              </motion.span>
            )}
          </>
        )}
      </div>
    </TvFrame>
  );
}
