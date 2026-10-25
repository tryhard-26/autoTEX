# Compile passes, visual check, timing validation, figure extraction

### 2.1 `compile [file]`

3-pass XeLaTeX + bibtex for full citation resolution.

```bash
# Adapt TEXINPUTS/BIBINPUTS to your project's preamble/bib locations
xelatex -interaction=nonstopmode FILE.tex
bibtex FILE
xelatex -interaction=nonstopmode FILE.tex
xelatex -interaction=nonstopmode FILE.tex
```

Post-compile checks:
- Grep log for `Overfull \\hbox` warnings (count and locations)
- Grep for `Undefined control sequence` or `undefined citations`
- Grep for `Label(s) may have changed`
- Open PDF for visual verification
- Report: success/failure, overfull count, undefined items, page count


### 2.9 `visual-check [file]`

**PDF→image systematic visual review.** Converts compiled PDF to images, then reviews each slide visually. This catches issues invisible in source code and suppressed by the compiler (especially box-interior overflow).

**Why this matters:** Beamer suppresses overfull warnings inside `block`/`alertblock`/`exampleblock` environments. Zero compile warnings does NOT mean zero visual overflow. This action provides ground truth.

**Workflow:**

1. **Compile** (if not already compiled):
   ```bash
   xelatex -interaction=nonstopmode FILE.tex
   ```

2. **Convert PDF to images** using PyMuPDF:
   ```python
   import fitz
   doc = fitz.open('FILE.pdf')
   n = doc.page_count          # cache before iterating or closing
   zoom = 200 / 72  # 200 DPI
   matrix = fitz.Matrix(zoom, zoom)
   for i in range(n):
       page = doc.load_page(i)
       pixmap = page.get_pixmap(matrix=matrix)
       pixmap.save(f'/tmp/slide-{i+1:03d}.jpg', output='jpeg')
   doc.close()
   print(f'Exported {n} slides')
   ```
   Or via bash: `python3 -c "import fitz; ..."`

   **Fallback** (if PyMuPDF unavailable): Use the Read tool directly on the PDF — Claude Code is multimodal and can read PDF files page by page.

3. **Systematic per-slide inspection** — use Read tool to view each image, checking:
   - [ ] No text overflow at any edge (top, bottom, left, right)
   - [ ] No content overflowing inside colored boxes (check every `alertblock`/`exampleblock`/`block`)
   - [ ] All text legible (no text smaller than readable at presentation distance)
   - [ ] Tables and equations fit within slide width
   - [ ] TikZ labels not overlapping with lines, dots, or other labels
   - [ ] Consistent font sizes across similar slide types
   - [ ] Adequate contrast between text and background
   - [ ] No visual clutter (too many elements competing for attention)

4. **Report** per issue:
   ```
   ### Slide N: [slide title]
   - **Issue:** [description]
   - **Severity:** Critical / Major / Minor
   - **Fix:** [specific recommendation]
   ```

### 2.10 `validate [file] [duration]`

**Automated quantitative validation.** Checks measurable properties without reading content.

**Checks performed:**

1. **Slide count vs. duration** (if duration provided):
   ```bash
   # Get page count
   pdfinfo FILE.pdf | grep "Pages:"
   ```
   Compare against timing allocation table (Section 2.2, Phase 1). Flag if outside recommended range.

2. **Aspect ratio**:
   ```bash
   pdfinfo FILE.pdf | grep "Page size:"
   ```
   Expected: 364.19 x 272.65 pts (16:9 at 10pt) or similar 16:9 ratio. Flag if 4:3 (old projector format).

3. **File size**:
   - \> 50 MB: warning (slow to share/email)
   - \> 100 MB: critical (likely uncompressed images)

4. **Compilation health** (from .log file):
   ```bash
   grep -c "Overfull \\\\hbox" FILE.log
   grep -c "Undefined control sequence" FILE.log
   grep -c "Citation.*undefined" FILE.log
   grep -c "multiply defined" FILE.log
   ```

5. **Source code static checks** (from .tex file):
   - Count `\pause` / `\onslide` / `\only` usage → must be 0 (Hard Rule 1)
   - Count slides with >2 colored boxes → flag violations (Hard Rule 2)
   - Count `\tiny` usage → must be 0 (Hard Rule 13)
   - Check for `\begin{thebibliography}` → warn if missing (Hard Rule 11)

**Report format:**
```
# Validation Report: [Filename]

| Check | Result | Status |
|-------|--------|--------|
| Slide count | N slides / Xmin duration | OK / WARNING |
| Aspect ratio | 16:9 | OK |
| File size | X.X MB | OK / WARNING |
| Overfull hbox | N warnings | OK / CRITICAL |
| Undefined references | N | OK / CRITICAL |
| Overlay commands | N found | OK / VIOLATION |
| Box fatigue violations | N slides | OK / WARNING |
| References slide | Present / Missing | OK / WARNING |

Overall: PASS / PASS WITH WARNINGS / FAIL
```

### 2.11 `extract-figures [pdf] [pages]`

**Extract figures from a paper PDF and prepare them for inclusion in Beamer slides.**

Use when the user wants to reuse figures from an existing paper (their own or a cited work) instead of redrawing in TikZ.

#### Workflow

1. **Identify target figures** — if user doesn't specify pages, use the native `Read` tool (with the `pages` parameter) to view the PDF and locate figures. Ask user which figures to extract if ambiguous.

2. **Extract images** from specified pages with `pdftoppm` (poppler):
   ```bash
   # Render each target page to a high-res PNG (300 dpi), saved to figures/
   pdftoppm -png -r 300 -f PAGE -l PAGE PDF_PATH figures/page
   # → figures/page-PAGE.png  (original resolution at the chosen dpi, zero token cost)
   ```
   Renders the whole page; crop down to the figure with `trim`/`clip` in step 5. For a single clean embedded bitmap, `pdfimages -png -f PAGE -l PAGE PDF_PATH figures/img` extracts the raw image object directly.

3. **Rename to descriptive names** following the naming convention:
   ```bash
   mv figures/page-3.png figures/fig-LABEL.png
   ```
   Naming convention: `fig-<descriptive-label>.png` (e.g., `fig-architecture.png`, `fig-results-table.png`).

4. **Generate LaTeX snippet** — output ready-to-paste code:

   *Full-width figure:*
   ```latex
   \begin{frame}{Frame Title}
     \begin{center}
       \includegraphics[width=0.85\textwidth]{figures/fig-LABEL.png}
     \end{center}
     \vspace{-6pt}
     {\small Source: \citet{author2024paper}}
   \end{frame}
   ```

   *Figure + text side-by-side (columns layout):*
   ```latex
   \begin{frame}{Frame Title}
     \begin{columns}[T]
       \column{0.50\textwidth}
         \includegraphics[width=\textwidth]{figures/fig-LABEL.png}
         {\small Source: \citet{author2024paper}}
       \column{0.45\textwidth}
         Key observations:
         \begin{itemize}
           \item Point 1
           \item Point 2
         \end{itemize}
     \end{columns}
   \end{frame}
   ```

   *Two figures side-by-side (subfigure):*
   ```latex
   \begin{frame}{Frame Title}
     \begin{figure}
       \begin{subfigure}{0.48\textwidth}
         \includegraphics[width=\textwidth]{figures/fig-LEFT.png}
         \caption{(a) Description}
       \end{subfigure}\hfill
       \begin{subfigure}{0.48\textwidth}
         \includegraphics[width=\textwidth]{figures/fig-RIGHT.png}
         \caption{(b) Description}
       \end{subfigure}
     \end{figure}
   \end{frame}
   ```

5. **Cropping guidance** — if the extracted image contains surrounding text or margins that should be removed, use the `trim` and `clip` options:
   ```latex
   \includegraphics[width=0.85\textwidth, trim=LEFT BOTTOM RIGHT TOP, clip]{figures/fig-LABEL.png}
   ```
   - Units are in `bp` (big points). Estimate from the rendered image dimensions (e.g. `sips -g pixelWidth -g pixelHeight figures/fig-LABEL.png`).
   - Common case: `trim=50 200 50 100, clip` to remove page margins and surrounding text.
   - **Always visually verify** after compilation — cropping coordinates are estimates.

#### Rules

- **Always attribute** — include `{\small Source: ...}` below every extracted figure unless it's the user's own paper.
- **Prefer vector** — if only a single clean figure is on a page, extraction quality is usually sufficient. For complex multi-figure pages, consider redrawing the key figure in TikZ for better quality and consistency.
- **Resolution check** — if extracted image width < 800px, warn the user that it may appear pixelated on a projector. Suggest either finding a higher-resolution source or redrawing in TikZ.
- **Don't extract tables** — tables from PDF rasterize poorly. Always recreate tables in LaTeX using `booktabs`.
- **Preamble dependency** — ensure `\usepackage{graphicx}` is in the preamble (add if missing). If using subfigures, also ensure `\usepackage{subcaption}`.
