# Reviewing a deck: proofread, audit, pedagogy, excellence, devil's advocate, domain review

### 2.3 `review [file]` or `proofread [file]`

Read-only report, no file edits.

**5 check categories:**

| Category | What to check |
|----------|---------------|
| Grammar | Subject-verb, articles, prepositions, tense consistency |
| Typos | Misspellings, search-replace artifacts, duplicated words, **unreplaced placeholders** (`[name]`, `[TODO]`, `[XXX]`, template remnants) |
| Overflow | Long equations without `\resizebox`, too many items per slide |
| Consistency | Citation format (`\citet`/`\citep`), notation, terminology, box usage, **denominator consistency** across slides |
| Academic quality | Informal abbreviations, missing words, claims without citations, **ambiguous abbreviations** (same abbreviation for different terms) |

**Report format per issue:**
```
### Issue N: [Brief description]
- **Location:** [slide title or line number]
- **Current:** "[exact text]"
- **Proposed:** "[fix]"
- **Category / Severity:** [Category] / [High|Medium|Low]
```

### 2.4 `audit [file]`

Visual layout audit. Read-only report.

**Check dimensions:**
- **Overflow:** Content exceeding boundaries, wide tables/equations
- **Font consistency:** Inline size overrides, inconsistent sizes
- **Box fatigue:** 2+ boxes per slide, wrong box types
- **Spacing:** `\vspace` overuse, structural issues
- **Layout:** Missing transitions, missing framing sentences

**Spacing-first fix principle (priority order):**
1. Reduce vertical spacing (structural changes)
2. Consolidate lists
3. Move displayed equations inline
4. Reduce image/table size with `\resizebox`
5. **Last resort:** `\footnotesize` (never `\tiny`)

### 2.5 `pedagogy [file]`

Holistic pedagogical review. Read-only report.

**13 patterns to validate:**

| # | Pattern | Red flag |
|---|---------|----------|
| 1 | Motivation before formalism | Definition without context |
| 2 | Incremental notation | 5+ new symbols on one slide |
| 3 | Worked example after definition | 2 consecutive definitions, no example |
| 4 | Progressive complexity | Advanced concept before prerequisite |
| 5 | Fragment reveals (problem→solution) | Dense theorem revealed all at once |
| 6 | Standout slides at pivots | Abrupt topic jump, no transition |
| 7 | Two-slide strategy for dense theorems | Complex theorem crammed in 1 slide |
| 8 | Semantic color usage | Binary contrasts in same color |
| 9 | Box hierarchy | Wrong box type for content |
| 10 | Box fatigue | 3+ boxes on one slide |
| 11 | Socratic embedding | Zero questions in entire deck |
| 12 | Visual-first for complex concepts | Notation before visualization |
| 13 | Side-by-side for comparisons | Sequential slides for related definitions |

**Deck-level checks:** Narrative arc, pacing (max 3-4 theory slides before example), visual rhythm (section dividers every 5-8 slides), notation consistency, student prerequisite assumptions.


### 2.7 `excellence [file]`

Comprehensive multi-dimensional review. **Use the Agent tool to dispatch review agents in parallel** for maximum efficiency.

**Parallel agent dispatch** — launch these as concurrent Agent calls:

1. **Visual audit agent** — "Read [file]. Check every slide for: overflow, font consistency, box fatigue (2+ boxes), spacing issues, missing transitions. Report per slide with severity. Follow spacing-first fix principle."
2. **Pedagogical review agent** — "Read [file]. Validate 13 pedagogical patterns (motivation before formalism, incremental notation, worked examples, etc.) and deck-level checks (narrative arc, pacing, visual rhythm, notation consistency). Report pattern-by-pattern with status."
3. **Proofreading agent** — "Read [file]. Check grammar, typos, citation consistency (`\citet`/`\citep`), notation consistency, academic quality. Report per issue with location and fix."
4. **TikZ review agent** (if file contains `\begin{tikzpicture}`) — "Read [file]. For every TikZ diagram: check label overlaps, geometric accuracy, visual semantics, spacing. Be merciless — find every flaw. Report per issue with exact coordinates and fixes."
5. **Domain review agent** (optional) — "Read [file]. Verify substantive correctness: assumptions, derivations, citation fidelity."

**After all agents return**, synthesize a combined report:

```markdown
# Slide Excellence Review: [Filename]

## Overall Quality Score: [EXCELLENT / GOOD / NEEDS WORK / POOR]

| Dimension | Critical | Major | Minor |
|-----------|----------|-------|-------|
| Visual/Layout | | | |
| Pedagogical | | | |
| Proofreading | | | |
| TikZ (if any) | | | |

### Critical Issues (Immediate Action Required)
### Major Issues (Next Revision)
### Recommended Next Steps
```

**Quality score rubric** (for multi-agent `excellence` review — complements the numeric score in Phase 5 which is used during `create`):

| Score | Critical issues | Medium issues | Meaning |
|-------|----------------|---------------|---------|
| Excellent | 0-2 | 0-5 | Ready to present (≈ Phase 5 score ≥ 90) |
| Good | 3-5 | 6-15 | Minor refinements (≈ Phase 5 score 80-89) |
| Needs Work | 6-10 | 16-30 | Significant revision (≈ Phase 5 score < 80) |
| Poor | 11+ | 31+ | Major restructuring |

### 2.8 `devils-advocate [file]`

Challenge slide design with 5-7 specific pedagogical questions.

**Challenge categories:**
1. **Ordering** — "Could students understand better if X before Y?"
2. **Prerequisites** — "Do students have the background for this?"
3. **Gaps** — "Should we include an intuitive example here?"
4. **Alternative presentations** — "2 other ways to present this concept"
5. **Notation conflicts** — "This symbol conflicts with earlier usage"
6. **Cognitive load** — "Too many new symbols on this slide"
7. **Standalone readability** — "Does this section stand alone as a book chapter?"


## 4. DOMAIN REVIEW (Template)

For substantive correctness (not presentation), review through 5 lenses:

1. **Assumption stress test** — all assumptions stated, sufficient, necessary?
2. **Derivation verification** — each step follows? Decomposition sums to whole?
3. **Citation fidelity** — slide accurately represents cited paper?
4. **Code-theory alignment** — code implements exact formula from slides?
5. **Backward logic check** — read conclusion→setup, every claim supported?

Severity: CRITICAL = math wrong. MAJOR = missing assumption. MINOR = could be clearer.

---
