import { Hono } from "hono";
import { type ProcessInput, ProcessStatus } from "../../shared/types";
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
				500
			);
		}
	});

	// GET /api/processes/:id - Get single process with state
	app.get("/:id", (c) => {
		try {
			const id = Number.parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json({ success: false, error: "Invalid ID" }, 400);
			}

			const process = db.getProcessWithId(id);

			if (!process) {
				return c.json({ success: false, error: "Process not found" }, 404);
			}

			return c.json({
				success: true,
				data: process,
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
				body.name ?? null
			);

			const process = db.getProcessWithId(id);

			return c.json(
				{
					success: true,
					data: process,
				},
				201
			);
		} catch {
			return c.json({ success: false, error: "Failed to create process" }, 500);
		}
	});

	// PUT /api/processes/:id - Update process
	app.put("/:id", async (c) => {
		try {
			const id = Number.parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json({ success: false, error: "Invalid ID" }, 400);
			}

			const body = await c.req.json<ProcessInput>();

			if (!body.flake_url) {
				return c.json({ success: false, error: "flake_url is required" }, 400);
			}

			const existing = db.getProcessWithId(id);
			if (!existing) {
				return c.json({ success: false, error: "Process not found" }, 404);
			}

			// Don't allow updates while running
			if (existing.state.status === ProcessStatus.RUNNING) {
				return c.json(
					{
						success: false,
						error: "Cannot update running process. Stop it first.",
					},
					400
				);
			}

			db.updateProcess(
				id,
				body.flake_url,
				body.env_vars ?? null,
				body.args ?? null,
				body.name ?? null
			);

			const updated = db.getProcessWithId(id);

			return c.json({
				success: true,
				data: updated,
			});
		} catch {
			return c.json({ success: false, error: "Failed to update process" }, 500);
		}
	});

	// DELETE /api/processes/:id - Delete process
	app.delete("/:id", async (c) => {
		try {
			const id = Number.parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json({ success: false, error: "Invalid ID" }, 400);
			}

			const process = db.getProcessWithId(id);
			if (!process) {
				return c.json({ success: false, error: "Process not found" }, 404);
			}

			if (process.state.status === ProcessStatus.RUNNING && process.state.pid) {
				await killFlake(process.state.pid);
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
			const id = Number.parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json({ success: false, error: "Invalid ID" }, 400);
			}

			const process = db.getProcessWithId(id);
			if (!process) {
				return c.json({ success: false, error: "Process not found" }, 404);
			}

			if (
				process.state.status === ProcessStatus.RUNNING &&
				process.state.pid &&
				isFlakeRunning(process.state.pid)
			) {
				return c.json(
					{ success: false, error: "Process is already running" },
					400
				);
			}

			const pid = runFlake(process.flake_url, process.env_vars, process.args);
			db.upsertProcessState(id, pid, ProcessStatus.RUNNING);

			const updated = db.getProcessWithId(id);

			return c.json({
				success: true,
				data: updated,
			});
		} catch {
			return c.json({ success: false, error: "Failed to start process" }, 500);
		}
	});

	// POST /api/processes/:id/stop - Stop process
	app.post("/:id/stop", async (c) => {
		try {
			const id = Number.parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json({ success: false, error: "Invalid ID" }, 400);
			}

			const process = db.getProcessWithId(id);
			if (!process) {
				return c.json({ success: false, error: "Process not found" }, 404);
			}

			const state = process.state;
			if (state.status === ProcessStatus.STOPPED) {
				return c.json(
					{ success: false, error: "Process is already stopped" },
					400
				);
			}

			if (state.pid && isFlakeRunning(state.pid)) {
				await killFlake(state.pid);
			}

			db.upsertProcessState(id, null, ProcessStatus.STOPPED);

			const updated = db.getProcessWithId(id);

			return c.json({
				success: true,
				data: updated,
			});
		} catch {
			return c.json({ success: false, error: "Failed to stop process" }, 500);
		}
	});

	return app;
}
