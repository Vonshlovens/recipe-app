/**
 * YAML frontmatter parser and splitter for recipe documents.
 * Parses Markdown files with YAML frontmatter into structured Recipe objects.
 * See: specs/recipe-data-model.md
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { Recipe, RecipeFrontmatter, RecipeTags } from "$lib/types";

/** Result of splitting a document into frontmatter and body. */
export interface RawFrontmatterDocument {
	/** Parsed YAML frontmatter as a plain object. */
	frontmatter: Record<string, unknown>;
	/** Markdown body (everything after the closing `---`). */
	body: string;
}

export class FrontmatterParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FrontmatterParseError";
	}
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Split a Markdown document into raw frontmatter object and body string.
 * Throws FrontmatterParseError if the document doesn't have valid frontmatter delimiters.
 */
export function splitFrontmatter(document: string): RawFrontmatterDocument {
	const match = document.match(FRONTMATTER_REGEX);
	if (!match) {
		throw new FrontmatterParseError(
			"Document does not contain valid YAML frontmatter (expected opening and closing --- delimiters)",
		);
	}

	const [, yamlContent, body] = match;

	let frontmatter: unknown;
	try {
		frontmatter = parseYaml(yamlContent);
	} catch (err) {
		throw new FrontmatterParseError(
			`Invalid YAML in frontmatter: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	if (frontmatter === null || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
		throw new FrontmatterParseError(
			"Frontmatter must be a YAML mapping (key-value pairs), not a scalar or sequence",
		);
	}

	return {
		frontmatter: frontmatter as Record<string, unknown>,
		body: body.trim(),
	};
}

/**
 * Extract RecipeFrontmatter fields from a raw frontmatter object.
 * Coerces types where reasonable (e.g., numbers to strings for dates)
 * but does NOT validate values — that's the job of the validation layer (RDM-005).
 */
function extractFrontmatter(raw: Record<string, unknown>): RecipeFrontmatter {
	const tags = extractTags(raw.tags);

	const fm: RecipeFrontmatter = {
		id: String(raw.id ?? ""),
		title: String(raw.title ?? ""),
		slug: String(raw.slug ?? ""),
		tags,
		servings: extractServings(raw.servings),
		createdAt: String(raw.createdAt ?? ""),
		updatedAt: String(raw.updatedAt ?? ""),
	};

	if (raw.author != null) fm.author = String(raw.author);
	if (raw.source != null) fm.source = extractSource(raw.source);
	if (raw.prepTime != null) fm.prepTime = String(raw.prepTime);
	if (raw.cookTime != null) fm.cookTime = String(raw.cookTime);
	if (raw.totalTime != null) fm.totalTime = String(raw.totalTime);
	if (raw.difficulty != null) fm.difficulty = String(raw.difficulty) as RecipeFrontmatter["difficulty"];
	if (raw.image != null) fm.image = String(raw.image);

	return fm;
}

function extractTags(raw: unknown): RecipeTags {
	if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
		return {};
	}

	const tags: RecipeTags = {};
	for (const [group, values] of Object.entries(raw as Record<string, unknown>)) {
		if (Array.isArray(values)) {
			tags[group] = values.map(String);
		}
	}
	return tags;
}

function extractServings(raw: unknown): { default: number; unit?: string } {
	if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
		return { default: 0 };
	}

	const obj = raw as Record<string, unknown>;
	const result: { default: number; unit?: string } = {
		default: Number(obj.default ?? 0),
	};

	if (obj.unit != null) {
		result.unit = String(obj.unit);
	}

	return result;
}

function extractSource(raw: unknown): { type: "manual" | "import" | "ocr"; url?: string; importedAt?: string } | undefined {
	if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
		return undefined;
	}

	const obj = raw as Record<string, unknown>;
	const source: { type: "manual" | "import" | "ocr"; url?: string; importedAt?: string } = {
		type: String(obj.type ?? "manual") as "manual" | "import" | "ocr",
	};

	if (obj.url != null) source.url = String(obj.url);
	if (obj.importedAt != null) source.importedAt = String(obj.importedAt);

	return source;
}

/**
 * Parse a Markdown document with YAML frontmatter into a Recipe object.
 * Handles the frontmatter/body split and type extraction.
 * Does NOT validate field values — use the validation layer for that.
 *
 * @throws FrontmatterParseError if the document format is invalid
 */
export function parseRecipeDocument(document: string): Recipe {
	const { frontmatter, body } = splitFrontmatter(document);
	const fm = extractFrontmatter(frontmatter);

	return { ...fm, body };
}

/**
 * Build a plain object from RecipeFrontmatter suitable for YAML serialization.
 * Omits undefined optional fields so the output stays clean.
 */
function buildFrontmatterObject(fm: RecipeFrontmatter): Record<string, unknown> {
	const obj: Record<string, unknown> = {
		id: fm.id,
		title: fm.title,
		slug: fm.slug,
	};

	if (fm.author != null) obj.author = fm.author;

	if (fm.source != null) {
		const source: Record<string, unknown> = { type: fm.source.type };
		if (fm.source.url != null) source.url = fm.source.url;
		if (fm.source.importedAt != null) source.importedAt = fm.source.importedAt;
		obj.source = source;
	}

	// Only emit tags if there are non-empty groups
	const tags: Record<string, string[]> = {};
	for (const [group, values] of Object.entries(fm.tags)) {
		if (values && values.length > 0) {
			tags[group] = values;
		}
	}
	obj.tags = Object.keys(tags).length > 0 ? tags : {};

	obj.servings = fm.servings.unit != null
		? { default: fm.servings.default, unit: fm.servings.unit }
		: { default: fm.servings.default };

	if (fm.prepTime != null) obj.prepTime = fm.prepTime;
	if (fm.cookTime != null) obj.cookTime = fm.cookTime;
	if (fm.totalTime != null) obj.totalTime = fm.totalTime;
	if (fm.difficulty != null) obj.difficulty = fm.difficulty;
	if (fm.image != null) obj.image = fm.image;

	obj.createdAt = fm.createdAt;
	obj.updatedAt = fm.updatedAt;

	return obj;
}

/**
 * Serialize a Recipe object into a Markdown document with YAML frontmatter.
 * This is the inverse of parseRecipeDocument.
 *
 * The output follows the canonical format:
 * ```
 * ---
 * <YAML frontmatter>
 * ---
 *
 * <Markdown body>
 * ```
 */
export function serializeRecipeDocument(recipe: Recipe): string {
	const { body, ...fm } = recipe;
	const obj = buildFrontmatterObject(fm);
	const yaml = stringifyYaml(obj, { lineWidth: 0 });

	const parts = ["---\n", yaml, "---\n"];
	if (body) {
		parts.push("\n", body, "\n");
	}
	return parts.join("");
}
