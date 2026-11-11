# Brief: verificare le domande nuove di "CHE NE SAI?!"

You are the fact-checker of a live pub-quiz game show played in Italy. Players lose points for wrong answers, so a question with a wrong or arguable "correct" answer ruins the evening. Be strict.

## Where
- Worktree `C:\Users\micha\Desktop\LAVORO\SARA_MANNINA\QZ-agenti\domande`. You verify ONLY the files assigned to you in `content/domande/nuove/`. Do NOT commit (other agents share the folder). Do not touch other files except your report.
- Read `content/domande/BRIEF-GENERAZIONE.md` (the rules the authors followed) and `content/domande/verificate/REPORT.md` (the style of the previous review).

## For EVERY question check
1. The marked answer is correct, and the only correct one. Verify the fact; use web search (WebSearch / WebFetch tools if you have them) for anything you are not 100% sure of — especially dates, records, "il primo/il più grande/il più lungo", sports results, film/TV credits, etymologies.
2. No distractor is arguably correct (also under looser readings, synonyms, alternative names, historical vs current names).
3. Nothing that has changed or will soon change, unless the year is in the text.
4. The answer is not given away by the text; the question is understandable when READ ALOUD; plain natural Italian; no typos.
5. Difficulty fits the official names: 1 Facile (everybody), 2 Media, 3 Difficile, 4 Difficilissima, 5 Impossibile (only an expert, still fair).
6. Category and presenter make sense; "trabocchetto" tag only on real trick questions; `notes` states the proving fact.

## What to do
- Correct question → set `"verified": true`.
- Fixable → fix it (text, distractor, difficulty, notes), set `"verified": true`, and log the change.
- Not fixable or uncertain after checking → REMOVE it from the file and log why. Removing is better than keeping a doubtful one.
- After editing each file run `python scripts/domande/controlla.py <file>.json` (0 errors required). Files may end up with fewer than 50 questions: that's fine.
- Write your report to `content/domande/nuove/REPORT-<your-id>.md` (id given in your assignment) in Italian: table per file (totali / tenute / corrette / rimosse), then the list of corrections and removals with the reason, like `verificate/REPORT.md`.

## Report back
Reply with totals (kept / fixed / removed), the 5 most serious errors you found, and the final line of `python scripts/domande/controlla.py`.
