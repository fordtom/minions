import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { ProcessDatabase } from "./db";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";

const DEFAULT_PORT = 3000;

const app = new Hono();
const db = new ProcessDatabase();

app.use(
	"/api/trpc/*",
	trpcServer({
		endpoint: "/api/trpc",
		router: appRouter,
		createContext: createContext(db),
	})
);

if (Bun.env.NODE_ENV === "production") {
	app.use("/*", serveStatic({ root: "./dist/client" }));
	app.get("*", serveStatic({ path: "./dist/client/index.html" }));
}

const port = Number(Bun.env.PORT ?? DEFAULT_PORT);

export default {
	port,
	fetch: app.fetch,
};
