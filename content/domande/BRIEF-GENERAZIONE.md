# Brief: generare domande per "CHE NE SAI?!"

You write multiple-choice quiz questions in Italian for "CHE NE SAI?!", a live pub-quiz game show played in Italy (Sicily) by groups of friends on their phones while three 3D presenters read questions aloud on a TV: the Professore (pedantic, cultured), the Regina (diva, glamorous) and Palmino (a cheerful Sicilian palm tree).

## Where and how
- Work ONLY in `C:\Users\micha\Desktop\LAVORO\SARA_MANNINA\QZ-agenti\domande` (git worktree). Write files ONLY in `content/domande/nuove/`. Do NOT commit (several agents share this folder; the coordinator commits). Do not touch any other file.
- One file per 50 questions, named `<slug>-<NN>.json` (e.g. `storia-01.json`, `storia-02.json`). Slugs: arte, cinema, cucina, curiosita, geografia, letteratura, lingua-italiana, musica, natura-e-animali, scienza, sport, storia, tecnologia, tv-e-spettacolo.
- File format (exactly):
```json
{ "format": "quizzone-questions", "version": 1, "questions": [
  { "type": "single", "text": "…?", "category": "Storia", "difficulty": 3, "presenter": "professore",
    "answers": ["…", "…", "…", "…"], "correct": [2], "tags": ["…"], "notes": "fact + source/explanation", "verified": false }
] }
```
- Category names (exact): Arte, Cinema, Cucina, Curiosità, Geografia, Letteratura, Lingua italiana, Musica, Natura e animali, Scienza, Sport, Storia, Tecnologia, TV e spettacolo.
- Before writing, read 2–3 existing files in `content/domande/verificate/` (same categories) and `content/domande/verificate/REPORT.md` to see the style, the level and the kind of mistakes the reviewer fixed.
- After EVERY file run `python scripts/domande/controlla.py <file>.json` and fix every error (duplicates and near-duplicates of existing questions included: rewrite or replace them). At the end run `python scripts/domande/controlla.py` with no arguments; it must report 0 errors for your files.

## Quality rules (the whole game depends on them)
1. Exactly ONE indisputably correct answer. If you are not sure of a fact, do not use it. No questions whose answer changed recently or will change soon (current record holders, "attuale presidente", latest winners, populations with exact figures): use stable, historical facts, or put the year in the text ("Chi vinse i Mondiali di calcio del 2006?").
2. Distractors plausible, same type and format as the correct answer (all years, all cities, all names of painters…), none of them arguably correct, none jokingly absurd except rarely in easy questions. Vary the position of the correct answer (roughly 25% each index).
3. The correct answer must not appear in or be guessable from the text. No "tutte le precedenti / nessuna".
4. Text: natural spoken Italian (it is READ ALOUD by TTS), short (ideally < 120 characters, max 220), ends with "?". Avoid abbreviations, symbols, formulas and Roman numerals in text and answers when possible (TTS reads them badly); write numbers in digits only when they are years or simple quantities. Answers max 60 characters, ideally 1–4 words.
5. Mix: about 20% difficulty 1 (everyone knows), 30% difficulty 2, 25% difficulty 3, 17% difficulty 4, 8% difficulty 5 (hard but fair, answerable by an enthusiast). Mix "serious" questions with "trabocchetto" ones (trick questions where the obvious answer is wrong, e.g. "Di che colore è la scatola nera degli aerei?" → arancione) — about 15% trick questions, tagged "trabocchetto". Plenty of Italian topics (Italy, Sicily, Italian pop culture, Italian TV, Serie A, Italian cuisine and language) alongside world topics: roughly 50/50.
6. No offensive, political-partisan, tragic-recent or sensitive content; nothing about living private persons; no brand advertising. Never the word "tesori".
7. Presenter: professore for history/science/literature/language-ish, regina for cinema/TV/fashion/music/art, palmino for food/sport/curiosities/nature/Sicily — mix when it fits.
8. `notes`: one short line with the fact that proves the answer (and a source name when useful), so a reviewer can verify it fast. `tags`: 1–3 lowercase topic tags (+ "trabocchetto" when it applies).
9. Inside each category spread sub-topics widely (e.g. Storia: antica, medievale, moderna, contemporanea, italiana, mondiale; Sport: calcio, ciclismo, F1, tennis, olimpiadi, basket, regole…) and avoid near-identical questions across your own files.

## Report back
When done reply with: files written, questions per category and per difficulty, how many trick questions, any question you dropped as uncertain, and the final output line of `python scripts/domande/controlla.py`.
