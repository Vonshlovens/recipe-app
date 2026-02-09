/**
 * Recipe data model types.
 * Canonical schema for recipe documents (YAML frontmatter + Markdown body).
 * See: specs/recipe-data-model.md
 */

// --- Enums / Unions ---

export type SourceType = "manual" | "import" | "ocr";
export type Difficulty = "easy" | "medium" | "hard";

/** Built-in tag group names. */
export type BuiltInTagGroup = "cuisine" | "meal" | "diet" | "technique" | "custom";

/** Tag group name — built-in groups plus any unknown groups (treated as custom). */
export type TagGroup = BuiltInTagGroup | (string & {});

// --- Component Types ---

export interface RecipeSource {
	type: SourceType;
	url?: string;
	importedAt?: string;
}

export interface Servings {
	default: number;
	unit?: string;
}

/**
 * Tag taxonomy: named groups → arrays of lowercase hyphenated strings.
 * Each group holds 0–20 tags. Tag values match /^[a-z0-9-]{1,50}$/.
 */
export type RecipeTags = {
	[K in BuiltInTagGroup]?: string[];
} & {
	[group: string]: string[] | undefined;
};

// --- Recipe Types ---

/** Fields set on creation and never changed. */
export interface RecipeIdentity {
	id: string;
	createdAt: string;
}

/** All frontmatter fields for a recipe. */
export interface RecipeFrontmatter extends RecipeIdentity {
	title: string;
	slug: string;
	author?: string;
	source?: RecipeSource;
	tags: RecipeTags;
	servings: Servings;
	prepTime?: string;
	cookTime?: string;
	totalTime?: string;
	difficulty?: Difficulty;
	image?: string;
	updatedAt: string;
}

/** A full recipe: frontmatter + Markdown body. */
export interface Recipe extends RecipeFrontmatter {
	body: string;
}

/** Input for creating a new recipe (id, slug, createdAt, updatedAt auto-generated). */
export interface RecipeCreateInput {
	title: string;
	author?: string;
	source?: RecipeSource;
	tags: RecipeTags;
	servings: Servings;
	prepTime?: string;
	cookTime?: string;
	totalTime?: string;
	difficulty?: Difficulty;
	image?: string;
	body: string;
}

/** Input for a full recipe update (PUT). Preserves id and createdAt. */
export interface RecipeUpdateInput {
	title: string;
	author?: string;
	source?: RecipeSource;
	tags: RecipeTags;
	servings: Servings;
	prepTime?: string;
	cookTime?: string;
	totalTime?: string;
	difficulty?: Difficulty;
	image?: string;
	body: string;
}

/** Input for a partial recipe update (PATCH). All fields optional. */
export interface RecipePatchInput {
	title?: string;
	author?: string;
	source?: RecipeSource;
	tags?: RecipeTags;
	servings?: Servings;
	prepTime?: string;
	cookTime?: string;
	totalTime?: string;
	difficulty?: Difficulty;
	image?: string;
	body?: string;
}

/** Recipe summary for list endpoints (no body). */
export type RecipeSummary = RecipeFrontmatter;

// --- Constants ---

export const BUILT_IN_TAG_GROUPS: readonly BuiltInTagGroup[] = [
	"cuisine",
	"meal",
	"diet",
	"technique",
	"custom",
] as const;

export const DIFFICULTIES: readonly Difficulty[] = [
	"easy",
	"medium",
	"hard",
] as const;

export const SOURCE_TYPES: readonly SourceType[] = [
	"manual",
	"import",
	"ocr",
] as const;

export const TAG_VALUE_REGEX = /^[a-z0-9-]{1,50}$/;
export const MAX_TAGS_PER_GROUP = 20;
export const MAX_TITLE_LENGTH = 200;
export const MAX_SLUG_LENGTH = 100;
export const MAX_BODY_LENGTH = 50_000;
