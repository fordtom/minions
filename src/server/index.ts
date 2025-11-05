import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { ProcessDatabase } from "./db";
import processRoutes from "./routes/processes";

const DEFAULT_PORT = 3000;

const app = new Hono();
const db = new ProcessDatabase();

app.route("/api/processes", processRoutes(db));

if (Bun.env.NODE_ENV === "production") {
	app.use("/*", serveStatic({ root: "./dist/client" }));
	app.get("*", serveStatic({ path: "./dist/client/index.html" }));
}

const port = Number(Bun.env.PORT ?? DEFAULT_PORT);

export default {
	port,
	fetch: app.fetch,
};
