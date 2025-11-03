import type { Subprocess } from "bun";
import { spawn } from "bun";
import { parseArgs, parseEnvVars } from "./utils";

declare const Bun: typeof globalThis.Bun;

const activeProcesses = new Map<number, Subprocess>();

const TERM_TIMEOUT_MS = 5000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function runFlake(
	flake_url: string,
	env_vars?: string | null,
	args?: string | null
): number {
	const command = ["nix", "run", flake_url, "--"];

	if (args) {
		command.push(...parseArgs(args));
	}

	const env = { ...Bun.env };

	if (env_vars) {
		Object.assign(env, parseEnvVars(env_vars));
	}

	const proc = spawn({
		cmd: command,
		env,
		stdout: "inherit", // For now, inherit - we'll capture later
		stderr: "inherit",
		stdin: "ignore",
	});

	const pid = proc.pid;

	// Store the subprocess for later management
	activeProcesses.set(pid, proc);

	// Clean up when process exits
	proc.exited.then(() => {
		activeProcesses.delete(pid);
	});

	return pid;
}

export async function killFlake(pid: number): Promise<void> {
	const proc = activeProcesses.get(pid);

	if (proc) {
		proc.kill();

		const termCompleted = await Promise.race([
			proc.exited.then(() => true).catch(() => true),
			sleep(TERM_TIMEOUT_MS).then(() => false),
		]);

		if (!termCompleted) {
			try {
				proc.kill("SIGKILL");
			} catch {
				try {
					await Bun.$`kill -KILL ${pid}`.quiet();
				} catch {
					/* ignore */
				}
			}
		}

		activeProcesses.delete(pid);
		return;
	}

	try {
		await Bun.$`kill -TERM ${pid}`.quiet();
	} catch {
		/* ignore */
	}

	await sleep(TERM_TIMEOUT_MS);

	if (isFlakeRunning(pid)) {
		try {
			await Bun.$`kill -KILL ${pid}`.quiet();
		} catch {
			/* ignore */
		}
	}
}

export function isFlakeRunning(pid: number): boolean {
	const proc = activeProcesses.get(pid);

	if (proc && !proc.killed) {
		return true;
	}
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}
