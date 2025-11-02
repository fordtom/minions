import { Database } from "bun:sqlite";
import type {
	Process,
	ProcessState,
	ProcessStatus,
	ProcessWithState,
} from "../shared/types";

interface ProcessWithStateRow {
	id: number;
	flake_url: string;
	env_vars: string | null;
	args: string | null;
	process_id: number;
	pid: number | null;
	status: string;
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
              flake_url TEXT NOT NULL,
              env_vars TEXT,
              args TEXT
            )
          `);

		this.db.run(`
            CREATE TABLE IF NOT EXISTS process_state (
              process_id INTEGER PRIMARY KEY,
              pid INTEGER,
              status TEXT NOT NULL,
              FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE
            )
          `);

		this.db.run(`
            CREATE TRIGGER IF NOT EXISTS create_initial_state
            AFTER INSERT ON processes
            BEGIN
              INSERT INTO process_state (process_id, pid, status)
              VALUES (NEW.id, NULL, 'STOPPED');
            END
          `);
	}

	close(): void {
		this.db.close();
	}

	createProcess(
		flake_url: string,
		env_vars?: string | null,
		args?: string | null,
	): number {
		const stmt = this.db.prepare(
			"INSERT INTO processes (flake_url, env_vars, args) VALUES (?, ?, ?)",
		);
		const result = stmt.run(flake_url, env_vars ?? null, args ?? null);
		return result.lastInsertRowid as number;
	}

	getProcess(id: number): Process | null {
		const stmt = this.db.prepare(
			"SELECT id, flake_url, env_vars, args FROM processes WHERE id = ?",
		);
		return stmt.get(id) as Process | null;
	}

	listProcesses(): Process[] {
		const stmt = this.db.prepare(
			"SELECT id, flake_url, env_vars, args FROM processes",
		);
		return stmt.all() as Process[];
	}

	updateProcess(
		id: number,
		flake_url: string,
		env_vars?: string | null,
		args?: string | null,
	): void {
		const stmt = this.db.prepare(
			"UPDATE processes SET flake_url = ?, env_vars = ?, args = ? WHERE id = ?",
		);
		stmt.run(flake_url, env_vars ?? null, args ?? null, id);
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
		const stmt = this.db.prepare(
			"INSERT OR REPLACE INTO process_state (process_id, pid, status) VALUES (?, ?, ?)",
		);
		stmt.run(process_id, pid, status);
	}

	getProcessState(process_id: number): ProcessState | null {
		const stmt = this.db.prepare(
			"SELECT process_id, pid, status FROM process_state WHERE process_id = ?",
		);
		return stmt.get(process_id) as ProcessState | null;
	}

	listProcessesWithState(): ProcessWithState[] {
		const stmt = this.db.prepare(`
          SELECT 
            p.id,
            p.flake_url,
            p.env_vars,
            p.args,
            ps.process_id,
            ps.pid,
            ps.status
          FROM processes p
          INNER JOIN process_state ps ON p.id = ps.process_id
        `);

		const rows = stmt.all() as ProcessWithStateRow[];

		return rows.map((row) => ({
			id: row.id,
			flake_url: row.flake_url,
			env_vars: row.env_vars,
			args: row.args,
			state: {
				process_id: row.process_id,
				pid: row.pid,
				status: row.status as ProcessStatus,
			},
		}));
	}
}
