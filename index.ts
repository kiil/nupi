import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

const MAX_BYTES = 50 * 1024; // 50 KB — matches pi's default bash limit
const MAX_LINES = 2000;

function truncate(text: string): string {
	const lines = text.split("\n");
	if (lines.length > MAX_LINES) {
		text = lines.slice(0, MAX_LINES).join("\n") + `\n[… ${lines.length - MAX_LINES} more lines truncated]`;
	}
	const bytes = Buffer.byteLength(text, "utf8");
	if (bytes > MAX_BYTES) {
		text = Buffer.from(text, "utf8").subarray(0, MAX_BYTES).toString("utf8") + "\n[… truncated at 50 KB]";
	}
	return text;
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "bash",
		label: "nushell",
		description:
			"Execute a nushell (nu) script. " +
			"Supports the full nushell language: structured pipelines, `$env`, `open`, `http get`, `ls`, etc. " +
			"Multi-line scripts are fine. " +
			"Avoid raw bash syntax — use nushell idioms instead (e.g. `| where`, `| get`, `| to json`).",

		parameters: Type.Object({
			command: Type.String({
				description: "Nushell script to run. May be multi-line.",
			}),
			timeout: Type.Optional(
				Type.Number({
					description: "Maximum run time in milliseconds. Defaults to 30 000.",
				})
			),
		}),

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const { command, timeout = 30_000 } = params;

			// Write the script to a temp file so multi-line scripts and
			// special characters survive shell quoting without any escaping.
			const tmpFile = join(tmpdir(), `pi-nu-${randomBytes(8).toString("hex")}.nu`);
			writeFileSync(tmpFile, command, "utf8");

			const cleanup = () => {
				try {
					unlinkSync(tmpFile);
				} catch {
					// best-effort
				}
			};

			// Resolve the working directory from whatever ctx exposes,
			// falling back gracefully if the field isn't available yet.
			const cwd =
				(ctx as any)?.workingDir ??
				(ctx as any)?.session?.workingDir ??
				process.cwd();

			return new Promise<ReturnType<typeof resolveShape>>((resolve) => {
				let stdout = "";
				let stderr = "";
				let timedOut = false;
				let settled = false;

				// I actually want the config
				// const proc = spawn("nu", ["--no-config-file", tmpFile], {
				// const proc = spawn("nu", [tmpFile], {
				const proc = spawn("nu", [
					"--config",
					`${process.env.HOME}/.config/nushell/pi.nu`,
					tmpFile
				], {
					cwd,
					env: { ...process.env },
				});

				const timer = setTimeout(() => {
					timedOut = true;
					proc.kill("SIGTERM");
				}, timeout);

				const abort = () => {
					clearTimeout(timer);
					proc.kill("SIGTERM");
				};
				signal?.addEventListener("abort", abort, { once: true });

				proc.stdout.on("data", (chunk: Buffer) => {
					stdout += chunk.toString("utf8");
					// Stream partial output back to the TUI.
					onUpdate({ content: [{ type: "text", text: truncate(stdout) }] });
				});

				proc.stderr.on("data", (chunk: Buffer) => {
					stderr += chunk.toString("utf8");
				});

				proc.on("close", (code) => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					signal?.removeEventListener("abort", abort);
					cleanup();

					let output = stdout;
					if (stderr) {
						output += (output ? "\n\nstderr:\n" : "") + stderr;
					}
					if (timedOut) {
						output = `[timed out after ${timeout} ms]\n` + output;
					}

					output = truncate(output.trim()) || "(no output)";

					resolve({
						content: [{ type: "text", text: output }],
						details: {
							exitCode: timedOut ? -1 : code,
							timedOut,
							shell: "nushell",
						},
					});
				});

				proc.on("error", (err: NodeJS.ErrnoException) => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					signal?.removeEventListener("abort", abort);
					cleanup();

					const hint =
						err.code === "ENOENT"
							? "\n\nHint: 'nu' was not found in PATH. Install nushell and make sure `nu` is executable."
							: "";

					resolve({
						content: [{ type: "text", text: `Error spawning nushell: ${err.message}${hint}` }],
						details: { error: true, shell: "nushell" },
					});
				});
			});
		},
	});
}

// Helper so TypeScript infers the return shape without importing internal types.
function resolveShape(x: { content: { type: string; text: string }[]; details: object }) {
	return x;
}
