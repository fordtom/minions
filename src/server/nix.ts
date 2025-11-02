import { spawn } from "bun";
import type { Subprocess } from "bun";
import { parseEnvVars, parseArgs } from "./utils";

const activeProcesses = new Map<number, Subprocess>();

export function runFlake(
	flake_url: string,
	env_vars?: string | null,
	args?: string | null,
): number {
	const command = ["nix", "run", flake_url, "--"];

	if (args) {
		command.push(...parseArgs(args));
	}

	const env = { ...process.env };

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

export function killFlake(pid: number): void {
	const proc = activeProcesses.get(pid);

	if (proc) {
		proc.kill();
		activeProcesses.delete(pid);
	} else {
		try {
			process.kill(pid, "SIGTERM");
		} catch {}
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
