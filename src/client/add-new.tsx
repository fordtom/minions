import * as React from "react";
import type { ApiResponse, ProcessInput } from "../shared/types";
import { Button } from "./components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "./components/ui/card";

interface NewFlakeCardProps {
	open: boolean;
	onCancel: () => void;
	onSaved: () => void;
}

export function NewFlakeCard({ open, onCancel, onSaved }: NewFlakeCardProps) {
	const [flakeUrl, setFlakeUrl] = React.useState("");
	const [args, setArgs] = React.useState("");
	const [envVars, setEnvVars] = React.useState("");
	const [submitting, setSubmitting] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (!open) {
			setFlakeUrl("");
			setArgs("");
			setEnvVars("");
			setError(null);
			setSubmitting(false);
		}
	}, [open]);

	React.useEffect(() => {
		if (!open) return;
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
		};
		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [open, onCancel]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!flakeUrl.trim() || submitting) return;

		setSubmitting(true);
		setError(null);

		try {
			const payload: ProcessInput = {
				flake_url: flakeUrl.trim(),
				args: args.trim() || null,
				env_vars: envVars.trim() || null,
			};

			const res = await fetch("/api/processes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const result: ApiResponse<unknown> = await res.json();

			if (result.success) {
				onSaved();
			} else {
				setError(result.error || "Failed to create process");
			}
		} catch {
			setError("Failed to create process");
		} finally {
			setSubmitting(false);
		}
	};

	if (!open) return null;

	return (
		<button
			type="button"
			className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 cursor-default"
			onClick={onCancel}
			aria-label="Close modal"
		>
			<Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
				<form onSubmit={handleSubmit}>
					<CardHeader>
						<CardTitle>New flake</CardTitle>
						<CardDescription>
							Enter the flake's url, and any arguments or environment variables
							the process will need.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col gap-6">
							<div className="grid gap-2">
								<label
									htmlFor="flake-url"
									className="text-sm font-medium leading-none"
								>
									Flake URL
								</label>
								<input
									id="flake-url"
									type="text"
									value={flakeUrl}
									onChange={(e) => setFlakeUrl(e.target.value)}
									required
									className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
									placeholder="nixpkgs#hello"
								/>
							</div>
							<div className="grid gap-2">
								<label
									htmlFor="args"
									className="text-sm font-medium leading-none"
								>
									Args
								</label>
								<input
									id="args"
									type="text"
									value={args}
									onChange={(e) => setArgs(e.target.value)}
									className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
									placeholder="Optional CLI arguments"
								/>
							</div>
							<div className="grid gap-2">
								<label
									htmlFor="env-vars"
									className="text-sm font-medium leading-none"
								>
									Environment Variables
								</label>
								<textarea
									id="env-vars"
									value={envVars}
									onChange={(e) => setEnvVars(e.target.value)}
									rows={3}
									className="flex min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
									placeholder="KEY=value&#10;KEY2=value2"
								/>
							</div>
							{error && <div className="text-sm text-destructive">{error}</div>}
						</div>
					</CardContent>
					<CardFooter className="flex-col gap-2">
						<div className="flex w-full gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={onCancel}
								className="flex-1"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={submitting || !flakeUrl.trim()}
								className="flex-1"
							>
								Save
							</Button>
						</div>
					</CardFooter>
				</form>
			</Card>
		</button>
	);
}
