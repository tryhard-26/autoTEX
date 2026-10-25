# autoTEX

autoTEX is a LaTeX editor that runs on your own machine. You write on the left, the compiled PDF appears on the right, and an AI agent can make changes to the project when you ask it to.

It's intended as an open-source replacement for OpenAI's Prism, which is being shut down. It's still a work in progress, so expect rough edges and the occasional bug. If you'd like to help, bug reports, fixes and new features are all welcome; see Contributing at the end.

## What you need

You'll need [Bun](https://bun.sh) and a TeX engine. autoTEX uses `tectonic` by default (`brew install tectonic`), but you can switch to `pdflatex`, `xelatex`, `lualatex` or `latexmk` in Settings if you have one of those installed.

The agent runs through [opencode](https://opencode.ai), which you can install with `bun add -g opencode-ai`. The editor works fine without it; only the agent panel needs it.

## Getting started

```sh
bun install
bun run start
```

Then open http://localhost:3001.

The agent works straight away with opencode's free models. If you want to use other providers, such as OpenRouter, Anthropic or OpenAI, log in once with `opencode auth login` and their models will show up in the agent panel.

If you're working on autoTEX itself, run `bun run server` and `bun run dev` in two terminals instead and open http://localhost:5173, which gives you hot reload.

## How to use it

Each project lives in its own folder under `projects/`. The menu at the top left lets you create, switch between, import, export and delete projects; imports and exports use `.zip` files.

To add files, drag them, or whole folders, onto the file tree. You can also drag items within the tree to move them, and right-click for everything else. If you drop an image or PDF straight into the editor, autoTEX saves it to `figures/` and inserts an `\includegraphics` block where you dropped it.

Press ⌘Enter or click Build to compile. Errors appear in a panel below the editor and are also marked in the code. To jump from the PDF to the source, double-click anywhere in the PDF; the crosshair button in the PDF toolbar jumps the other way, from your cursor to the matching spot in the PDF.

Press ⌘J to open the agent panel and ask for what you want. Along with your request, the agent sees the open file, your cursor position, any text you've selected and the last compile errors. You can choose a model from the dropdown in the panel: free models are labelled, and paid ones need credit with whichever provider offers them.

The agent edits your files directly, compiles to check its work, and fixes anything it breaks. Its changes are highlighted in green and red, and you can keep or revert each one, or undo and redo the last two turns with the arrows in the panel. If you want to see exactly what it's doing, open the log from the icon in the panel header. The + button starts a new conversation; earlier ones are archived in `projects/<name>/.autotex/sessions/` rather than deleted.

The agent can't read anything outside the project folder, apart from the skills described below.

## Skills

Skills are style guides that the agent follows on every request. autoTEX ships with two: `skills/latex` for documents and `skills/beamer` for slides.

You can add your own by creating `skills/<name>/SKILL.md` and restarting the server:

```markdown
---
name: lab-style
description: How our lab writes papers
---

Use \SI{}{} for units. Figures go in figures/. Cite with \citep.
```

Every skill is loaded in full on every request, so it's worth keeping them focused, since a long skill takes up room in the model's context.

## Shortcuts

| Key | Action |
| --- | --- |
| ⌘S | Save |
| ⌘Enter | Compile |
| ⌘P | Command palette |
| ⌘B | File tree |
| ⌘J | Agent panel |
| ⇧⌘D | Errors and warnings |
| ⌘F / ⌘H | Find / replace |
| ⌘, | Settings |

## Configuration

You can set these in `.env` or in your environment:

| Variable | Default | What it does |
| --- | --- | --- |
| `OPENCODE_MODEL` | `opencode/big-pickle` | Model the agent uses unless you pick another |
| `OPENCODE_BIN` | `opencode` on your `PATH` | Where the opencode binary is |
| `PORT` | `3001` | Server port |
| `PROJECTS_DIR` | `./projects` | Where projects are stored |

## Contributing

Open an issue or a pull request, and please run `bun test` before sending changes. The tests use a fake opencode and a temporary folder, so they won't call a model or touch your projects.

## License

Apache 2.0. See [LICENSE](LICENSE).
