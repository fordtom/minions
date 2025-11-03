import { spawn } from "bun";
import type { Subprocess } from "bun";
import { parseEnvVars, parseArgs } from "./utils";

const activeProcesses = new Map<number, Subprocess>();

const TERM_TIMEOUT_MS = 5_000;
const KILL_TIMEOUT_MS = 5_000;
const EXIT_POLL_INTERVAL_MS = 100;

function waitForExitWithTimeout(exitPromise: Promise<number>, timeoutMs: number): Promise<boolean> {
	return new Promise((resolve) => {
		let settled = false;
		const timeout = setTimeout(() => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(false);
		}, timeoutMs);

		exitPromise
			.then(() => {
				if (settled) {
					return;
				}
				settled = true;
				clearTimeout(timeout);
				resolve(true);
			})
			.catch(() => {
				if (settled) {
					return;
				}
				settled = true;
				clearTimeout(timeout);
				resolve(true);
			});
	});
}

async function waitForPidExit(pid: number, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (!isFlakeRunning(pid)) {
			return true;
		}

		await new Promise((resolve) => setTimeout(resolve, EXIT_POLL_INTERVAL_MS));
	}

	return !isFlakeRunning(pid);
}

export function runFlake(
	flake_url: string,
	env_vars?: string | null,
	args?: string | null,
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
		let exited = await waitForExitWithTimeout(proc.exited, TERM_TIMEOUT_MS);

		if (!exited) {
			try {
				proc.kill("SIGKILL");
			} catch {
				try {
					await Bun.$`kill -KILL ${pid}`.quiet();
				} catch {
					// Ignore best-effort failure
				}
			}

			exited = await waitForExitWithTimeout(proc.exited, KILL_TIMEOUT_MS);
		}

		if (exited) {
			activeProcesses.delete(pid);
		}
		return;
	}

	try {
		await Bun.$`kill -TERM ${pid}`.quiet();
	} catch {
		// Process may already be dead
	}

	const exitedAfterTerm = await waitForPidExit(pid, TERM_TIMEOUT_MS);

	if (exitedAfterTerm) {
		return;
	}

	try {
		await Bun.$`kill -KILL ${pid}`.quiet();
	} catch {
		// Ignore best-effort failure
	}

	await waitForPidExit(pid, KILL_TIMEOUT_MS);
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
