import { describe, expect, it } from "bun:test";

import { parseArgs, parseEnvVars } from "./utils";

describe("parseEnvVars", () => {
	it("returns empty object for nullish or blank input", () => {
		expect(parseEnvVars(undefined)).toEqual({});
		expect(parseEnvVars(null)).toEqual({});
		expect(parseEnvVars("   \n\t")).toEqual({});
	});

	it("parses dotenv formatted strings with comments and quotes", () => {
		const envString = `# comment\nFOO=bar\nBAR="baz qux"\nQUOTED_SINGLE='single value'\nEMPTY=""\n`;
		expect(parseEnvVars(envString)).toEqual({
			FOO: "bar",
			BAR: "baz qux",
			QUOTED_SINGLE: "single value",
			EMPTY: "",
		});
	});
});

describe("parseArgs", () => {
	it("returns empty array for nullish or blank input", () => {
		expect(parseArgs(undefined)).toEqual([]);
		expect(parseArgs(null)).toEqual([]);
		expect(parseArgs("   \n\t")).toEqual([]);
	});

	it("handles quoted arguments and escapes", () => {
		const argsString = "run-task \"quoted arg\" 'single quoted' escaped\\ space";
		expect(parseArgs(argsString)).toEqual([
			"run-task",
			"quoted arg",
			"single quoted",
			"escaped space",
		]);
	});

	it("rejects shell operators with clear error", () => {
		expect(() => parseArgs("foo | grep bar")).toThrow(
			"Shell operators (|) are not supported",
		);
		expect(() => parseArgs("foo > out.txt")).toThrow(
			"Shell operators (>) are not supported",
		);
	});
});
