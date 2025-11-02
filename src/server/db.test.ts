import { describe, expect, test, beforeEach } from "bun:test";
import { ProcessDatabase } from "./db";
import { ProcessStatus } from "../shared/types";

describe("ProcessDatabase", () => {
	let db: ProcessDatabase;

	beforeEach(() => {
		// Use in-memory database for each test
		db = new ProcessDatabase(":memory:");
	});

	describe("Process CRUD operations", () => {
		test("createProcess - creates a new process", () => {
			const id = db.createProcess("github:foo/bar#baz", '{"KEY":"val"}', "--flag");
			expect(id).toBeGreaterThan(0);

			const process = db.getProcess(id);
			expect(process).toEqual({
				id,
				flake_url: "github:foo/bar#baz",
				env_vars: '{"KEY":"val"}',
				args: "--flag",
			});
		});

		test("createProcess - creates process with null optional fields", () => {
			const id = db.createProcess("github:foo/bar#baz");
			const process = db.getProcess(id);

			expect(process).toEqual({
				id,
				flake_url: "github:foo/bar#baz",
				env_vars: null,
				args: null,
			});
		});

		test("getProcess - returns null for non-existent id", () => {
			const process = db.getProcess(999);
			expect(process).toBeNull();
		});

		test("listProcesses - returns all processes", () => {
			db.createProcess("github:foo/bar#baz");
			db.createProcess("github:my/test#flake");

			const processes = db.listProcesses();
			expect(processes).toHaveLength(2);
			expect(processes[0].flake_url).toBe("github:foo/bar#baz");
			expect(processes[1].flake_url).toBe("github:my/test#flake");
		});

		test("listProcesses - returns empty array when no processes", () => {
			const processes = db.listProcesses();
			expect(processes).toEqual([]);
		});

		test("updateProcess - updates existing process", () => {
			const id = db.createProcess("github:foo/bar#baz");
			db.updateProcess(id, "github:new/url#flake", '{"NEW":"env"}', "--new-arg");

			const process = db.getProcess(id);
			expect(process).toEqual({
				id,
				flake_url: "github:new/url#flake",
				env_vars: '{"NEW":"env"}',
				args: "--new-arg",
			});
		});

		test("deleteProcess - removes process", () => {
			const id = db.createProcess("github:foo/bar#baz");
			db.deleteProcess(id);

			const process = db.getProcess(id);
			expect(process).toBeNull();
		});
	});

	describe("ProcessState CRUD operations", () => {
		test("getProcessState - returns initial STOPPED state after creation", () => {
			const id = db.createProcess("github:foo/bar#baz");
			const state = db.getProcessState(id);

			expect(state).toEqual({
				process_id: id,
				pid: null,
				status: ProcessStatus.STOPPED,
			});
		});

		test("upsertProcessState - creates/updates state", () => {
			const id = db.createProcess("github:foo/bar#baz");
			db.upsertProcessState(id, 12345, ProcessStatus.RUNNING);

			const state = db.getProcessState(id);
			expect(state).toEqual({
				process_id: id,
				pid: 12345,
				status: ProcessStatus.RUNNING,
			});
		});

		test("upsertProcessState - updates existing state", () => {
			const id = db.createProcess("github:foo/bar#baz");
			db.upsertProcessState(id, 12345, ProcessStatus.RUNNING);
			db.upsertProcessState(id, null, ProcessStatus.STOPPED);

			const state = db.getProcessState(id);
			expect(state).toEqual({
				process_id: id,
				pid: null,
				status: ProcessStatus.STOPPED,
			});
		});

		test("getProcessState - returns null for non-existent process", () => {
			const state = db.getProcessState(999);
			expect(state).toBeNull();
		});

		test("deleteProcess - cascades to process_state", () => {
			const id = db.createProcess("github:foo/bar#baz");
			db.upsertProcessState(id, 12345, ProcessStatus.RUNNING);
			db.deleteProcess(id);

			const state = db.getProcessState(id);
			expect(state).toBeNull();
		});
	});

	describe("listProcessesWithState", () => {
		test("returns processes with their state", () => {
			const id1 = db.createProcess("github:foo/bar#baz");
			const id2 = db.createProcess("github:my/test#flake");
			db.upsertProcessState(id1, 111, ProcessStatus.RUNNING);
			db.upsertProcessState(id2, 222, ProcessStatus.STOPPED);

			const result = db.listProcessesWithState();
			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				id: id1,
				flake_url: "github:foo/bar#baz",
				env_vars: null,
				args: null,
				state: {
					process_id: id1,
					pid: 111,
					status: ProcessStatus.RUNNING,
				},
			});
			expect(result[1]).toEqual({
				id: id2,
				flake_url: "github:my/test#flake",
				env_vars: null,
				args: null,
				state: {
					process_id: id2,
					pid: 222,
					status: ProcessStatus.STOPPED,
				},
			});
		});

		test("returns empty array when no processes", () => {
			const result = db.listProcessesWithState();
			expect(result).toEqual([]);
		});
	});
});
