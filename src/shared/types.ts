import { z } from "zod";

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

export const ProcessInputSchema = z.object({
	flake_url: z.string().min(1, "Flake URL is required"),
	name: z.string().nullable().optional(),
	args: z.string().nullable().optional(),
	env_vars: z.string().nullable().optional(),
});

export type ProcessInput = z.infer<typeof ProcessInputSchema>;

// API response wrapper
export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}
