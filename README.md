# autoTEX

autoTEX is a LaTeX editor that runs entirely on your own machine. You can write your document on the left and see the compiled PDF on the right, all within the same interface. It also includes an AI agent that can modify your project files, compile your document, and fix errors when you ask it to.

The project aims to provide an open-source alternative to OpenAI's Prism, which is being shut down. autoTEX is still a work in progress, so you may encounter rough edges and occasional bugs. Contributions are welcome, whether you want to report an issue, fix a bug, or help build new features. See the Contributing section below to get started.

## What you need

You'll need [Bun](https://bun.sh), a TeX engine, and optionally [opencode](https://opencode.ai) if you want to use the AI agent.

Install Bun by following the instructions on the [official Bun website](https://bun.sh). You'll also need a TeX engine to compile your documents. autoTEX uses `tectonic` by default, but you can switch to `pdflatex`, `xelatex`, `lualatex`, or `latexmk` in Settings if you already have one of those installed.

Tectonic can be installed using your operating system's package manager where available. You can also download the appropriate binary from its official releases or follow the installation instructions in the [Tectonic documentation](https://tectonic-typesetting.github.io/en-US/).

The AI agent runs through opencode, which you can install globally using Bun:

```sh
bun add -g opencode-ai
```

You can use the editor without opencode, although you'll need it to access the agent panel.

## Getting started

First, install the project dependencies and start the application:

```sh
bun install
bun run start
```

Once the server is running, open [http://localhost:3001](http://localhost:3001) in your browser to start using autoTEX.

The agent works out of the box with opencode's free models. If you prefer to use another provider, such as OpenRouter, Anthropic, or OpenAI, you can authenticate with your chosen provider by running `opencode auth login`. The available models will then appear in the agent panel.

If you're developing autoTEX itself, you can enable hot reloading to see your changes without restarting the application. Run the following commands in separate terminals:

```sh
bun run server
bun run dev
```

You can then open [http://localhost:5173](http://localhost:5173) to access the development version.

## How to use it

Every autoTEX project lives in its own directory under `projects/`. The project menu in the top-left corner lets you create new projects, switch between existing ones, and import, export, or delete them. Projects can be imported and exported as `.zip` files, making it easy to move your work between machines or share it with others.

Adding files is straightforward. You can drag individual files or entire folders into the file tree, and you can rearrange existing files by dragging them to a new location. Right-click an item to access additional actions. When you drop an image or PDF directly into the editor, autoTEX automatically saves it to the `figures/` directory and inserts an appropriate `\includegraphics` block at the location where you dropped it.

When you're ready to compile your document, use the platform's configured compile shortcut or click the Build button. Any compilation errors will appear in a panel below the editor, and the corresponding lines of code will be highlighted so you can identify and fix problems more easily.

You can also navigate between your source code and the compiled PDF. Double-click anywhere in the PDF to jump to the corresponding location in the source. If you want to go in the other direction, use the crosshair button in the PDF toolbar to locate the section of the PDF associated with your current cursor position.

### Working with the AI agent

Open the agent panel using its keyboard shortcut or the corresponding interface control, then describe what you'd like to change. The agent receives useful context about your current workspace, including the open file, your cursor position, any selected text, and the errors from your most recent compilation. This helps it make changes that are relevant to what you're working on.

You can select a model from the dropdown menu in the agent panel. Free models are clearly labelled, while paid models require available credit with the provider that offers them.

The agent works directly with your project files and can compile the document to check its changes. If something breaks during the process, it can attempt to fix the problem before finishing its response. Changes are highlighted in green and red so you can review what was added or removed, then choose whether to keep or revert them. The panel also provides undo and redo controls for the last two turns.

If you'd like to inspect the agent's actions in more detail, open its log using the icon in the panel header. You can start a fresh conversation with the plus button, while earlier conversations are archived in `projects/<name>/.autotex/sessions/` rather than being permanently deleted.

For security and isolation, the agent cannot access files outside the current project directory, except for the skills that autoTEX makes available to it.

## Skills

Skills let you customise how the agent approaches different kinds of writing. Each skill acts as a set of instructions that guides the agent whenever you make a request. autoTEX comes with two built-in skills, `skills/latex` for standard LaTeX documents and `skills/beamer` for presentations and slides.

You can create your own skills to define the conventions and formatting rules that the agent should follow for a particular project or workflow. To add one, create a directory under `skills/` and place a `SKILL.md` file inside it. Restart the server for your new skill to take effect.

For example, you could create `skills/lab-style/SKILL.md` with the following content:

```markdown
---
name: lab-style
description: How our lab writes papers
---

Use \SI{}{} for units. Figures go in figures/. Cite with \citep.
```

Keep your skills focused and concise. autoTEX loads the full contents of every skill whenever you make a request, so lengthy instructions will consume more of the model's context. Including only the rules that matter will help the agent follow them without wasting tokens.

## Shortcuts

Keyboard shortcuts are designed to make common actions accessible without constantly reaching for the mouse. The exact modifier keys may vary by operating system, so refer to the shortcuts configured in the application.

| Key | Action |
| --- | --- |
| Save shortcut | Save |
| Compile shortcut | Compile |
| Command palette shortcut | Open the command palette |
| File tree shortcut | Toggle the file tree |
| Agent panel shortcut | Open the agent panel |
| Errors and warnings shortcut | Open errors and warnings |
| Find / replace shortcut | Find or replace |
| Settings shortcut | Open Settings |

## Configuration

You can configure autoTEX through a `.env` file or by setting environment variables. The following options control the agent, server, and project storage locations.

| Variable | Default | Description |
| --- | --- | --- |
| `OPENCODE_MODEL` | `opencode/big-pickle` | The default model used by the agent unless you select another one. |
| `OPENCODE_BIN` | `opencode` on your `PATH` | The path to the opencode executable. |
| `PORT` | `3001` | The port used by the server. |
| `PROJECTS_DIR` | `./projects` | The directory where projects are stored. |

## Contributing

Contributions are welcome, whether you're fixing a bug, improving an existing feature, or introducing something new. You can get involved by opening an issue to report a problem or submitting a pull request with your changes.

Before submitting a pull request, please run the test suite:

```sh
bun test
```

The tests use a fake opencode implementation and a temporary directory, so they won't make requests to an AI model or modify your actual projects.

## License

autoTEX is released under the Apache 2.0 license. See the [LICENSE](LICENSE) file for the full terms.
