import { useEffect, useState } from "react";
import type { ProcessInput } from "../shared/types";
import { Button } from "./components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "./components/ui/card";
import { trpc } from "./lib/trpc";

type NewFlakeCardProps = {
	open: boolean;
	onCancel: () => void;
	onSaved: () => void;
};

export function NewFlakeCard({ open, onCancel, onSaved }: NewFlakeCardProps) {
	const [name, setName] = useState("");
	const [flakeUrl, setFlakeUrl] = useState("");
	const [args, setArgs] = useState("");
	const [envVars, setEnvVars] = useState("");
	const [error, setError] = useState<string | null>(null);

	const createMutation = trpc.processes.create.useMutation({
		onSuccess: () => {
			onSaved();
		},
		onError: (err) => {
			setError(err.message || "Failed to create process");
		},
	});

	useEffect(() => {
		if (!open) {
			setName("");
			setFlakeUrl("");
			setArgs("");
			setEnvVars("");
			setError(null);
		}
	}, [open]);

	useEffect(() => {
		if (!open) {
			return;
		}
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onCancel();
			}
		};
		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [open, onCancel]);

	const handleSubmit = (e: { preventDefault: () => void }) => {
		e.preventDefault();
		if (!flakeUrl.trim() || createMutation.isPending) {
			return;
		}

		setError(null);

		const payload: ProcessInput = {
			name: name.trim() || null,
			flake_url: flakeUrl.trim(),
			args: args.trim() || null,
			env_vars: envVars.trim() || null,
		};

		createMutation.mutate(payload);
	};

	if (!open) {
		return null;
	}

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: we want to close the modal when the user clicks outside of it
		// biome-ignore lint/a11y/noStaticElementInteractions: we want to close the modal when the user clicks outside of it
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: we want to close the modal when the user clicks outside of it
		<div
			className="fixed inset-0 z-50 grid cursor-default place-items-center bg-black/50 p-4"
			onClick={onCancel}
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
									className="font-medium text-sm leading-none"
									htmlFor="name"
								>
									Name
								</label>
								<input
									className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
									id="name"
									onChange={(e) => setName(e.target.value)}
									placeholder="Name"
									type="text"
									value={name}
								/>
							</div>
							<div className="grid gap-2">
								<label
									className="font-medium text-sm leading-none"
									htmlFor="flake-url"
								>
									Flake URL (required)
								</label>
								<input
									className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
									id="flake-url"
									onChange={(e) => setFlakeUrl(e.target.value)}
									placeholder="nixpkgs#hello"
									required
									type="text"
									value={flakeUrl}
								/>
							</div>
							<div className="grid gap-2">
								<label
									className="font-medium text-sm leading-none"
									htmlFor="args"
								>
									Args
								</label>
								<input
									className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
									id="args"
									onChange={(e) => setArgs(e.target.value)}
									placeholder="Optional CLI arguments"
									type="text"
									value={args}
								/>
							</div>
							<div className="grid gap-2">
								<label
									className="font-medium text-sm leading-none"
									htmlFor="env-vars"
								>
									Environment Variables
								</label>
								<textarea
									className="flex min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
									id="env-vars"
									onChange={(e) => setEnvVars(e.target.value)}
									placeholder="KEY=value&#10;KEY2=value2"
									rows={3}
									value={envVars}
								/>
							</div>
							{error && <div className="text-destructive text-sm">{error}</div>}
						</div>
					</CardContent>
					<CardFooter className="flex-col gap-2">
						<div className="flex w-full gap-2">
							<Button
								className="flex-1"
								onClick={onCancel}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								className="flex-1"
								disabled={createMutation.isPending || !flakeUrl.trim()}
								type="submit"
							>
								Save
							</Button>
						</div>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
