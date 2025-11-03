import { Database } from "bun:sqlite";
import type {
	Process,
	ProcessState,
	ProcessStatus,
	ProcessWithState,
} from "../shared/types";

interface ProcessWithStateRow {
	id: number;
	name: string | null;
	flake_url: string;
	env_vars: string | null;
	args: string | null;
	created_at: number;
	updated_at: number;
	process_id: number;
	pid: number | null;
	status: string;
	started_at: number | null;
}

export class ProcessDatabase {
	private db: Database;

	constructor(path: string = "minions.db") {
		this.db = new Database(path);
		this.db.run("PRAGMA foreign_keys = ON");
		this.initSchema();
	}

	private initSchema(): void {
		this.db.run(`
            CREATE TABLE IF NOT EXISTS processes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT,
              flake_url TEXT NOT NULL,
              env_vars TEXT,
              args TEXT,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
          `);

		this.db.run(`
            CREATE TABLE IF NOT EXISTS process_state (
              process_id INTEGER PRIMARY KEY,
              pid INTEGER,
              status TEXT NOT NULL,
              started_at INTEGER,
              FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE
            )
          `);

		this.db.run(`
            CREATE TRIGGER IF NOT EXISTS create_initial_state
            AFTER INSERT ON processes
            BEGIN
              INSERT INTO process_state (process_id, pid, status, started_at)
              VALUES (NEW.id, NULL, 'STOPPED', NULL);
            END
          `);

		// Migration: Add new columns if they don't exist
		this.migrateSchema();
	}

	private migrateSchema(): void {
		// Check if name column exists in processes
		const processesInfo = this.db
			.prepare("PRAGMA table_info(processes)")
			.all() as Array<{ name: string }>;
		const hasName = processesInfo.some((col) => col.name === "name");
		const hasCreatedAt = processesInfo.some((col) => col.name === "created_at");
		const hasUpdatedAt = processesInfo.some((col) => col.name === "updated_at");

		const now = Date.now();

		if (!hasName) {
			this.db.run("ALTER TABLE processes ADD COLUMN name TEXT");
		}
		if (!hasCreatedAt) {
			this.db.run(
				"ALTER TABLE processes ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0",
			);
			this.db.run(`UPDATE processes SET created_at = ${now} WHERE created_at = 0`);
		}
		if (!hasUpdatedAt) {
			this.db.run(
				"ALTER TABLE processes ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
			);
			this.db.run(`UPDATE processes SET updated_at = ${now} WHERE updated_at = 0`);
		}

		// Check if started_at column exists in process_state
		const stateInfo = this.db
			.prepare("PRAGMA table_info(process_state)")
			.all() as Array<{ name: string }>;
		const hasStartedAt = stateInfo.some((col) => col.name === "started_at");

		if (!hasStartedAt) {
			this.db.run("ALTER TABLE process_state ADD COLUMN started_at INTEGER");
		}
	}

	close(): void {
		this.db.close();
	}

	createProcess(
		flake_url: string,
		env_vars?: string | null,
		args?: string | null,
		name?: string | null,
	): number {
		const now = Date.now();
		const stmt = this.db.prepare(
			"INSERT INTO processes (name, flake_url, env_vars, args, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		);
		const result = stmt.run(
			name ?? null,
			flake_url,
			env_vars ?? null,
			args ?? null,
			now,
			now,
		);
		return result.lastInsertRowid as number;
	}

	getProcess(id: number): Process | null {
		const stmt = this.db.prepare(
			"SELECT id, name, flake_url, env_vars, args, created_at, updated_at FROM processes WHERE id = ?",
		);
		return stmt.get(id) as Process | null;
	}

	listProcesses(): Process[] {
		const stmt = this.db.prepare(
			"SELECT id, name, flake_url, env_vars, args, created_at, updated_at FROM processes",
		);
		return stmt.all() as Process[];
	}

	updateProcess(
		id: number,
		flake_url: string,
		env_vars?: string | null,
		args?: string | null,
		name?: string | null,
	): void {
		const now = Date.now();
		const stmt = this.db.prepare(
			"UPDATE processes SET name = ?, flake_url = ?, env_vars = ?, args = ?, updated_at = ? WHERE id = ?",
		);
		stmt.run(name ?? null, flake_url, env_vars ?? null, args ?? null, now, id);
	}

	deleteProcess(id: number): void {
		const stmt = this.db.prepare("DELETE FROM processes WHERE id = ?");
		stmt.run(id);
	}

	upsertProcessState(
		process_id: number,
		pid: number | null,
		status: ProcessStatus,
	): void {
		const started_at = status === "RUNNING" ? Date.now() : null;
		const stmt = this.db.prepare(
			"INSERT OR REPLACE INTO process_state (process_id, pid, status, started_at) VALUES (?, ?, ?, ?)",
		);
		stmt.run(process_id, pid, status, started_at);
	}

	getProcessState(process_id: number): ProcessState | null {
		const stmt = this.db.prepare(
			"SELECT process_id, pid, status, started_at FROM process_state WHERE process_id = ?",
		);
		return stmt.get(process_id) as ProcessState | null;
	}

	getProcessWithId(id: number): ProcessWithState | null {
		const stmt = this.db.prepare(`
          SELECT 
            p.id,
            p.name,
            p.flake_url,
            p.env_vars,
            p.args,
            p.created_at,
            p.updated_at,
            ps.process_id,
            ps.pid,
            ps.status,
            ps.started_at
          FROM processes p
          INNER JOIN process_state ps ON p.id = ps.process_id
          WHERE p.id = ?
        `);

		const row = stmt.get(id) as ProcessWithStateRow | null;

		if (!row) {
			return null;
		}

		return {
			id: row.id,
			name: row.name,
			flake_url: row.flake_url,
			env_vars: row.env_vars,
			args: row.args,
			created_at: row.created_at,
			updated_at: row.updated_at,
			state: {
				process_id: row.process_id,
				pid: row.pid,
				status: row.status as ProcessStatus,
				started_at: row.started_at,
			},
		};
	}

	listProcessesWithState(): ProcessWithState[] {
		const stmt = this.db.prepare(`
          SELECT 
            p.id,
            p.name,
            p.flake_url,
            p.env_vars,
            p.args,
            p.created_at,
            p.updated_at,
            ps.process_id,
            ps.pid,
            ps.status,
            ps.started_at
          FROM processes p
          INNER JOIN process_state ps ON p.id = ps.process_id
        `);

		const rows = stmt.all() as ProcessWithStateRow[];

		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			flake_url: row.flake_url,
			env_vars: row.env_vars,
			args: row.args,
			created_at: row.created_at,
			updated_at: row.updated_at,
			state: {
				process_id: row.process_id,
				pid: row.pid,
				status: row.status as ProcessStatus,
				started_at: row.started_at,
			},
		}));
	}
}
