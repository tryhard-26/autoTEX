---
name: latex
description: House rules for LaTeX documents (articles, reports, theses, letters, CVs).
---

# LaTeX documents

These rules apply to every non-Beamer document. For slides, follow the beamer skill instead.

## Key LaTeX Patterns

### Escaping Special Characters

Always escape: `%` → `\%`, `$` → `\$`, `&` → `\&`, `#` → `\#`, `_` → `\_`

**Angle brackets in text mode:** `<` and `>` are NOT valid in LaTeX text mode with T1 encoding. They render as inverted question marks (¡ or ¿). Always use math mode or text commands:
- `<5%` → `$<$5\%` or `\textless 5\%`
- `>50` → `$>$50` or `\textgreater 50`
- `<$300` → `$<$\$300`
- `>=` → `$\geq$`, `<=` → `$\leq$`

This is one of the most common silent errors in generated LaTeX — the document compiles without errors but the PDF shows garbage characters.

Date ranges use en-dash: `2019--2025` (double hyphen).

### Standard Preamble

```latex
\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{geometry}
\usepackage{hyperref}
\usepackage{xcolor}
\usepackage{graphicx}
\usepackage{tabularx}
\usepackage{colortbl}
\usepackage{enumitem}
\usepackage{titlesec}
```

## Package dependencies

These cause `Undefined control sequence` -- always include the required package:

| If you use... | You MUST include | Error without it |
|---|---|---|
| `\rowcolor{}` | `\usepackage{colortbl}` | Undefined control sequence `\rowcolor` |
| `\url{}` in .bib with natbib | `\usepackage{url}` | Undefined control sequence `\url` |
| `\checkmark` | `\usepackage{amssymb}` | Undefined control sequence `\checkmark` |
| `\begin{figure}[H]` | `\usepackage{float}` | Unknown float option `H` |
| `\rowcolors{}{}{}` | `\usepackage[table]{xcolor}` or `\usepackage{colortbl}` | Undefined control sequence |

## Figures and hyperref

- `\begin{figure}[H]` needs `\usepackage{float}`. Size figures and TikZ at 0.75–0.85\textwidth.
- `hyperref` is fine for normal documents; load it near the end of the preamble.

## Long documents (5+ pages)

- Prefer prose over bullet lists; vary section formats instead of repeating one pattern.
- Keep lists compact (`enumitem` with `nosep` or `itemsep=2pt`).
- Don't scatter `\newpage`; let LaTeX break pages.
- Escape `<` and `>` in text (see above); they are the most common silent error.

## Choosing a class

| Document | Class |
| --- | --- |
| Paper, report, homework, lab report, letter, CV | `article` |
| Lecture notes | `scrartcl` |
| Thesis, book | `book` |
| IEEE journal paper | `IEEEtran` |
| Poster | `tikzposter` |
| Cheat sheet | `extarticle` |
| Exam, quiz | `exam` |
