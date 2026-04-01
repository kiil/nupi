# nupi 🐘π

A [Pi Coding Agent](https://github.com/mariozechner/pi-coding-agent) extension that replaces the built-in bash tool with [Nushell](https://www.nushell.sh/) (`nu`).

## What it does

Registers a tool named `bash` (displayed as `nushell` in the TUI) that executes scripts using `nu` instead of bash. The agent gets full Nushell language support — structured pipelines, `open`, `http get`, `| where`, `| get`, `| to json`, etc.

## Requirements

- Node.js with ES2022+ support
- Nushell installed with `nu` in your PATH
- `@mariozechner/pi-coding-agent`

## Installation

Get repo and

```sh
npm install
```

Then register the extension with Pi.

## Usage

Use the provided extension and the nupi.md prompt template.

Remember to create a pi.nu in your nushell config dir (~/.config/nushell/pi.nu) and source custom commands and `use` modules you want available on pi.

Bonus:

You can use this in your pi config if you additionally want nushell for th ! and !! functionality in pi:

  "shellPath": "/path/to/your/nu"

## Behavior

- Scripts are written to a temp file (`pi-nu-*.nu`) before execution to avoid quoting issues with multi-line scripts and special characters.
- Output is capped at **2000 lines** or **50 KB**, whichever comes first — matching Pi's default bash limit.
- Partial output is streamed to the TUI in real time.
- Default timeout is **30 seconds** (overridable per call).
- Nushell is spawned with `--config ~/.config/nushell/pi.nu` - make sure to source your custom commands and `use` modules you need from a pi.nu file in that location.
- Temp files are cleaned up after each run, even on error or timeout.

## Usage tips (for the agent)

- Run expressions directly: `5 + 5`, `ls | where size > 1mb`
- Don't use `nu -c` or `echo` — scripts are already executed by `nu`
- List built-in commands: `help commands | where command_type == built-in | get name | to text`
- Get help on a command: `help <command> | ansi strip | str trim`
