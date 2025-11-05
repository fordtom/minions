import { beforeEach, describe, expect, test } from "bun:test";
import { ProcessStatus } from "../shared/types";
import { ProcessDatabase } from "./db";

const NON_EXISTENT_ID = 999;
const TEST_PID_1 = 12_345;
const TEST_PID_2 = 111;
const TEST_WAIT_MS = 10;

describe("ProcessDatabase", () => {
	let db: ProcessDatabase;

	beforeEach(() => {
		// Use in-memory database for each test
		db = new ProcessDatabase(":memory:");
	});

	describe("Process CRUD operations", () => {
		test("createProcess - creates a new process", () => {
			const id = db.createProcess(
				"github:foo/bar#baz",
				'{"KEY":"val"}',
				"--flag",
				"test-process"
			);
			expect(id).toBeGreaterThan(0);

			const process = db.getProcess(id);
			expect(process?.id).toBe(id);
			expect(process?.name).toBe("test-process");
			expect(process?.flake_url).toBe("github:foo/bar#baz");
			expect(process?.env_vars).toBe('{"KEY":"val"}');
			expect(process?.args).toBe("--flag");
			expect(process?.created_at).toBeGreaterThan(0);
			expect(process?.updated_at).toBeGreaterThan(0);
		});

		test("createProcess - creates process with null optional fields", () => {
			const id = db.createProcess("github:foo/bar#baz");
			const process = db.getProcess(id);

			expect(process?.id).toBe(id);
			expect(process?.name).toBeNull();
			expect(process?.flake_url).toBe("github:foo/bar#baz");
			expect(process?.env_vars).toBeNull();
			expect(process?.args).toBeNull();
			expect(process?.created_at).toBeGreaterThan(0);
			expect(process?.updated_at).toBeGreaterThan(0);
		});

		test("getProcess - returns null for non-existent id", () => {
			const process = db.getProcess(NON_EXISTENT_ID);
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
			const original = db.getProcess(id);
			const originalUpdatedAt = original?.updated_at;

			// Wait a bit to ensure updated_at changes
			const wait = (ms: number) =>
				new Promise((resolve) => setTimeout(resolve, ms));
			wait(TEST_WAIT_MS);

			db.updateProcess(id, {
				flake_url: "github:new/url#flake",
				env_vars: '{"NEW":"env"}',
				args: "--new-arg",
				name: "updated-name",
			});

			const process = db.getProcess(id);
			expect(process?.id).toBe(id);
			expect(process?.name).toBe("updated-name");
			expect(process?.flake_url).toBe("github:new/url#flake");
			expect(process?.env_vars).toBe('{"NEW":"env"}');
			expect(process?.args).toBe("--new-arg");
			if (originalUpdatedAt !== null && originalUpdatedAt !== undefined) {
				expect(process?.updated_at).toBeGreaterThanOrEqual(originalUpdatedAt);
			}
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

			expect(state?.process_id).toBe(id);
			expect(state?.pid).toBeNull();
			expect(state?.status).toBe(ProcessStatus.STOPPED);
			expect(state?.started_at).toBeNull();
		});

		test("upsertProcessState - creates/updates state with started_at when RUNNING", () => {
			const id = db.createProcess("github:foo/bar#baz");
			db.upsertProcessState(id, TEST_PID_1, ProcessStatus.RUNNING);

			const state = db.getProcessState(id);
			expect(state?.process_id).toBe(id);
			expect(state?.pid).toBe(TEST_PID_1);
			expect(state?.status).toBe(ProcessStatus.RUNNING);
			expect(state?.started_at).toBeGreaterThan(0);
		});

		test("upsertProcessState - updates existing state with null started_at when STOPPED", () => {
			const id = db.createProcess("github:foo/bar#baz");
			db.upsertProcessState(id, TEST_PID_1, ProcessStatus.RUNNING);
			db.upsertProcessState(id, null, ProcessStatus.STOPPED);

			const state = db.getProcessState(id);
			expect(state?.process_id).toBe(id);
			expect(state?.pid).toBeNull();
			expect(state?.status).toBe(ProcessStatus.STOPPED);
			expect(state?.started_at).toBeNull();
		});

		test("getProcessState - returns null for non-existent process", () => {
			const state = db.getProcessState(NON_EXISTENT_ID);
			expect(state).toBeNull();
		});

		test("deleteProcess - cascades to process_state", () => {
			const id = db.createProcess("github:foo/bar#baz");
			db.upsertProcessState(id, TEST_PID_1, ProcessStatus.RUNNING);
			db.deleteProcess(id);

			const state = db.getProcessState(id);
			expect(state).toBeNull();
		});
	});

	describe("getProcessWithId", () => {
		test("returns process with state", () => {
			const id = db.createProcess(
				"github:foo/bar#baz",
				'{"KEY":"val"}',
				"--flag",
				"test-process"
			);
			db.upsertProcessState(id, TEST_PID_2, ProcessStatus.RUNNING);

			const result = db.getProcessWithId(id);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(id);
			expect(result?.name).toBe("test-process");
			expect(result?.flake_url).toBe("github:foo/bar#baz");
			expect(result?.env_vars).toBe('{"KEY":"val"}');
			expect(result?.args).toBe("--flag");
			expect(result?.created_at).toBeGreaterThan(0);
			expect(result?.updated_at).toBeGreaterThan(0);
			expect(result?.state.process_id).toBe(id);
			expect(result?.state.pid).toBe(TEST_PID_2);
			expect(result?.state.status).toBe(ProcessStatus.RUNNING);
			expect(result?.state.started_at).toBeGreaterThan(0);
		});

		test("returns null for non-existent process", () => {
			const result = db.getProcessWithId(NON_EXISTENT_ID);
			expect(result).toBeNull();
		});
	});

	describe("listProcessesWithState", () => {
		test("returns processes with their state", () => {
			const id1 = db.createProcess(
				"github:foo/bar#baz",
				null,
				null,
				"process-1"
			);
			const id2 = db.createProcess(
				"github:my/test#flake",
				null,
				null,
				"process-2"
			);
			db.upsertProcessState(id1, TEST_PID_2, ProcessStatus.RUNNING);
			db.upsertProcessState(id2, null, ProcessStatus.STOPPED);

			const result = db.listProcessesWithState();
			expect(result).toHaveLength(2);

			expect(result[0].id).toBe(id1);
			expect(result[0].name).toBe("process-1");
			expect(result[0].flake_url).toBe("github:foo/bar#baz");
			expect(result[0].env_vars).toBeNull();
			expect(result[0].args).toBeNull();
			expect(result[0].created_at).toBeGreaterThan(0);
			expect(result[0].updated_at).toBeGreaterThan(0);
			expect(result[0].state.process_id).toBe(id1);
			expect(result[0].state.pid).toBe(TEST_PID_2);
			expect(result[0].state.status).toBe(ProcessStatus.RUNNING);
			expect(result[0].state.started_at).toBeGreaterThan(0);

			expect(result[1].id).toBe(id2);
			expect(result[1].name).toBe("process-2");
			expect(result[1].flake_url).toBe("github:my/test#flake");
			expect(result[1].env_vars).toBeNull();
			expect(result[1].args).toBeNull();
			expect(result[1].created_at).toBeGreaterThan(0);
			expect(result[1].updated_at).toBeGreaterThan(0);
			expect(result[1].state.process_id).toBe(id2);
			expect(result[1].state.pid).toBeNull();
			expect(result[1].state.status).toBe(ProcessStatus.STOPPED);
			expect(result[1].state.started_at).toBeNull();
		});

		test("returns empty array when no processes", () => {
			const result = db.listProcessesWithState();
			expect(result).toEqual([]);
		});
	});
});
