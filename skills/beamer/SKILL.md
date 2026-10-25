---
name: beamer
description: House rules for Beamer slide decks.
---

# Beamer slides

These rules apply to every Beamer deck. Longer guides live next to this file; read one only when the task needs it:

- `reference/create.md` for building a new deck from scratch or from a paper
- `reference/review.md` for proofreading, audits and pedagogical review
- `reference/tikz.md` for diagrams
- `reference/checks.md` for multi-pass compiles, timing and figure extraction

## 0. REFERENCE PREAMBLE

When creating new slides, use this as the default preamble unless the user has a custom template.

```latex
\documentclass[aspectratio=169,10pt]{beamer}

\usetheme{Madrid}
% Madrid draws shadows that emit "Missing character" warnings under XeTeX; turn them off
\setbeamertemplate{blocks}[rounded][shadow=false]
\setbeamertemplate{title page}[default][colsep=-4bp,rounded=true,shadow=false]
\usecolortheme{default}
\setbeamertemplate{navigation symbols}{}
\setbeamertemplate{footline}[frame number]

\usepackage{amsmath,amssymb,amsthm,booktabs,mathtools}
\usepackage{stmaryrd}  % for \llbracket, \rrbracket
\usepackage{graphicx}  % for \includegraphics (extracted figures)
\usepackage{hyperref}
\usepackage{tikz}
\usetikzlibrary{arrows.meta,positioning,decorations.pathreplacing}

% Semantic colors — use in BOTH text and TikZ for global consistency
\definecolor{positive}{HTML}{0173B2}       % blue (correct, advantage)
\definecolor{negative}{HTML}{DE8F05}       % orange (limitation, drawback)
\definecolor{emphasis}{HTML}{029E73}        % green (highlight, key finding)
\definecolor{neutral}{gray}{0.55}          % muted context
\definecolor{cbPurple}{HTML}{CC78BC}        % additional accent
\newcommand{\pos}[1]{\textcolor{positive}{#1}}
\newcommand{\con}[1]{\textcolor{negative}{#1}}
\newcommand{\HL}[1]{\textcolor{emphasis}{#1}}
```

**Rules:**
- **Always `10pt`** — `11pt` or `12pt` produces oversized, sparse slides.
- **Always `aspectratio=169`** — modern projectors are 16:9.
- If user provides a custom preamble, header file, or theme: use theirs.
- Add domain-specific macros (e.g. `\newcommand{\F}{\mathbb{F}}`) as needed.
- **Algorithm/code packages** (add only when needed):
  - Algorithms: `\usepackage[ruled,lined]{algorithm2e}` — set `\SetAlgoLined`, `\DontPrintSemicolon`
  - Code listings: `\usepackage{listings}` — set `basicstyle=\ttfamily\small`, `keywordstyle=\bfseries\color{positive}`, `commentstyle=\color{neutral}`. Max 10 lines of code per slide; highlight key lines with `escapeinside={(*@}{@*)}` and `\colorbox`.
  - Pseudocode: `\usepackage{algorithmic}` — simpler than algorithm2e, suitable for short procedures.
- **Data plotting** (add only when needed):
  - `\usepackage{pgfplots}` + `\pgfplotsset{compat=1.18}` — data-driven plots (bar, scatter, error bars, histograms). Far more efficient than manual TikZ coordinate plots for data visualization.
  - `\usepackage{subcaption}` — multiple subfigures in one frame via `\begin{subfigure}{0.48\textwidth}`.
- **Theorem environments**: Beamer provides `theorem`, `lemma`, `corollary`, `definition`, `example`, `proof` out of the box (styled by the theme). Use them for formal statements — they get automatic numbering and consistent styling. Customize with `\setbeamertemplate{theorems}[numbered]` or `[ams style]`.


## 1. HARD RULES (Non-Negotiable)

1. **No overlays** — never use `\pause`, `\onslide`, `\only`, `\uncover`. Use multiple slides for progressive builds, color emphasis for attention. **Common replacement patterns:**
   - *Progressive formula build-up*: slide A shows the base equation, slide B copies it and adds the next term (grayed-out terms from slide A stay as context). Copy-paste the full frame and extend.
   - *Step-by-step list reveal*: slide A shows items 1-2, slide B shows 1-4 (items 1-2 repeated). Use `\textcolor{neutral}{}` on previously-shown items to mute them.
   - *Diagram incremental build*: slide A shows the base structure, slide B adds annotations/edges. Duplicate the `tikzpicture` and append new elements — never delete prior elements.
2. **Max 2 colored boxes per slide** — more dilutes emphasis. Demote transitional remarks to plain italic.
3. **Motivation before formalism** — every concept starts with "Why?" before "What?".
4. **Worked example within 2 slides** of every definition.
5. **XeLaTeX only** — never pdflatex.
6. **Beamer .tex is the single source of truth** — TikZ diagrams, content, notation all originate here.
7. **Verify after every task** — compile, check warnings, open PDF.
8. **Telegraphic style** — keyword phrases, not full sentences. Slides are speaker prompts, not manuscripts. Exception: framing sentences that set up a definition or transition. Each bullet item should be ≤2 lines (~15 words) — if longer, split into sub-items or rewrite more concisely.
9. **Every slide earns its place** — each slide must contain at least one substantive element (formula, diagram, table, theorem, or algorithm). A slide with only 3 short bullets and nothing else must be merged or enriched.
10. **Box-interior overflow guard** — `alertblock`, `exampleblock`, and `block` environments add internal padding (~15% less width, ~12-16pt extra height for title bar + vertical padding). Content that fits on a bare slide can overflow inside a box in **both directions**. Rules:
    - **Vertical overflow** (most common, hardest to detect): display math (`\[ \]`) + text below it inside a single box easily exceeds vertical capacity. Limit box content to **one display equation OR 2-3 short bullet items** — not both. Never use aggressive `\vspace{-Xpt}` inside a box; it pulls bottom content past the border.
    - **Horizontal overflow**: never use `\qquad` inside a box; use `\quad` or `,`. If a display equation is wider than ~70% of `\textwidth` on a bare slide, reformat before placing inside a box.
    - **Beamer suppresses overfull warnings inside blocks** — zero compile warnings does NOT guarantee no visual overflow. Always visually verify every box in the PDF.
11. **Reference slide** — the second-to-last slide (before Thank You) must be a **References** slide listing key cited works. Use `\begin{thebibliography}{9}` with `\small`. Include the primary paper and 3-5 most relevant references.
12. **Color and contrast standards** — text-background contrast ratio ≥ 4.5:1 (WCAG AA). Never use red+green for binary contrasts (color blindness affects ~8% of men). Prefer blue+orange. Semantic color commands defined in preamble: `\pos{}` = positive/correct (blue), `\con{}` = negative/limitation (orange), `\HL{}` = emphasis/key finding (green), `\textcolor{neutral}{}` = de-emphasized. These are color-blind safe. Limit total palette to 3-5 colors.
13. **Visual hierarchy in font sizes** — slide title: 20-24pt (beamer default), key findings/theorems: normal size with `\textbf`, supporting text: normal, labels/captions: `\small` minimum. Never use `\tiny` for any user-facing content.
14. **Backup slides** — after the Thank You slide, include 3-5 backup slides for anticipated questions. Use `\appendix` before backup section. Separate from main deck with a `\begin{frame}{Backup Slides}\end{frame}` divider. Backup slides should NOT count toward the timing allocation. **Content to include** (derive from Phase 0 material analysis):
    - Full proof of the main theorem (if only a sketch was shown in the main deck)
    - Parameter choices / security analysis details (for crypto/protocol papers)
    - Extended comparison table with additional baselines
    - Experimental setup details (hardware, hyperparameters, datasets)
    - Definitions of prerequisites that were assumed known (in case someone asks)
15. **Columns layout** — use `\begin{columns}[T]` + `\column{W\textwidth}` for side-by-side content. Rules:
    - Comparison / parallel content: two columns at `0.48\textwidth` each (leave 0.04 gap).
    - Figure + text: figure column `0.45-0.55`, text column `0.40-0.50`, gap `0.05`.
    - Three columns maximum: each `≤ 0.30\textwidth`, only for short items (icons, stats, one-liners).
    - Never nest columns inside columns.
    - Always use `[T]` (top-align) unless deliberately centering.
    - Columns content follows the same density constraints as regular slides.

## 3. VERIFICATION PROTOCOL

**Every task ends with verification.** Non-negotiable.

```
[ ] Compiled without errors (xelatex exit code 0)
[ ] No overfull hbox > 10pt
[ ] All citations resolve
[ ] PDF opens and renders correctly
[ ] Visual spot-check of modified slides
```


## 5. TROUBLESHOOTING

**Error:** `! Undefined control sequence. \llbracket`
**Cause:** Missing `stmaryrd` package for double brackets.
**Fix:** Add `\usepackage{stmaryrd}` to preamble. Or define `\newcommand{\llbracket}{[\![}` as fallback.

**Error:** `Overfull \vbox` on a specific slide
**Cause:** Too much content for the frame height.
**Fix priority:**
1. Reduce `\vspace` values
2. Shorten text (telegraphic style)
3. Split into two slides
4. Use `\small` on one element (not the whole slide)
5. Last resort: `\footnotesize` (never `\tiny`)

**Error:** `Font "XXX" not found` with XeLaTeX
**Cause:** System font not installed, or wrong font name.
**Fix:** Use `fc-list | grep "FontName"` to check available fonts. Fall back to default Latin Modern if custom font unavailable.

**Error:** Equations overflow slide width
**Cause:** Long multi-term equation.
**Fix priority:**
1. Use `\begin{align}` with line breaks at natural points (`=`, `+`)
2. Introduce intermediate variables to shorten expressions
3. Use `\resizebox{\textwidth}{!}{...}` as last resort (degrades readability)

**Error:** PDF images don't render in Quarto/web
**Cause:** Browsers cannot display PDF inline.
**Fix:** Convert to SVG: `pdf2svg input.pdf output.svg`. Never use PNG for diagrams (raster = blurry).

**Error:** Content visually overflows inside `alertblock`/`exampleblock`/`block` but compiler reports 0 warnings
**Cause:** Beamer suppresses overflow warnings inside block environments. Two distinct failure modes:
- *Vertical*: display math + text below it exceeds the box's vertical capacity; bottom content spills past the lower border. Aggravated by `\vspace{-Xpt}`.
- *Horizontal*: the block's internal padding reduces effective width by ~15%, so wide equations overflow sideways.
**Fix priority (vertical — most common):**
1. Remove or reduce `\vspace{-Xpt}` inside the box
2. Keep box content minimal: one display equation OR a few bullet items, not both
3. Move explanatory text below the equation to outside the box (plain text after `\end{...block}`)
4. Split into two separate boxes or slides
**Fix priority (horizontal):**
1. Replace `\qquad` with `\quad` or `,`
2. Move secondary notation (e.g., sampling arrows) to a separate line
3. Break the equation with `\\` at natural points
4. Move the equation outside the box
**Never rely on compile warnings alone** — always visually verify every colored box in the PDF.
