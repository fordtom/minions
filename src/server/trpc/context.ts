import type { ProcessDatabase } from "../db";
import { isFlakeRunning, killFlake, runFlake } from "../nix";

export interface Context extends Record<string, unknown> {
	db: ProcessDatabase;
	nix: {
		isFlakeRunning: typeof isFlakeRunning;
		killFlake: typeof killFlake;
		runFlake: typeof runFlake;
	};
}

export function createContext(db: ProcessDatabase) {
	return () => ({
		db,
		nix: {
			isFlakeRunning,
			killFlake,
			runFlake,
		},
	});
}
