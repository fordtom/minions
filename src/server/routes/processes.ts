import { Hono } from "hono";
import {
	type Process,
	type ProcessInput,
	type ProcessState,
	ProcessStatus,
} from "../../shared/types";
import type { ProcessDatabase } from "../db";
import { isFlakeRunning, killFlake, runFlake } from "../nix";

export default function processRoutes(db: ProcessDatabase) {
	const app = new Hono();

	// GET /api/processes - List all processes with state
	app.get("/", (c) => {
		try {
			const processes = db.listProcessesWithState();
			return c.json({ success: true, data: processes });
		} catch {
			return c.json(
				{ success: false, error: "Failed to fetch processes" },
				500,
			);
		}
	});

	// GET /api/processes/:id - Get single process with state
	app.get("/:id", (c) => {
		try {
			const id = parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json({ success: false, error: "Invalid ID" }, 400);
			}

			const process = db.getProcess(id);

			if (!process) {
				return c.json({ success: false, error: "Process not found" }, 404);
			}

			const state = db.getProcessState(id);

			return c.json({
				success: true,
				data: {
					...process,
					state: state as ProcessState,
				},
			});
		} catch {
			return c.json({ success: false, error: "Failed to fetch process" }, 500);
		}
	});

	// POST /api/processes - Create new process
	app.post("/", async (c) => {
		try {
			const body = await c.req.json<ProcessInput>();

			if (!body.flake_url) {
				return c.json({ success: false, error: "flake_url is required" }, 400);
			}

			const id = db.createProcess(
				body.flake_url,
				body.env_vars ?? null,
				body.args ?? null,
			);

			const process = db.getProcess(id);
			const state = db.getProcessState(id);

			return c.json(
				{
					success: true,
					data: {
						...(process as Process),
						state: state as ProcessState,
					},
				},
				201,
			);
		} catch {
			return c.json({ success: false, error: "Failed to create process" }, 500);
		}
	});

	// PUT /api/processes/:id - Update process
	app.put("/:id", async (c) => {
		try {
			const id = parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json({ success: false, error: "Invalid ID" }, 400);
			}

			const body = await c.req.json<ProcessInput>();

			if (!body.flake_url) {
				return c.json({ success: false, error: "flake_url is required" }, 400);
			}

			const existing = db.getProcess(id);
			if (!existing) {
				return c.json({ success: false, error: "Process not found" }, 404);
			}

			// Don't allow updates while running
			const state = db.getProcessState(id) as ProcessState;
			if (state.status === ProcessStatus.RUNNING) {
				return c.json(
					{
						success: false,
						error: "Cannot update running process. Stop it first.",
					},
					400,
				);
			}

			db.updateProcess(
				id,
				body.flake_url,
				body.env_vars ?? null,
				body.args ?? null,
			);

			const updated = db.getProcess(id);
			const updatedState = db.getProcessState(id);

			return c.json({
				success: true,
				data: {
					...(updated as Process),
					state: updatedState as ProcessState,
				},
			});
		} catch {
			return c.json({ success: false, error: "Failed to update process" }, 500);
		}
	});

	// DELETE /api/processes/:id - Delete process
	app.delete("/:id", (c) => {
		try {
			const id = parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json({ success: false, error: "Invalid ID" }, 400);
			}

			const process = db.getProcess(id);
			if (!process) {
				return c.json({ success: false, error: "Process not found" }, 404);
			}

			const state = db.getProcessState(id) as ProcessState;
			if (state.status === ProcessStatus.RUNNING && state.pid) {
				killFlake(state.pid);
			}

			db.deleteProcess(id);

			return c.json({ success: true, data: { id } });
		} catch {
			return c.json({ success: false, error: "Failed to delete process" }, 500);
		}
	});

	// POST /api/processes/:id/start - Start process
	app.post("/:id/start", (c) => {
		try {
			const id = parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json({ success: false, error: "Invalid ID" }, 400);
			}

			const process = db.getProcess(id);
			if (!process) {
				return c.json({ success: false, error: "Process not found" }, 404);
			}

			const state = db.getProcessState(id) as ProcessState;
			if (
				state.status === ProcessStatus.RUNNING &&
				state.pid &&
				isFlakeRunning(state.pid)
			) {
				return c.json(
					{ success: false, error: "Process is already running" },
					400,
				);
			}

			const pid = runFlake(process.flake_url, process.env_vars, process.args);
			db.upsertProcessState(id, pid, ProcessStatus.RUNNING);
			const newState = db.getProcessState(id);

			return c.json({
				success: true,
				data: {
					...(process as Process),
					state: newState as ProcessState,
				},
			});
		} catch {
			return c.json({ success: false, error: "Failed to start process" }, 500);
		}
	});

	// POST /api/processes/:id/stop - Stop process
	app.post("/:id/stop", (c) => {
		try {
			const id = parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json({ success: false, error: "Invalid ID" }, 400);
			}

			const process = db.getProcess(id);
			if (!process) {
				return c.json({ success: false, error: "Process not found" }, 404);
			}

			const state = db.getProcessState(id) as ProcessState;
			if (state.status === ProcessStatus.STOPPED) {
				return c.json(
					{ success: false, error: "Process is already stopped" },
					400,
				);
			}

			if (state.pid && isFlakeRunning(state.pid)) {
				killFlake(state.pid);
			}

			db.upsertProcessState(id, null, ProcessStatus.STOPPED);
			const newState = db.getProcessState(id);

			return c.json({
				success: true,
				data: {
					...(process as Process),
					state: newState as ProcessState,
				},
			});
		} catch {
			return c.json({ success: false, error: "Failed to stop process" }, 500);
		}
	});

	return app;
}
