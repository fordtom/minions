import type { ColumnDef } from "@tanstack/react-table";
import {
	MoreHorizontal,
	PauseIcon,
	PencilIcon,
	PlayIcon,
	Trash2Icon,
} from "lucide-react";
import * as React from "react";
import {
	type ApiResponse,
	type ProcessWithState,
	ProcessStatus,
} from "../../shared/types";
import { Button } from "../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

export const createColumns = (
	refetch: () => void,
): ColumnDef<ProcessWithState>[] => [
	{
		accessorKey: "flake_url",
		header: "Flake URL",
	},
	{
		accessorKey: "args",
		header: () => <div className="text-left">Args</div>,
		cell: ({ getValue }) => (
			<div className="text-left">{getValue() as string}</div>
		),
	},
	{
		accessorKey: "env_vars",
		header: () => <div className="text-left">Env Vars</div>,
		cell: ({ getValue }) => (
			<div className="text-left">{getValue() as string}</div>
		),
	},
	{
		accessorKey: "state.status",
		header: () => <div className="text-right">Status</div>,
		cell: ({ getValue }) => (
			<div className="text-right">{getValue() as string}</div>
		),
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
					} else {
						console.error("Failed to start:", result.error);
					}
				} catch (err) {
					console.error("Failed to start process:", err);
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
					} else {
						console.error("Failed to stop:", result.error);
					}
				} catch (err) {
					console.error("Failed to stop process:", err);
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
					} else {
						console.error("Failed to delete:", result.error);
					}
				} catch (err) {
					console.error("Failed to delete process:", err);
				}
			};

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0">
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
