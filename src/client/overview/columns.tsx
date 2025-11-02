import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ApiResponse, ProcessWithState } from "../../shared/types";
import { MoreHorizontal } from "lucide-react";
import { Button } from "../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
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
		header: "Args",
	},
	{
		accessorKey: "env_vars",
		header: "Env Vars",
	},
	{
		accessorKey: "state.status",
		header: "Status",
	},
	{
		id: "actions",
		cell: ({ row }) => {
			const id = row.original.id;

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

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>Actions</DropdownMenuLabel>
						<DropdownMenuItem>Edit process</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleStart}>
							Start process
						</DropdownMenuItem>
						<DropdownMenuItem onClick={handleStop}>
							Stop process
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
	},
];
