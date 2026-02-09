/**
 * On-save logic for recipe documents.
 * Per spec (recipe-data-model.md § On Save):
 * - updatedAt is set to the current time.
 * - totalTime is recalculated from prepTime + cookTime if both present
 *   and totalTime is not explicitly set.
 */

import type { Recipe } from "$lib/types";
import { addDurations, parseDuration, serializeDuration } from "./duration.ts";

export interface PrepareForSaveOptions {
	/** The recipe to prepare for saving. */
	recipe: Recipe;
	/** If true, totalTime was explicitly provided and should not be overwritten. */
	totalTimeExplicit?: boolean;
	/** Override the current time (for testing). Defaults to `new Date().toISOString()`. */
	now?: string;
}

/**
 * Apply on-save transformations to a recipe.
 * Returns a new Recipe with updatedAt set and totalTime calculated if appropriate.
 */
export function prepareForSave(options: PrepareForSaveOptions): Recipe {
	const { recipe, totalTimeExplicit = false, now } = options;
	const updatedAt = now ?? new Date().toISOString();

	const result: Recipe = { ...recipe, updatedAt };

	// Calculate totalTime from prepTime + cookTime if:
	// 1. totalTime was NOT explicitly set by the user
	// 2. Both prepTime and cookTime are present
	if (!totalTimeExplicit && recipe.prepTime && recipe.cookTime) {
		const prep = parseDuration(recipe.prepTime);
		const cook = parseDuration(recipe.cookTime);

		if (prep && cook) {
			result.totalTime = serializeDuration(addDurations(prep, cook));
		}
	}

	return result;
}
