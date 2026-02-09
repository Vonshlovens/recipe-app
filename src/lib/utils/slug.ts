/**
 * Slug generation with collision avoidance for recipe URLs.
 * See: specs/recipe-data-model.md § On Save
 *
 * Generates URL-safe slugs from recipe titles.
 * Handles collisions by appending -2, -3, etc.
 */

import { MAX_SLUG_LENGTH } from "$lib/types";

/**
 * Generate a URL-safe slug from a title string.
 *
 * Transformation rules:
 * 1. Lowercase the entire string
 * 2. Replace non-alphanumeric characters with hyphens
 * 3. Collapse consecutive hyphens into one
 * 4. Trim leading/trailing hyphens
 * 5. Truncate to MAX_SLUG_LENGTH (100) characters, trimming trailing hyphens after truncation
 *
 * Returns an empty string if the title produces no valid slug characters.
 */
export function generateSlug(title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	if (slug.length <= MAX_SLUG_LENGTH) {
		return slug;
	}

	// Truncate and trim any trailing hyphens caused by the cut
	return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");
}

/**
 * Generate a unique slug, resolving collisions by appending a numeric suffix.
 *
 * The `existsFn` callback checks whether a slug is already taken.
 * If the base slug is taken, tries `slug-2`, `slug-3`, ... up to `slug-999`.
 *
 * The optional `excludeId` parameter allows excluding a specific recipe ID
 * from the collision check (useful when updating a recipe's own slug).
 *
 * @throws Error if no unique slug can be found after 999 attempts
 */
export async function generateUniqueSlug(
	title: string,
	existsFn: (slug: string, excludeId?: string) => Promise<boolean>,
	excludeId?: string,
): Promise<string> {
	const base = generateSlug(title);

	if (!base) {
		throw new Error("Cannot generate slug: title produces no valid slug characters");
	}

	if (!(await existsFn(base, excludeId))) {
		return base;
	}

	for (let i = 2; i <= 999; i++) {
		const suffix = `-${i}`;
		// Ensure the suffixed slug fits within MAX_SLUG_LENGTH
		const candidate = base.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/, "") + suffix;

		if (!(await existsFn(candidate, excludeId))) {
			return candidate;
		}
	}

	throw new Error(`Cannot generate unique slug for "${title}": all suffixes -2 through -999 are taken`);
}
