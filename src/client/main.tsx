import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SnowflakeIcon } from "lucide-react";
import type { ApiResponse, ProcessWithState } from "../shared/types";
import { NewFlakeCard } from "./add-new";
import { Button } from "./components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "./components/ui/empty";
import { createColumns } from "./overview/columns";
import { DataTable } from "./overview/data-table";

function App() {
	const [data, setData] = useState<ProcessWithState[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isNewOpen, setIsNewOpen] = useState(false);

	const fetchData = useCallback(() => {
		setLoading(true);
		setError(null);
		fetch("/api/processes")
			.then((res) => res.json())
			.then((result: ApiResponse<ProcessWithState[]>) => {
				if (result.success && result.data) {
					setData(result.data);
				} else {
					setError(result.error || "Failed to fetch processes");
				}
			})
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const columns = createColumns(fetchData);

	if (loading) return <div className="p-4">Loading...</div>;
	if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

	if (data.length === 0) {
		return (
			<div className="container mx-auto py-10">
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<SnowflakeIcon />
						</EmptyMedia>
						<EmptyTitle>No flakes yet</EmptyTitle>
						<EmptyDescription>Get started by adding a flake.</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button onClick={() => setIsNewOpen(true)}>Add flake</Button>
					</EmptyContent>
				</Empty>
				<NewFlakeCard
					onCancel={() => setIsNewOpen(false)}
					onSaved={() => {
						setIsNewOpen(false);
						fetchData();
					}}
					open={isNewOpen}
				/>
			</div>
		);
	}

	return (
		<div className="container mx-auto py-10">
			<div className="mb-4 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Minions</h1>
				<Button onClick={() => setIsNewOpen(true)}>Add flake</Button>
			</div>
			<DataTable columns={columns} data={data} />
			<NewFlakeCard
				onCancel={() => setIsNewOpen(false)}
				onSaved={() => {
					setIsNewOpen(false);
					fetchData();
				}}
				open={isNewOpen}
			/>
		</div>
	);
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
