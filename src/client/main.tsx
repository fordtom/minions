import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SnowflakeIcon } from "lucide-react";
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
import { trpc, trpcClient } from "./lib/trpc";
import { createColumns } from "./overview/columns";
import { DataTable } from "./overview/data-table";

const queryClient = new QueryClient();

function App() {
	const [isNewOpen, setIsNewOpen] = useState(false);
	const {
		data = [],
		isLoading: loading,
		error,
	} = trpc.processes.list.useQuery();
	const utils = trpc.useUtils();

	const refetch = () => {
		utils.processes.list.invalidate();
	};

	const columns = createColumns();

	if (loading) {
		return <div className="p-4">Loading...</div>;
	}
	if (error) {
		return <div className="p-4 text-red-500">Error: {error.message}</div>;
	}

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
						refetch();
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
					refetch();
				}}
				open={isNewOpen}
			/>
		</div>
	);
}

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<QueryClientProvider client={queryClient}>
			<trpc.Provider client={trpcClient} queryClient={queryClient}>
				<App />
			</trpc.Provider>
		</QueryClientProvider>
	);
}
