export interface Process {
	id: number;
	flake_url: string;
	env_vars: string | null;
	args: string | null;
}

export interface ProcessState {
	process_id: number;
	pid: number | null;
	status: ProcessStatus;
}

export enum ProcessStatus {
	STOPPED = "STOPPED",
	RUNNING = "RUNNING",
}

export interface ProcessWithState extends Process {
	state?: ProcessState;
}

export interface ProcessInput {
	flake_url: string;
	env_vars?: string | null;
	args?: string | null;
}

// API response wrapper
export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}
