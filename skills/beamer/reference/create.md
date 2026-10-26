# Creating a deck (phased workflow)

### 2.2 `create [topic]`

**Collaborative, iterative lecture creation. Strict phase gates — never skip ahead.**

#### Phase 0: Material Analysis (if papers/materials provided)

**Read first, ask later.** Must understand the content before asking meaningful questions.

- Accept `.pdf`, `.md`, or mixed paper/material inputs.
- If Markdown is provided, use it as the primary semantic source for section hierarchy, equations, theorem statements, captions, references, and notation.
- If both Markdown and PDF are provided, use Markdown for structure/text understanding and use the PDF for figures, page context, visual reference, and extraction.
- If only a PDF is provided and parsing loses structure, ask whether the user can provide a Markdown conversion. Do not require or run a specific PDF-to-Markdown converter.
- Read the full paper/materials thoroughly
- Extract: core contribution, key techniques, main theorems, comparison with prior work
- Map notation conventions
- Identify the paper's logical structure and which parts are slide-worthy
- Internally note: prerequisite knowledge, natural section boundaries, what could be skipped or expanded

**Do NOT present results or ask questions yet — proceed directly to Phase 1.**

#### Phase 1: Needs Interview (MANDATORY — informed by Phase 0)

Conduct a **content-driven interview** via AskUserQuestion. The questions below are the **minimum required set** — you MUST also add paper-specific questions derived from Phase 0.

**Minimum required questions** (always ask):
1. **Duration**: How long is the presentation?
2. **Audience level**: Who are the listeners?

**Optional question** (ask when the talk is a journal club, defense, or user seems to want rehearsal support):
3. **Speaker notes**: Would you like speaker notes in the Presenter View? If yes, `\note{}` blocks will be added per frame with telegraphic talking points (key message, transition cue, anticipated questions). Requires adding `\setbeameroption{show notes on second screen=right}` to the preamble for dual-screen display.

**Content-driven questions** (derive from Phase 0, ask as many as needed):
- **Prerequisite knowledge**: List concrete technical dependencies identified in Phase 0. Ask which ones the audience knows. E.g., "The paper builds on sumcheck and polynomial commitments. Should I review these?" — not "familiar with basic algebra?".
- **Content scope**: Offer the paper's actual components as options. Ask which to emphasize, skip, or briefly mention.
- **Depth vs. breadth**: If the paper has both intuitive overview and detailed constructions, ask which the user prefers.
- **Paper-specific decisions**: E.g., if the paper compares two constructions, ask whether to present both equally or focus on one.

**Guidelines:**
- Options should come from the paper's actual content, not generic templates.
- 3-6 questions total; don't over-ask, don't under-ask.
- If something is obvious from context (e.g., user said "讨论班"), infer rather than ask.

**Slide count heuristic**: ~1 slide per 1.5-2 minutes.

**Timing allocation table:**

| Duration | Total slides | Intro/Motivation | Methods/Background | Core content | Summary/Conclusion |
|----------|-------------|------------------|-------------------|-------------|-------------------|
| 5min (lightning) | 5-7 | 1-2 | 0-1 | 2-3 | 1 |
| 10min (short) | 8-12 | 2 | 1-2 | 4-5 | 1 |
| 15min (conference) | 10-15 | 2-3 | 2-3 | 5-7 | 1-2 |
| 20min (seminar) | 13-18 | 3 | 2-3 | 6-9 | 2 |
| 45min (keynote) | 22-30 | 4-5 | 5-7 | 10-14 | 2-3 |
| 90min (lecture) | 45-60 | 5-6 | 8-12 | 25-35 | 3-4 |

**Talk-type specific tips:**

| Talk type | Key emphasis | Common mistake |
|-----------|-------------|----------------|
| Lightning (5min) | One core message, no background review | Cramming a full talk into 5 minutes |
| Conference (10-20min) | 1-2 key results, fast methods overview | Too much technical detail, no big picture |
| Seminar (45min) | Deep dive OK, but need visual rhythm | Wall-to-wall formulas without examples |
| Defense/Thesis | Demonstrate mastery, systematic coverage | Skipping motivation, rushing results |
| Journal club | Critical analysis, facilitate discussion | Summarizing without evaluating |
| Grant pitch | Significance → feasibility → impact | Too technical, not enough "why it matters" |

**Time distribution principle**: Spend 40-50% of time on core content (results/techniques). Max 3-4 consecutive theory-heavy slides before a worked example or visual break.

#### Phase 2: Structure Plan (GATE — user must approve before drafting)

Produce a **detailed outline**. For each section:
- Section title
- Number of slides allocated
- Key content points per slide (1-2 lines each)
- TikZ diagrams or figures planned (brief description)
- Notation to introduce

**Present the plan to the user.** Ask: structure OK? Expand/shrink/cut anything?

**Do NOT proceed to drafting until user approves.**

#### Phase 3: Draft (iterative, batched)

**This phase is the most critical. Follow all sub-rules strictly.**

##### 3a. Writing Style

- **Telegraphic keywords**, not full sentences. Exception: one framing sentence per slide to set context.
- **Formulas and analysis interleave tightly** — define a quantity, then immediately state its cost/property/implication on the same slide. Never isolate a formula on one slide and its analysis on the next.
- **No conversational hedging** — never write "wait, not exactly", "actually, let me clarify", or similar. If a point needs qualification, state it precisely from the start.
- **Use `\textbf{}` for key terms** on first introduction; use `\pos{...}` for positive properties, `\con{...}` for drawbacks/limitations, `\HL{...}` for key findings (defined in preamble).

##### 3a-2. Opening and Closing Strategies

**Opening slide (pick one strategy):**
- **Surprising statistic** — a counter-intuitive number that challenges assumptions
- **Provocative question** — something the audience cannot immediately answer
- **Real-world failure/problem** — "System X failed because..." → "How do we prevent this?"
- **Visual demonstration** — show the phenomenon before explaining it

The opening should create tension or curiosity that the rest of the talk resolves.

**Closing strategies:**
- **Call-back to opening** — revisit the opening question/problem, now answered (circular narrative)
- **3 key takeaways** — numbered, telegraphic, one slide. The audience remembers the last thing they see.
- **Open question / future direction** — leave the audience thinking, naturally invites Q&A
- **Never end on a bare "Thank You"** — the second-to-last content slide should deliver the lasting impression. The Thank You slide is a courtesy, not the conclusion.

##### 3b. Mathematical Slide Patterns

Each math-heavy slide should follow one of these patterns:

**Definition slide:**
```
[Framing sentence: why this definition matters]
[Formal definition in display math]
[Key properties / immediate consequences as 2-3 bullet items]
```

**Construction/Algorithm slide:**
```
[One-line goal statement]
[Core equation / algorithm steps]
[Complexity analysis: prover cost, verifier cost, soundness]
```

**Comparison slide:**
```
[Side-by-side table: prior work vs this work]
[1-2 lines highlighting the key difference]
```

**Insight/Remark slide (adds value beyond the paper):**
```
[Observation the paper doesn't emphasize, or a comparison with related work]
[Why this matters / what it implies]
```

Every slide must have a clear **takeaway** — the one thing the audience should remember.

**Theorem/Proof slide (for formal mathematical statements):**
```
[Framing sentence: informal statement of the result]
\begin{theorem}[Optional name]
  [Formal statement in display math]
\end{theorem}
[Key implication or "why this matters" as 1-2 bullets]
```
- Proof on the **next** slide (never cramming theorem + proof on one slide).
- For long proofs: show proof sketch (key steps only), put full proof in backup slides.
- Use `\begin{proof}[Proof sketch]` to signal abbreviated proofs.

**Cross-referencing between slides:**
- Label key slides with `\label{slide:construction}` inside the frame.
- Reference from other slides: `see Slide~\ref{slide:construction}` or clickable `\hyperlink{slide:construction}{\beamerbutton{Back to Construction}}`.
- Especially useful for Q&A — quickly jump back to a referenced result.
- In backup slides, always hyperlink back to the main slide that motivates them.

##### 3c. Content Density Constraints

**Upper bounds (per slide):**
- ≤ 7 bullet points or items
- ≤ 2 displayed equations (more → split)
- ≤ 5 new symbols introduced
- ≤ 2 colored boxes (alertblock/exampleblock)

**Lower bounds (per slide):**
- Each slide MUST contain at least one substantive element: a formula, diagram, table, theorem statement, or algorithm
- A slide with only ≤ 3 short text-only bullets is **too sparse** — merge with an adjacent slide or add a formula/diagram
- Pure text-only bullet slides should be ≤ 30% of the total deck

**Density self-check after each batch:**
- Count slides that have zero formulas/diagrams/tables → flag if > 30% of batch
- Count slides with ≤ 3 short items and no math → candidates for merging

##### 3d. Batch Workflow

- Work in batches of 5-10 slides, following the approved structure
- After each batch, **compile** (`xelatex -interaction=nonstopmode`) to catch errors early — fixing 2 issues in a 10-slide batch is far cheaper than fixing 12 issues in a 40-slide deck at Phase 5
- After each batch, self-check: notation consistency, density constraints, motivation-before-formalism
- Continue to next batch only after current batch compiles cleanly and passes self-check

##### 3e. Table Best Practices

- **Always center tables** — wrap every standalone table in `\begin{center}...\end{center}`. Left-aligned tables look misaligned on slides.
- **Never place a table immediately after the frame title** — themes like Madrid have a colored title bar whose bottom edge visually merges with `\toprule`, making the table appear embedded in the title. Always insert `\vspace{4pt}` (or introductory text) between the title and the first `\toprule`. The compiler emits **zero warnings** for this — it can only be caught by visual inspection.
- Always use `booktabs` (`\toprule`, `\midrule`, `\bottomrule`) — never vertical lines (`|`).
- Column alignment: numbers right-aligned (`r`), text left-aligned (`l`), short labels centered (`c`).
- Max 6-7 columns, 8-10 rows per slide. More → split across slides following these pagination rules:
  - Each continuation slide repeats the full header row (`\toprule` + header + `\midrule`).
  - Append " (cont'd)" to the frame title: `\frametitle{Results (cont'd)}`.
  - Split at logical row group boundaries (e.g., between algorithm families, dataset groups) — never mid-group.
  - Last page must have ≥3 data rows; if fewer, merge with the previous page.
  - Each page gets its own takeaway line below the table if the subset tells a different story.
- Use `\resizebox{\textwidth}{!}{...}` only as last resort — prefer reducing columns/rows first.
- Highlight key cells with `\cellcolor{positive!15}` or `\textbf{}` — draw the eye to the result.
- For comparison tables: bold the best result in each row/column.
- Caption below table in `\small`, or use the frame title as the implicit caption.

##### 3f. Algorithm and Code Display

- Pseudocode ≤ 10 lines per slide. If longer, split into "high-level overview" and "key subroutine" slides.
- Highlight the critical line(s): use `escapeinside` in listings or `\colorbox` in algorithm2e.
- Input/output clearly stated at the top of the algorithm.
- Use consistent naming: variables in math italic (`$x$`), functions in sans-serif or typewriter.
- For code (not pseudocode): `\ttfamily\small`, syntax highlighting via listings. Show only the relevant fragment — never dump an entire source file.

#### Phase 4: Figures

- TikZ diagrams in Beamer source (single source of truth)
- Apply TikZ quality standards (see Section 2.6)
- R/Python scripts if needed

**Data visualization guidelines (journal figures ≠ slide figures):**
- **Simplify ruthlessly** — remove minor gridlines, detailed legends (label directly on plot), secondary axes. Show only data supporting the current slide's point.
- **Enlarge everything** — axis labels ≥ 18pt, line width 2-4pt, marker size 8-12pt. If unreadable at 2-3 feet from laptop, it fails on a projector.
- **Direct labeling** — label lines/bars directly instead of using a separate legend. Reduces cognitive load.
- **One message per figure** — split multi-panel journal figures across multiple slides. Each slide shows one comparison.
- **Highlight the result** — key data in bold saturated color, comparison data in muted gray. Use `\textcolor{blue!70!black}{...}` for the key finding, gray for reference.
- **Color-blind safe palette** — prefer blue (`#0173B2`) + orange (`#DE8F05`) over red + green. Add line style differences (solid/dashed/dotted) as redundant encoding. In TikZ:
  ```latex
  \definecolor{cbBlue}{HTML}{0173B2}
  \definecolor{cbOrange}{HTML}{DE8F05}
  \definecolor{cbGreen}{HTML}{029E73}
  \definecolor{cbPurple}{HTML}{CC78BC}
  ```
- **Progressive disclosure** — for complex figures, build incrementally: axes → first dataset → comparison → annotation with finding. Use separate slides (not `\pause`).
- **Subfigures** — use `\begin{subfigure}{0.48\textwidth}` (requires `subcaption` package) for side-by-side panels in one frame. Each subfigure gets its own `\caption{(a) ...}`. Preferred over raw `\includegraphics` side-by-side when panels need individual captions. Max 2 subfigures per slide (4 panels = split across 2 slides).

**pgfplots for data-driven figures (preferred over manual TikZ for data):**

Use `pgfplots` whenever plotting numerical data. It handles axes, legends, scaling, and data loading automatically.

```latex
% Bar chart from inline data
\begin{tikzpicture}
\begin{axis}[
  ybar, bar width=12pt,
  xlabel={Method}, ylabel={Accuracy (\%)},
  symbolic x coords={Baseline, Ours, Oracle},
  xtick=data, ymin=0, ymax=100,
  nodes near coords, every node near coord/.append style={font=\small},
  width=0.85\textwidth, height=5cm
]
  \addplot coordinates {(Baseline,72) (Ours,89) (Oracle,95)};
\end{axis}
\end{tikzpicture}
```

```latex
% Line plot from CSV file
\begin{tikzpicture}
\begin{axis}[
  xlabel={Epoch}, ylabel={Loss},
  legend pos=north east, grid=major,
  width=0.85\textwidth, height=5cm
]
  \addplot table[x=epoch, y=train_loss, col sep=comma] {data/results.csv};
  \addplot table[x=epoch, y=val_loss, col sep=comma] {data/results.csv};
  \legend{Train, Validation}
\end{axis}
\end{tikzpicture}
```

```latex
% Scatter plot with error bars
\begin{axis}[xlabel={$x$}, ylabel={$y$}]
  \addplot+[only marks, error bars/.cd, y dir=both, y explicit]
    coordinates {(1,2)+-(0,0.3) (2,3.5)+-(0,0.5) (3,5.1)+-(0,0.4)};
\end{axis}
```

- Always set explicit `width` and `height` to prevent overflow.
- Use `\addplot table[col sep=comma]{file.csv}` to load data from file — keeps .tex clean.
- For presentation: enlarge tick labels (`tick label style={font=\small}`), thicken lines (`thick`), use semantic colors (`color=positive`).

#### Phase 5: Quality Loop (MANDATORY — iterative)

After completing the full draft, enter the quality loop:

```
┌─→ 5a. Compile (2-pass XeLaTeX)
│   5b. Self-Review (structure + content + visual)
│   5c. Score (apply rubric)
│   5d. Fix all issues found
└── If score < 90 and round < 3: loop back to 5a
    If score ≥ 90 or round = 3: report to user
```

**5a. Compilation**
- 2-pass XeLaTeX compilation (bibtex not needed here — already resolved in Phase 3 batch compiles)
- Check: errors, overfull hbox, undefined references
- Open PDF for visual inspection

**5b. Self-Review** — re-read the .tex and verify:

*Structure:*
- [ ] Slide count matches plan (±2 tolerance)
- [ ] Logical flow: motivation → background → technique → results → summary
- [ ] No section has >4 consecutive formal slides without a worked example or visual break
- [ ] Transition sentences between major sections

*Content density:*
- [ ] No slide has only ≤3 short bullets with no math/diagram
- [ ] Pure text-only slides ≤ 30% of deck
- [ ] No slide exceeds upper bounds (7 bullets, 2 equations, 5 symbols, 2 boxes)

*TikZ and visuals:*
- [ ] No label-label or label-curve overlaps
- [ ] No content overflowing slide boundary
- [ ] **No content overflowing inside colored boxes** (alertblock/exampleblock/block have ~85% effective width; visually verify every box in PDF)
- [ ] **TikZ diagram fits within remaining slide space** — for mixed slides (text + diagram), verify the diagram's bounding box height + text height ≤ ~70mm. Common failure: large TikZ `scale` + multiple equations above = diagram clipped at bottom
- [ ] **All marked points lie on their curves** — for every `\fill`, `\node`, or `\draw` endpoint that should be on a plotted curve, verify the y-coordinate is computed via `\pgfmathsetmacro` from the same function, NOT hardcoded. Visually check in PDF that dots/markers visually sit on the curve line
- [ ] **Dashed reference lines terminate at the curve** — vertical/horizontal guide lines should end exactly where they meet the curve, not at arbitrary y-values
- [ ] Tables fit within slide width
- [ ] All standalone tables are centered (`\begin{center}...\end{center}`)
- [ ] No table's `\toprule` visually merges with the title bar (add `\vspace{4pt}` or text before first table)
- [ ] Font sizes in TikZ ≥ `\footnotesize`
- [ ] Consistent styling across all diagrams

*Notation:*
- [ ] Same symbol used consistently throughout
- [ ] Every symbol defined before use

**5c. Quality Score**

Start at 100. Deduct:

| Severity | Issue | Deduction |
|----------|-------|-----------|
| Critical | Compilation failure | -100 |
| Critical | Equation overflow (slide or box-interior) | -20 |
| Critical | TikZ diagram overflows slide boundary (clipped at bottom/right) | -15 per diagram |
| Critical | Undefined control sequence / citation | -15 |
| Critical | Overfull hbox > 10pt | -10 |
| Major | Content overflow inside colored box (vertical or horizontal, visual-only) | -10 per box |
| Major | TikZ marked points not on curve (hardcoded y-values instead of computed) | -8 per diagram |
| Major | Sparse slide (≤3 items, no math/diagram) | -5 per slide |
| Major | TikZ label overlap | -5 |
| Major | Missing references slide | -5 |
| Major | Table not centered (standalone table without `\begin{center}`) | -3 per table |
| Major | Table `\toprule` visually merged with title bar (no spacing after frame title) | -5 per slide |
| Major | Notation inconsistency | -3 |
| Minor | `\vspace` overuse (>3 per slide) | -1 |
| Minor | Font size reduction (`\footnotesize` etc.) | -1 per slide |

**Thresholds:**
- **≥ 90**: Ready to deliver. Report to user.
- **80-89**: Acceptable. Fix remaining majors if possible, report with caveats.
- **< 80**: Must fix. Loop back and resolve critical/major issues.

**5d. Fix** — fix all critical and major issues. Re-compile. If score improves to ≥ 90, exit loop. Max 3 rounds to avoid infinite loops.

#### Post-Creation Checklist (final gate)
```
[ ] Compiles without errors
[ ] No overfull hbox > 10pt
[ ] All citations resolve
[ ] Score ≥ 90
[ ] Every definition has motivation + worked example
[ ] Max 2 colored boxes per slide
[ ] No sparse slides (all slides have substantive content)
[ ] TikZ diagrams visually verified — no overlaps, no overflow, all marked points on curves
[ ] Tables fit within slide boundaries, are centered, and separated from title bar
[ ] No content overflow inside colored boxes (visual PDF check)
[ ] References slide present (second-to-last, before Thank You)
```
