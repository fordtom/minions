import type { ColumnDef } from "@tanstack/react-table";
import {
	MoreHorizontal,
	PauseIcon,
	PencilIcon,
	PlayIcon,
	Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	type ApiResponse,
	ProcessStatus,
	type ProcessWithState,
} from "../../shared/types";
import { Button } from "../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

function RunningTimer({ startedAt }: { startedAt: number }) {
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		const updateElapsed = () => {
			setElapsed(Math.floor((Date.now() - startedAt) / MS_PER_SECOND));
		};

		updateElapsed();
		const interval = setInterval(updateElapsed, MS_PER_SECOND);
		return () => clearInterval(interval);
	}, [startedAt]);

	const hours = Math.floor(elapsed / SECONDS_PER_HOUR);
	const minutes = Math.floor((elapsed % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
	const seconds = elapsed % SECONDS_PER_MINUTE;

	if (hours > 0) {
		return <>{`${hours}h ${minutes}m ${seconds}s`}</>;
	}
	if (minutes > 0) {
		return <>{`${minutes}m ${seconds}s`}</>;
	}
	return <>{`${seconds}s`}</>;
}

export const createColumns = (
	refetch: () => void
): ColumnDef<ProcessWithState>[] => [
	{
		accessorKey: "name",
		header: "Name",
		cell: ({ row }) => row.original.name || row.original.flake_url,
	},
	{
		accessorKey: "state.status",
		header: () => <div className="text-right">Status</div>,
		cell: ({ row }) => {
			const status = row.original.state.status;
			const startedAt = row.original.state.started_at;
			return (
				<div className="text-right">
					{status === ProcessStatus.RUNNING && startedAt ? (
						<RunningTimer startedAt={startedAt} />
					) : (
						status
					)}
				</div>
			);
		},
	},
	{
		id: "actions",
		header: "",
		cell: ({ row }) => {
			const id = row.original.id;
			const isRunning = row.original.state.status === ProcessStatus.RUNNING;

			const handleStart = async () => {
				try {
					const res = await fetch(`/api/processes/${id}/start`, {
						method: "POST",
					});
					const result: ApiResponse<ProcessWithState> = await res.json();
					if (result.success) {
						refetch();
					}
				} catch {
					// Error handled silently
				}
			};

			const handleStop = async () => {
				try {
					const res = await fetch(`/api/processes/${id}/stop`, {
						method: "POST",
					});
					const result: ApiResponse<ProcessWithState> = await res.json();
					if (result.success) {
						refetch();
					}
				} catch {
					// Error handled silently
				}
			};

			const handleDelete = async () => {
				try {
					const res = await fetch(`/api/processes/${id}`, {
						method: "DELETE",
					});
					const result: ApiResponse<{ id: number }> = await res.json();
					if (result.success) {
						refetch();
					}
				} catch {
					// Error handled silently
				}
			};

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button className="h-8 w-8 p-0" variant="ghost">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{isRunning ? (
							<DropdownMenuItem onClick={handleStop}>
								<PauseIcon />
								Stop process
							</DropdownMenuItem>
						) : (
							<DropdownMenuItem onClick={handleStart}>
								<PlayIcon />
								Start process
							</DropdownMenuItem>
						)}
						<DropdownMenuItem>
							<PencilIcon />
							Edit process
						</DropdownMenuItem>
						<DropdownMenuItem onClick={handleDelete}>
							<Trash2Icon />
							Delete process
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];
