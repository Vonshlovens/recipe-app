/**
 * Frontmatter validation for recipe documents.
 * Validates all frontmatter fields per spec: specs/recipe-data-model.md § Validation Rules.
 *
 * The parser (frontmatter.ts) handles type extraction/coercion; this module
 * validates the extracted values against the schema constraints.
 */

import type { RecipeFrontmatter, RecipeSource, RecipeTags, Servings } from "$lib/types";
import {
	DIFFICULTIES,
	MAX_SLUG_LENGTH,
	MAX_TAGS_PER_GROUP,
	MAX_TITLE_LENGTH,
	SOURCE_TYPES,
	TAG_VALUE_REGEX,
} from "$lib/types";
import { isValidUlid } from "./ulid.ts";

/** A single validation error with a field path and message. */
export interface ValidationError {
	field: string;
	message: string;
}

/** Result of validating recipe frontmatter. */
export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

const SLUG_REGEX = /^[a-z0-9-]{1,100}$/;

/**
 * ISO 8601 duration pattern.
 * Matches durations like PT15M, PT1H30M, P1DT2H, PT0S, etc.
 * Requires at least one component after P (and T for time components).
 */
const ISO_DURATION_REGEX = /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?!$)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/;

/**
 * ISO 8601 datetime validation.
 * Checks both format and that the date is actually valid (e.g., rejects Feb 30).
 */
function isValidIso8601Datetime(value: string): boolean {
	// Must match basic ISO 8601 datetime format
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
		return false;
	}
	const d = new Date(value);
	return !isNaN(d.getTime());
}

/** Validate that a string is a valid ISO 8601 duration. */
function isValidIsoDuration(value: string): boolean {
	return ISO_DURATION_REGEX.test(value);
}

/**
 * Validate all frontmatter fields of a recipe.
 * Returns a ValidationResult with `valid: true` if all checks pass,
 * or `valid: false` with an array of errors describing each failure.
 */
export function validateFrontmatter(fm: RecipeFrontmatter): ValidationResult {
	const errors: ValidationError[] = [];

	// id — must be a valid ULID
	if (!isValidUlid(fm.id)) {
		errors.push({ field: "id", message: "Must be a valid ULID (26 Crockford Base32 characters)" });
	}

	// title — non-empty, 1–200 characters
	if (!fm.title || fm.title.length === 0) {
		errors.push({ field: "title", message: "Must be a non-empty string" });
	} else if (fm.title.length > MAX_TITLE_LENGTH) {
		errors.push({ field: "title", message: `Must be at most ${MAX_TITLE_LENGTH} characters (got ${fm.title.length})` });
	}

	// slug — lowercase alphanumeric + hyphens, 1–100 characters
	if (!SLUG_REGEX.test(fm.slug)) {
		errors.push({
			field: "slug",
			message: `Must be 1–${MAX_SLUG_LENGTH} lowercase alphanumeric characters or hyphens`,
		});
	}

	// servings.default — positive integer
	validateServings(fm.servings, errors);

	// createdAt — valid ISO 8601 datetime
	if (!isValidIso8601Datetime(fm.createdAt)) {
		errors.push({ field: "createdAt", message: "Must be a valid ISO 8601 datetime" });
	}

	// updatedAt — valid ISO 8601 datetime
	if (!isValidIso8601Datetime(fm.updatedAt)) {
		errors.push({ field: "updatedAt", message: "Must be a valid ISO 8601 datetime" });
	}

	// prepTime — valid ISO 8601 duration if present
	if (fm.prepTime != null && !isValidIsoDuration(fm.prepTime)) {
		errors.push({ field: "prepTime", message: "Must be a valid ISO 8601 duration (e.g., PT15M)" });
	}

	// cookTime — valid ISO 8601 duration if present
	if (fm.cookTime != null && !isValidIsoDuration(fm.cookTime)) {
		errors.push({ field: "cookTime", message: "Must be a valid ISO 8601 duration (e.g., PT25M)" });
	}

	// totalTime — valid ISO 8601 duration if present
	if (fm.totalTime != null && !isValidIsoDuration(fm.totalTime)) {
		errors.push({ field: "totalTime", message: "Must be a valid ISO 8601 duration (e.g., PT40M)" });
	}

	// difficulty — one of "easy", "medium", "hard" if present
	if (fm.difficulty != null && !(DIFFICULTIES as readonly string[]).includes(fm.difficulty)) {
		errors.push({
			field: "difficulty",
			message: `Must be one of: ${DIFFICULTIES.join(", ")}`,
		});
	}

	// source — validate nested fields if present
	if (fm.source != null) {
		validateSource(fm.source, errors);
	}

	// tags — validate all groups
	validateTags(fm.tags, errors);

	return { valid: errors.length === 0, errors };
}

function validateServings(servings: Servings, errors: ValidationError[]): void {
	if (!Number.isInteger(servings.default) || servings.default < 1) {
		errors.push({ field: "servings.default", message: "Must be a positive integer" });
	}
}

function validateSource(source: RecipeSource, errors: ValidationError[]): void {
	if (!(SOURCE_TYPES as readonly string[]).includes(source.type)) {
		errors.push({
			field: "source.type",
			message: `Must be one of: ${SOURCE_TYPES.join(", ")}`,
		});
	}
}

function validateTags(tags: RecipeTags, errors: ValidationError[]): void {
	for (const [group, values] of Object.entries(tags)) {
		if (!values) continue;

		if (values.length > MAX_TAGS_PER_GROUP) {
			errors.push({
				field: `tags.${group}`,
				message: `Must have at most ${MAX_TAGS_PER_GROUP} tags (got ${values.length})`,
			});
		}

		for (let i = 0; i < values.length; i++) {
			if (!TAG_VALUE_REGEX.test(values[i])) {
				errors.push({
					field: `tags.${group}[${i}]`,
					message: `Tag value "${values[i]}" must match ${TAG_VALUE_REGEX}`,
				});
			}
		}
	}
}
