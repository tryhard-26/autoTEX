export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  mainFile: string;
  files: Record<string, string>;
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'article',
    name: 'Research Article (LaTeX)',
    description: 'Clean academic paper with abstract, math environments, and bibliography.',
    mainFile: 'main.tex',
    files: {
      'main.tex': `\\documentclass[11pt,a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{booktabs}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage[margin=1in]{geometry}

\\title{On the Convergence Properties of Distributed Consensus}
\\author{Research Team \\\\ Department of Computer Science}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
We present a rigorous analysis of decentralized coordination in networked multi-agent systems. We prove exponential convergence under weakly connected communication graphs.
\\end{abstract}

\\section{Introduction}
Distributed optimization has emerged as a fundamental paradigm across robotics, decentralized learning, and autonomous networks.

\\begin{equation}
  \\dot{x}_i(t) = -\\sum_{j \\in \\mathcal{N}_i} a_{ij} (x_i(t) - x_j(t))
\\end{equation}

\\section{Methodology}
Let $\\mathcal{G} = (\\mathcal{V}, \\mathcal{E})$ denote a directed communication graph with Laplacian matrix $L$.

\\begin{table}[h]
  \\centering
  \\caption{Performance Comparison across Topologies}
  \\begin{tabular}{lrrr}
    \\toprule
    Topology & Nodes & Spectral Gap & Time to $\\epsilon$-Convergence \\\\
    \\midrule
    Ring & 50 & 0.039 & 142ms \\\\
    Grid & 64 & 0.098 & 76ms \\\\
    Random Geometric & 100 & 0.245 & 31ms \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}

\\section{Conclusion}
Our findings demonstrate robust bounds under adversarial perturbations.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}
`,
      'references.bib': `@article{lynch1996distributed,
  title={Distributed Algorithms},
  author={Lynch, Nancy A},
  journal={Morgan Kaufmann},
  year={1996}
}
`,
    },
  },
  {
    id: 'beamer',
    name: 'Beamer Presentation (16:9 Madrid)',
    description: 'Compliant with inbaked Beamer skill: 16:9, 10pt, Madrid theme, semantic colors, no overlays.',
    mainFile: 'main.tex',
    files: {
      'main.tex': `\\documentclass[aspectratio=169,10pt]{beamer}

\\usetheme{Madrid}
% Madrid draws shadows that emit "Missing character" warnings under XeTeX; turn them off
\\setbeamertemplate{blocks}[rounded][shadow=false]
\\setbeamertemplate{title page}[default][colsep=-4bp,rounded=true,shadow=false]
\\usecolortheme{default}
\\setbeamertemplate{navigation symbols}{}
\\setbeamertemplate{footline}[frame number]

\\usepackage{amsmath,amssymb,amsthm,booktabs,mathtools}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{tikz}
\\usetikzlibrary{arrows.meta,positioning}

% Semantic colors (beamer skill guidelines)
\\definecolor{positive}{HTML}{0173B2}
\\definecolor{negative}{HTML}{DE8F05}
\\definecolor{emphasis}{HTML}{029E73}
\\definecolor{neutral}{gray}{0.55}

\\newcommand{\\pos}[1]{\\textcolor{positive}{#1}}
\\newcommand{\\con}[1]{\\textcolor{negative}{#1}}
\\newcommand{\\HL}[1]{\\textcolor{emphasis}{#1}}

\\title{Scalable Verification of Neural Networks}
\\subtitle{Symbolic Execution and Polyhedral Abstractions}
\\author{Presenter: Alex Vance}
\\institute{Institute for Advanced Computation}
\\date{\\today}

\\begin{document}

\\begin{frame}
  \\titlepage
\\end{frame}

\\begin{frame}{Problem Formulation: Why Formal Guarantees?}
  \\begin{columns}[T]
    \\begin{column}{0.48\\textwidth}
      \\textbf{Traditional Testing:}
      \\begin{itemize}
        \\item Empirical sampling of input space
        \\item \\con{Blind to adversarial corner cases}
        \\item Unsound for safety-critical controllers
      \\end{itemize}
    \\end{column}
    \\begin{column}{0.48\\textwidth}
      \\textbf{Formal Verification:}
      \\begin{itemize}
        \\item Complete guarantees over intervals
        \\item \\pos{Mathematically provable bounds}
        \\item Scales via abstract interpretation
      \\end{itemize}
    \\end{column}
  \\end{columns}

  \\vspace{1em}
  \\begin{block}{Verification Goal}
    Prove that for all $x \\in \\mathcal{X}_{\\text{in}}$, the neural output satisfies $f(x) \\in \\mathcal{Y}_{\\text{safe}}$.
  \\end{block}
\\end{frame}

\\begin{frame}{Core Results}
  \\begin{table}
    \\centering
    \\begin{tabular}{lrr}
      \\toprule
      Benchmark & Reluplex & Our Polyhedral Bound \\\\
      \\midrule
      ACAS Xu (N=10) & 18.4s & \\HL{1.2s} \\\\
      MNIST Defense & Timeout & \\HL{24.8s} \\\\
      \x5cbottomrule
    \\end{tabular}
  \\end{table}
\\end{frame}

\\begin{frame}{References}
  \\begin{thebibliography}{9}
    \x5cbibitem{katz2017reluplex}
    G.~Katz et~al., \`\`Reluplex: An efficient SMT solver for verifying deep neural networks,'' \\textit{CAV}, 2017.
  \\end{thebibliography}
\\end{frame}

\\end{document}
`,
    },
  },
  {
    id: 'blank',
    name: 'Blank Document',
    description: 'Minimal blank LaTeX skeleton with preamble ready to edit.',
    mainFile: 'main.tex',
    files: {
      'main.tex': `\\documentclass[11pt,a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage[margin=1in]{geometry}

\\title{Untitled LaTeX Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Start typing your document here...

\\end{document}
`,
    },
  },
];
