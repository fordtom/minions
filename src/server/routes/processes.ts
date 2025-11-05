import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ProcessInputSchema, ProcessStatus } from "../../shared/types";
import type { ProcessDatabase } from "../db";
import { isFlakeRunning, killFlake, runFlake } from "../nix";

const HttpStatus = {
	CREATED: 201,
	BAD_REQUEST: 400,
	NOT_FOUND: 404,
	INTERNAL_SERVER_ERROR: 500,
} as const;

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
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	});

	// GET /api/processes/:id - Get single process with state
	app.get("/:id", (c) => {
		try {
			const id = Number.parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json(
					{ success: false, error: "Invalid ID" },
					HttpStatus.BAD_REQUEST
				);
			}

			const process = db.getProcessWithId(id);

			if (!process) {
				return c.json(
					{ success: false, error: "Process not found" },
					HttpStatus.NOT_FOUND
				);
			}

			return c.json({
				success: true,
				data: process,
			});
		} catch {
			return c.json(
				{ success: false, error: "Failed to fetch process" },
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	});

	// POST /api/processes - Create new process
	app.post(
		"/",
		zValidator("json", ProcessInputSchema, (result, c) => {
			if (!result.success) {
				return c.json(
					{ success: false, error: result.error.issues[0].message },
					HttpStatus.BAD_REQUEST
				);
			}
		}),
		async (c) => {
			try {
				const body = c.req.valid("json");

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
					HttpStatus.CREATED
				);
			} catch {
				return c.json(
					{ success: false, error: "Failed to create process" },
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
		}
	);

	// PUT /api/processes/:id - Update process
	app.put(
		"/:id",
		zValidator("json", ProcessInputSchema, (result, c) => {
			if (!result.success) {
				return c.json(
					{ success: false, error: result.error.issues[0].message },
					HttpStatus.BAD_REQUEST
				);
			}
		}),
		async (c) => {
			try {
				const id = Number.parseInt(c.req.param("id"), 10);

				if (Number.isNaN(id)) {
					return c.json(
						{ success: false, error: "Invalid ID" },
						HttpStatus.BAD_REQUEST
					);
				}

				const body = c.req.valid("json");

				const existing = db.getProcessWithId(id);
				if (!existing) {
					return c.json(
						{ success: false, error: "Process not found" },
						HttpStatus.NOT_FOUND
					);
				}

				// Don't allow updates while running
				if (existing.state.status === ProcessStatus.RUNNING) {
					return c.json(
						{
							success: false,
							error: "Cannot update running process. Stop it first.",
						},
						HttpStatus.BAD_REQUEST
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
				return c.json(
					{ success: false, error: "Failed to update process" },
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
		}
	);

	// DELETE /api/processes/:id - Delete process
	app.delete("/:id", async (c) => {
		try {
			const id = Number.parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json(
					{ success: false, error: "Invalid ID" },
					HttpStatus.BAD_REQUEST
				);
			}

			const process = db.getProcessWithId(id);
			if (!process) {
				return c.json(
					{ success: false, error: "Process not found" },
					HttpStatus.NOT_FOUND
				);
			}

			if (process.state.status === ProcessStatus.RUNNING && process.state.pid) {
				await killFlake(process.state.pid);
			}

			db.deleteProcess(id);

			return c.json({ success: true, data: { id } });
		} catch {
			return c.json(
				{ success: false, error: "Failed to delete process" },
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	});

	// POST /api/processes/:id/start - Start process
	app.post("/:id/start", (c) => {
		try {
			const id = Number.parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json(
					{ success: false, error: "Invalid ID" },
					HttpStatus.BAD_REQUEST
				);
			}

			const process = db.getProcessWithId(id);
			if (!process) {
				return c.json(
					{ success: false, error: "Process not found" },
					HttpStatus.NOT_FOUND
				);
			}

			if (
				process.state.status === ProcessStatus.RUNNING &&
				process.state.pid &&
				isFlakeRunning(process.state.pid)
			) {
				return c.json(
					{ success: false, error: "Process is already running" },
					HttpStatus.BAD_REQUEST
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
			return c.json(
				{ success: false, error: "Failed to start process" },
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	});

	// POST /api/processes/:id/stop - Stop process
	app.post("/:id/stop", async (c) => {
		try {
			const id = Number.parseInt(c.req.param("id"), 10);

			if (Number.isNaN(id)) {
				return c.json(
					{ success: false, error: "Invalid ID" },
					HttpStatus.BAD_REQUEST
				);
			}

			const process = db.getProcessWithId(id);
			if (!process) {
				return c.json(
					{ success: false, error: "Process not found" },
					HttpStatus.NOT_FOUND
				);
			}

			const state = process.state;
			if (state.status === ProcessStatus.STOPPED) {
				return c.json(
					{ success: false, error: "Process is already stopped" },
					HttpStatus.BAD_REQUEST
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
			return c.json(
				{ success: false, error: "Failed to stop process" },
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	});

	return app;
}
