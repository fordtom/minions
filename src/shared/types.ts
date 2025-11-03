export interface Process {
	id: number;
	name: string | null;
	flake_url: string;
	env_vars: string | null;
	args: string | null;
	created_at: number;
	updated_at: number;
}

export interface ProcessState {
	process_id: number;
	pid: number | null;
	status: ProcessStatus;
	started_at: number | null;
}

export enum ProcessStatus {
	STOPPED = "STOPPED",
	RUNNING = "RUNNING",
}

export interface ProcessWithState extends Process {
	state: ProcessState;
}

export interface ProcessInput {
	name?: string | null;
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
