import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { ProcessInputSchema, ProcessStatus } from "../../shared/types";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const processesRouter = router({
	list: publicProcedure.query(({ ctx }) => ctx.db.listProcessesWithState()),

	byId: publicProcedure
		.input(z.object({ id: z.number() }))
		.query(({ ctx, input }) => {
			const process = ctx.db.getProcessWithId(input.id);
			if (!process) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Process not found",
				});
			}
			return process;
		}),

	create: publicProcedure
		.input(ProcessInputSchema)
		.mutation(({ ctx, input }) => {
			const id = ctx.db.createProcess(
				input.flake_url,
				input.env_vars ?? null,
				input.args ?? null,
				input.name ?? null
			);
			return ctx.db.getProcessWithId(id);
		}),

	update: publicProcedure
		.input(
			z.object({
				id: z.number(),
				data: ProcessInputSchema,
			})
		)
		.mutation(({ ctx, input }) => {
			const existing = ctx.db.getProcessWithId(input.id);
			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Process not found",
				});
			}

			if (existing.state.status === ProcessStatus.RUNNING) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot update running process. Stop it first.",
				});
			}

			ctx.db.updateProcess(input.id, {
				flake_url: input.data.flake_url,
				env_vars: input.data.env_vars ?? null,
				args: input.data.args ?? null,
				name: input.data.name ?? null,
			});

			return ctx.db.getProcessWithId(input.id);
		}),

	delete: publicProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const process = ctx.db.getProcessWithId(input.id);
			if (!process) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Process not found",
				});
			}

			if (process.state.status === ProcessStatus.RUNNING && process.state.pid) {
				await ctx.nix.killFlake(process.state.pid);
			}

			ctx.db.deleteProcess(input.id);
			return { id: input.id };
		}),

	start: publicProcedure
		.input(z.object({ id: z.number() }))
		.mutation(({ ctx, input }) => {
			const process = ctx.db.getProcessWithId(input.id);
			if (!process) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Process not found",
				});
			}

			if (
				process.state.status === ProcessStatus.RUNNING &&
				process.state.pid &&
				ctx.nix.isFlakeRunning(process.state.pid)
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Process is already running",
				});
			}

			const pid = ctx.nix.runFlake(
				process.flake_url,
				process.env_vars,
				process.args
			);
			ctx.db.upsertProcessState(input.id, pid, ProcessStatus.RUNNING);

			return ctx.db.getProcessWithId(input.id);
		}),

	stop: publicProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const process = ctx.db.getProcessWithId(input.id);
			if (!process) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Process not found",
				});
			}

			if (process.state.status === ProcessStatus.STOPPED) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Process is already stopped",
				});
			}

			if (process.state.pid && ctx.nix.isFlakeRunning(process.state.pid)) {
				await ctx.nix.killFlake(process.state.pid);
			}

			ctx.db.upsertProcessState(input.id, null, ProcessStatus.STOPPED);

			return ctx.db.getProcessWithId(input.id);
		}),
});

export const appRouter = router({
	processes: processesRouter,
});

export type AppRouter = typeof appRouter;
