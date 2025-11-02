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

	// Filter to only string arguments (shell-quote can return objects for special syntax)
	return parsed.filter((arg): arg is string => typeof arg === "string");
}
