# Nushell 🐘

## Direct Nushell Execution

- The `bash` tool directly executes Nushell commands.
- Simple expressions like `5 + 5` or `2 * 100` can be run directly.
- Avoid `nu -c` when using the `bash` tool for direct Nushell commands.
- Avoid `echo` when using the `bash` tool for piping strings to Nushell.

## Exploring Commands

- Use `help commands | where command_type == built-in | get name | to text` to list core commands.
- Use `help commands | where command_type == custom | get name | to text` to list custom commands.
- Use `help <command> | ansi strip | str trim` to learn about a specific command.
