/**
 * Database client singleton.
 * Uses Neon's serverless HTTP driver with Drizzle ORM.
 * See: specs/tech-stack.md
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL environment variable is not set. " +
			"See .env.example for the required format.",
	);
}

const sql = neon(databaseUrl);

export const db = drizzle({ client: sql, schema });
