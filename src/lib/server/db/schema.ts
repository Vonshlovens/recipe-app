/**
 * Drizzle ORM schema for the recipe app.
 * Defines all tables, columns, constraints, and indexes.
 * See: specs/database.md and specs/tech-stack.md
 */

import { pgTable, pgEnum } from "drizzle-orm/pg-core";
import * as t from "drizzle-orm/pg-core";

// --- Enums ---

export const sourceTypeEnum = pgEnum("source_type", [
	"manual",
	"import",
	"ocr",
]);

export const difficultyEnum = pgEnum("difficulty", [
	"easy",
	"medium",
	"hard",
]);

// --- Tables ---

export const recipes = pgTable(
	"recipes",
	{
		id: t.text().primaryKey(), // ULID
		title: t.text().notNull(),
		slug: t.text().notNull().unique(),
		author: t.text(),
		sourceType: sourceTypeEnum("source_type"),
		sourceUrl: t.text("source_url"),
		sourceImportedAt: t.text("source_imported_at"), // ISO 8601 datetime
		servingsDefault: t.integer("servings_default").notNull(),
		servingsUnit: t.text("servings_unit"),
		prepTime: t.text("prep_time"), // ISO 8601 duration
		cookTime: t.text("cook_time"), // ISO 8601 duration
		totalTime: t.text("total_time"), // ISO 8601 duration
		difficulty: difficultyEnum("difficulty"),
		image: t.text(),
		createdAt: t.text("created_at").notNull(), // ISO 8601 datetime
		updatedAt: t.text("updated_at").notNull(), // ISO 8601 datetime
		document: t.text().notNull(), // Full Markdown+frontmatter source
	},
	(table) => [
		t.index("idx_recipes_created_at").on(table.createdAt),
		t.index("idx_recipes_updated_at").on(table.updatedAt),
		t.index("idx_recipes_difficulty").on(table.difficulty),
	],
);

export const recipeTags = pgTable(
	"recipe_tags",
	{
		recipeId: t
			.text("recipe_id")
			.notNull()
			.references(() => recipes.id, { onDelete: "cascade" }),
		tagGroup: t.text("tag_group").notNull(),
		tagValue: t.text("tag_value").notNull(),
	},
	(table) => [
		t.primaryKey({ columns: [table.recipeId, table.tagGroup, table.tagValue] }),
		t.index("idx_recipe_tags_group_value").on(table.tagGroup, table.tagValue),
		t.index("idx_recipe_tags_value").on(table.tagValue),
	],
);
