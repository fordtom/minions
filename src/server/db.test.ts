import { describe, expect, test, beforeEach } from "bun:test";
import { ProcessDatabase } from "./db";
import type { ProcessStatus } from "../shared/types";

describe("ProcessDatabase", () => {
	let db: ProcessDatabase;

	beforeEach(() => {
		// Use in-memory database for each test
		db = new ProcessDatabase(":memory:");
	});

	describe("Process CRUD operations", () => {
		test("createProcess - creates a new process", () => {
			const id = db.createProcess("github:foo/bar", '{"KEY":"val"}', "--flag");
			expect(id).toBeGreaterThan(0);

			const process = db.getProcess(id);
			expect(process).toEqual({
				id,
				flake_url: "github:foo/bar",
				env_vars: '{"KEY":"val"}',
				args: "--flag",
			});
		});

		test("createProcess - creates process with null optional fields", () => {
			const id = db.createProcess("github:foo/bar");
			const process = db.getProcess(id);

			expect(process).toEqual({
				id,
				flake_url: "github:foo/bar",
				env_vars: null,
				args: null,
			});
		});

		test("getProcess - returns null for non-existent id", () => {
			const process = db.getProcess(999);
			expect(process).toBeNull();
		});

		test("listProcesses - returns all processes", () => {
			db.createProcess("github:foo/bar");
			db.createProcess("github:baz/qux");

			const processes = db.listProcesses();
			expect(processes).toHaveLength(2);
			expect(processes[0].flake_url).toBe("github:foo/bar");
			expect(processes[1].flake_url).toBe("github:baz/qux");
		});

		test("listProcesses - returns empty array when no processes", () => {
			const processes = db.listProcesses();
			expect(processes).toEqual([]);
		});

		test("updateProcess - updates existing process", () => {
			const id = db.createProcess("github:foo/bar");
			db.updateProcess(id, "github:new/url", '{"NEW":"env"}', "--new-arg");

			const process = db.getProcess(id);
			expect(process).toEqual({
				id,
				flake_url: "github:new/url",
				env_vars: '{"NEW":"env"}',
				args: "--new-arg",
			});
		});

		test("deleteProcess - removes process", () => {
			const id = db.createProcess("github:foo/bar");
			db.deleteProcess(id);

			const process = db.getProcess(id);
			expect(process).toBeNull();
		});
	});

	describe("ProcessState CRUD operations", () => {
		test("getProcessState - returns initial STOPPED state after creation", () => {
			const id = db.createProcess("github:foo/bar");
			const state = db.getProcessState(id);

			expect(state).toEqual({
				process_id: id,
				pid: null,
				status: "STOPPED",
			});
		});

		test("upsertProcessState - creates/updates state", () => {
			const id = db.createProcess("github:foo/bar");
			db.upsertProcessState(id, 12345, "RUNNING");

			const state = db.getProcessState(id);
			expect(state).toEqual({
				process_id: id,
				pid: 12345,
				status: "RUNNING",
			});
		});

		test("upsertProcessState - updates existing state", () => {
			const id = db.createProcess("github:foo/bar");
			db.upsertProcessState(id, 12345, "RUNNING");
			db.upsertProcessState(id, null, "STOPPED");

			const state = db.getProcessState(id);
			expect(state).toEqual({
				process_id: id,
				pid: null,
				status: "STOPPED",
			});
		});

		test("getProcessState - returns null for non-existent process", () => {
			const state = db.getProcessState(999);
			expect(state).toBeNull();
		});

		test("deleteProcess - cascades to process_state", () => {
			const id = db.createProcess("github:foo/bar");
			db.upsertProcessState(id, 12345, "RUNNING");
			db.deleteProcess(id);

			const state = db.getProcessState(id);
			expect(state).toBeNull();
		});
	});

	describe("listProcessesWithState", () => {
		test("returns processes with their state", () => {
			const id1 = db.createProcess("github:foo/bar");
			const id2 = db.createProcess("github:baz/qux");
			db.upsertProcessState(id1, 111, "RUNNING");
			db.upsertProcessState(id2, 222, "STOPPED");

			const result = db.listProcessesWithState();
			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				id: id1,
				flake_url: "github:foo/bar",
				env_vars: null,
				args: null,
				state: {
					process_id: id1,
					pid: 111,
					status: "RUNNING",
				},
			});
			expect(result[1]).toEqual({
				id: id2,
				flake_url: "github:baz/qux",
				env_vars: null,
				args: null,
				state: {
					process_id: id2,
					pid: 222,
					status: "STOPPED",
				},
			});
		});

		test("returns empty array when no processes", () => {
			const result = db.listProcessesWithState();
			expect(result).toEqual([]);
		});
	});
});
