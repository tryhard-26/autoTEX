import React, { useEffect, useRef, useState } from 'react';
import { basicSetup } from 'codemirror';
import { EditorView, keymap, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { EditorState, Compartment, Extension, StateField, StateEffect, Range } from '@codemirror/state';
import { diffLines } from 'diff';
import { StreamLanguage, HighlightStyle, syntaxHighlighting, indentUnit } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { setDiagnostics, lintGutter, Diagnostic } from '@codemirror/lint';
import { openSearchPanel } from '@codemirror/search';
import { indentWithTab } from '@codemirror/commands';
import { completeAnyWord, CompletionContext } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';
import { DiagnosticItem } from '../../types/compiler';
import { INTERNAL_DRAG_TYPE } from '../../utils/dropFiles';

export interface EditorSelection {
  startLine: number;
  endLine: number;
  text: string;
}

interface CodeEditorProps {
  path: string;
  content: string;
  onChange: (value: string) => void;
  diagnostics?: DiagnosticItem[];
  targetLine?: number | null;
  onSelectionChange?: (selection: EditorSelection | null) => void;
  onCursorChange?: (line: number) => void;
  fontSize?: number;
  tabSize?: number;
  wordWrap?: 'on' | 'off';
  lineNumbers?: 'on' | 'off';
  /** Agent edit to highlight (only applied while the document still equals its newContent). */
  changeHighlight?: { id: string; oldContent: string; newContent: string } | null;
  /** Files or explorer items dropped on the editor; resolves to LaTeX to insert at the drop point. */
  onDropToEditor?: (dt: DataTransfer) => Promise<string | null>;
  /** Insert text at the cursor (e.g. "Insert into document" from the explorer). */
  insertRequest?: { text: string; nonce: number } | null;
}

const LATEX_COMMANDS = [
  'begin', 'end', 'section', 'subsection', 'subsubsection', 'paragraph', 'chapter', 'part',
  'label', 'ref', 'eqref', 'cite', 'citep', 'citet', 'textbf', 'textit', 'emph', 'texttt', 'underline',
  'usepackage', 'documentclass', 'includegraphics', 'caption', 'centering', 'item', 'footnote',
  'frac', 'sqrt', 'sum', 'int', 'prod', 'lim', 'left', 'right', 'mathbb', 'mathcal', 'mathrm', 'mathbf',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'lambda', 'mu', 'sigma', 'theta', 'omega', 'infty',
  'hline', 'toprule', 'midrule', 'bottomrule', 'newcommand', 'renewcommand', 'title', 'author', 'date',
  'maketitle', 'tableofcontents', 'bibliography', 'bibliographystyle', 'input', 'include', 'frametitle',
  'vspace', 'hspace', 'newline', 'linewidth', 'textwidth',
].map((label) => ({ label: '\\' + label, type: 'keyword' }));

const ENVIRONMENTS = [
  'document', 'equation', 'equation*', 'align', 'align*', 'aligned', 'gather', 'figure', 'table', 'tabular',
  'itemize', 'enumerate', 'description', 'frame', 'block', 'columns', 'column', 'abstract', 'theorem', 'proof',
  'center', 'minipage', 'verbatim', 'cases', 'pmatrix', 'bmatrix',
];

function latexCompletions(ctx: CompletionContext) {
  const env = ctx.matchBefore(/\\(begin|end)\{[\w*]*/);
  if (env) {
    const brace = env.text.indexOf('{') + 1;
    return { from: env.from + brace, options: ENVIRONMENTS.map((label) => ({ label, type: 'type' })) };
  }
  const cmd = ctx.matchBefore(/\\[a-zA-Z]*/);
  if (!cmd || (cmd.from === cmd.to && !ctx.explicit)) return null;
  return { from: cmd.from, options: LATEX_COMMANDS, validFor: /^\\[a-zA-Z]*$/ };
}

// ---- Agent change highlighting: inserted lines green, removed lines shown as red blocks ----

class RemovedLinesWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: RemovedLinesWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-agent-removed';
    el.textContent = this.text.replace(/\n$/, '');
    return el;
  }
}

const setChangeHighlight = StateEffect.define<{ oldContent: string; newContent: string } | null>();

const changeHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes); // follow user edits
    for (const e of tr.effects) {
      if (!e.is(setChangeHighlight)) continue;
      if (!e.value || tr.state.doc.toString() !== e.value.newContent) return Decoration.none;
      const ranges: Range<Decoration>[] = [];
      const doc = tr.state.doc;
      let line = 1; // current line in the new document
      for (const part of diffLines(e.value.oldContent, e.value.newContent)) {
        const count = part.count ?? 0;
        if (part.added) {
          for (let i = 0; i < count && line + i <= doc.lines; i++) {
            ranges.push(Decoration.line({ class: 'cm-agent-added' }).range(doc.line(line + i).from));
          }
          line += count;
        } else if (part.removed) {
          const at = line <= doc.lines ? doc.line(line).from : doc.length;
          ranges.push(Decoration.widget({ widget: new RemovedLinesWidget(part.value), block: true, side: -1 }).range(at));
        } else {
          line += count;
        }
      }
      return Decoration.set(ranges, true);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const quietHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#8fb3e8' },
  { tag: [t.tagName, t.typeName], color: '#c6a0f0' },
  { tag: t.comment, color: '#6b7080', fontStyle: 'italic' },
  { tag: [t.string, t.special(t.string)], color: '#c3d69b' },
  { tag: [t.number, t.atom], color: '#e0b080' },
  { tag: t.bracket, color: '#9aa0ad' },
  { tag: t.invalid, color: '#f07178' },
]);

const theme = EditorView.theme(
  {
    '&': { height: '100%', backgroundColor: '#181920', color: '#d6d9e0' },
    '.cm-scroller': { fontFamily: "'JetBrains Mono', monospace", lineHeight: '1.5' },
    '.cm-content': { caretColor: '#d6d9e0' },
    '.cm-cursor': { borderLeftColor: '#d6d9e0' },
    '.cm-gutters': { backgroundColor: '#14151a', color: '#595e6d', border: 'none', borderRight: '1px solid #20222a' },
    '.cm-activeLine': { backgroundColor: '#1d1f27' },
    '.cm-activeLineGutter': { backgroundColor: '#1d1f27', color: '#c9cdd4' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#2b3a55 !important' },
    '.cm-panels': { backgroundColor: '#1e2028', color: '#c9cdd4', borderColor: '#2f3240' },
    '.cm-panels input, .cm-panels button': { fontSize: '12px' },
    '.cm-textfield': { backgroundColor: '#14151b', border: '1px solid #2b2d38', color: '#d6d9e0' },
    '.cm-button': { backgroundImage: 'none', backgroundColor: '#252834', border: '1px solid #2f3342', color: '#c9cdd4' },
    '.cm-tooltip': { backgroundColor: '#1e2028', border: '1px solid #2f3240', color: '#c9cdd4' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#2b3a55', color: '#fff' },
    '.cm-foldPlaceholder': { backgroundColor: '#252834', border: 'none', color: '#9aa0ad' },
    '.cm-searchMatch': { backgroundColor: '#5a4a1a' },
    '.cm-searchMatch-selected': { backgroundColor: '#7a5f10' },
    '.cm-agent-added': { backgroundColor: 'rgba(16, 185, 129, 0.14)', boxShadow: 'inset 2px 0 0 #10b981' },
    '.cm-agent-removed': {
      backgroundColor: 'rgba(244, 63, 94, 0.12)',
      boxShadow: 'inset 2px 0 0 #f43f5e',
      color: '#f4a3b1',
      textDecoration: 'line-through',
      whiteSpace: 'pre-wrap',
      padding: '0 6px',
    },
  },
  { dark: true }
);

/** Insert a block of text on its own line at `pos` and put the cursor after it. */
function insertAt(view: EditorView, pos: number, text: string) {
  const line = view.state.doc.lineAt(Math.min(pos, view.state.doc.length));
  const at = pos > line.from ? line.to : line.from;
  const insert = (at > line.from ? '\n' : '') + text;
  view.dispatch({ changes: { from: at, insert }, selection: { anchor: at + insert.length }, scrollIntoView: true });
  view.focus();
}

function languageFor(path: string): Extension {
  return /\.(tex|sty|cls|bbx|cbx|ltx)$/i.test(path)
    ? [StreamLanguage.define(stex), EditorState.languageData.of(() => [{ autocomplete: latexCompletions }])]
    : [];
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  path,
  content,
  onChange,
  diagnostics = [],
  targetLine = null,
  onSelectionChange,
  onCursorChange,
  fontSize = 13,
  tabSize = 2,
  wordWrap = 'on',
  lineNumbers = 'on',
  changeHighlight = null,
  onDropToEditor,
  insertRequest = null,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const statesRef = useRef(new Map<string, EditorState>()); // per-file state keeps undo history across tab switches
  const settingsCompartment = useRef(new Compartment());
  const [cursor, setCursor] = useState({ line: 1, col: 1, lines: 1 });

  // Latest callbacks, so the long-lived update listener never goes stale.
  const callbacks = useRef({ onChange, onSelectionChange, onCursorChange, onDropToEditor });
  callbacks.current = { onChange, onSelectionChange, onCursorChange, onDropToEditor };

  const settingsExtension = (): Extension => [
    EditorView.theme({ '&': { fontSize: `${fontSize}px` } }),
    wordWrap === 'on' ? EditorView.lineWrapping : [],
    lineNumbers === 'on' ? [] : EditorView.theme({ '.cm-lineNumbers': { display: 'none' } }),
    EditorState.tabSize.of(tabSize),
    indentUnit.of(' '.repeat(tabSize)),
  ];

  const createState = (doc: string) =>
    EditorState.create({
      doc,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab, { key: 'Mod-h', run: openSearchPanel }]),
        languageFor(path),
        syntaxHighlighting(quietHighlight),
        lintGutter(),
        changeHighlightField,
        EditorView.domEventHandlers({
          dragover(e) {
            const t = e.dataTransfer?.types ?? [];
            if (!t.includes('Files') && !t.includes(INTERNAL_DRAG_TYPE)) return false;
            e.preventDefault();
            return true;
          },
          drop(e, view) {
            const dt = e.dataTransfer;
            const handler = callbacks.current.onDropToEditor;
            if (!dt || !handler || (!dt.types.includes('Files') && !dt.types.includes(INTERNAL_DRAG_TYPE))) return false;
            e.preventDefault();
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? view.state.selection.main.head;
            handler(dt).then((text) => {
              if (text) insertAt(view, pos, text);
            });
            return true;
          },
        }),
        theme,
        settingsCompartment.current.of(settingsExtension()),
        EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) callbacks.current.onChange(u.state.doc.toString());
          if (u.docChanged || u.selectionSet) {
            const sel = u.state.selection.main;
            const line = u.state.doc.lineAt(sel.head);
            setCursor({ line: line.number, col: sel.head - line.from + 1, lines: u.state.doc.lines });
            callbacks.current.onCursorChange?.(line.number);
            callbacks.current.onSelectionChange?.(
              sel.empty
                ? null
                : {
                    startLine: u.state.doc.lineAt(sel.from).number,
                    endLine: u.state.doc.lineAt(sel.to).number,
                    text: u.state.sliceDoc(sel.from, sel.to),
                  }
            );
          }
        }),
      ],
    });

  // Mount once.
  useEffect(() => {
    const view = new EditorView({ state: createState(content), parent: hostRef.current! });
    viewRef.current = view;
    setCursor({ line: 1, col: 1, lines: view.state.doc.lines });
    return () => view.destroy();
  }, []);

  // Switch files: stash the old state, restore (or create) the new one.
  const currentPath = useRef(path);
  useEffect(() => {
    const view = viewRef.current;
    if (!view || currentPath.current === path) return;
    statesRef.current.set(currentPath.current, view.state);
    currentPath.current = path;
    const saved = statesRef.current.get(path);
    view.setState(saved && saved.doc.toString() === content ? saved : createState(content));
    view.dispatch({ effects: settingsCompartment.current.reconfigure(settingsExtension()) });
    setCursor({ line: 1, col: 1, lines: view.state.doc.lines });
  }, [path]);

  // External content changes (agent edit, revert, reload): apply as a transaction so undo still works.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || currentPath.current !== path) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: content } });
    }
  }, [content, path]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: settingsCompartment.current.reconfigure(settingsExtension()) });
  }, [fontSize, tabSize, wordWrap, lineNumbers]);

  // Agent change highlight: set when an edit is shown, cleared on Keep/Revert (prop becomes null).
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: setChangeHighlight.of(changeHighlight ? { oldContent: changeHighlight.oldContent, newContent: changeHighlight.newContent } : null),
    });
  }, [changeHighlight?.id, path, content === changeHighlight?.newContent]);

  useEffect(() => {
    const view = viewRef.current;
    if (view && insertRequest) insertAt(view, view.state.selection.main.head, insertRequest.text);
  }, [insertRequest?.nonce]);

  // Compiler diagnostics -> lint markers.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const doc = view.state.doc;
    const diags: Diagnostic[] = diagnostics
      .filter((d) => d.line >= 1 && d.line <= doc.lines)
      .map((d) => {
        const line = doc.line(d.line);
        return { from: line.from, to: line.to, severity: d.type, message: d.message };
      });
    view.dispatch(setDiagnostics(view.state, diags));
  }, [diagnostics, path]);

  // Jump to line (error click / SyncTeX).
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !targetLine) return;
    const line = view.state.doc.line(Math.min(Math.max(1, targetLine), view.state.doc.lines));
    view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
    view.focus();
  }, [targetLine]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181920] overflow-hidden">
      <div ref={hostRef} className="flex-1 overflow-hidden select-text" />
      <div className="h-6 border-t border-[#20222a] bg-[#14151a] flex items-center justify-between px-3 text-[11px] font-mono text-neutral-400 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span>
            Ln {cursor.line}, Col {cursor.col}
          </span>
          <span>{cursor.lines} lines</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{/\.bib$/i.test(path) ? 'BibTeX' : /\.(tex|sty|cls)$/i.test(path) ? 'LaTeX' : 'Text'}</span>
          <span>Spaces: {tabSize}</span>
        </div>
      </div>
    </div>
  );
};
