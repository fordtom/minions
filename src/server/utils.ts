import { parse as parseDotenv } from "dotenv";
import { parse as parseShellArgs } from "shell-quote";

// Parse environment variables from dotenv format
export function parseEnvVars(
	envString: string | null | undefined,
): Record<string, string> {
	if (!envString?.trim()) return {};
	return parseDotenv(envString);
}

// Parse command-line arguments
export function parseArgs(argsString: string | null | undefined): string[] {
	if (!argsString?.trim()) return [];

	const parsed = parseShellArgs(argsString);

	// Reject shell operators - they won't work in direct process spawn
	for (const token of parsed) {
		if (typeof token === "object" && "op" in token) {
			throw new Error(
				`Shell operators (${token.op}) are not supported. Use plain CLI arguments only.`,
			);
		}
	}

	return parsed.filter((arg): arg is string => typeof arg === "string");
}
