import { describe, expect, it } from "vitest";
import { prepareForSave } from "$lib/utils/on-save.ts";
import type { Recipe } from "$lib/types";

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
	return {
		id: "01J5K9QR3ZFGV8T2X6WN4YHP1M",
		title: "Test Recipe",
		slug: "test-recipe",
		tags: { cuisine: ["italian"] },
		servings: { default: 4 },
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
		body: "## Ingredients\n\n- 1 cup flour\n\n## Instructions\n\n1. Mix.",
		...overrides,
	};
}

const FIXED_NOW = "2026-06-15T12:00:00Z";

describe("prepareForSave", () => {
	describe("updatedAt", () => {
		it("sets updatedAt to the provided time", () => {
			const recipe = makeRecipe();
			const result = prepareForSave({ recipe, now: FIXED_NOW });
			expect(result.updatedAt).toBe(FIXED_NOW);
		});

		it("sets updatedAt to current time when now is not provided", () => {
			const recipe = makeRecipe();
			const before = new Date().toISOString();
			const result = prepareForSave({ recipe });
			const after = new Date().toISOString();
			expect(result.updatedAt >= before).toBe(true);
			expect(result.updatedAt <= after).toBe(true);
		});

		it("does not modify createdAt", () => {
			const recipe = makeRecipe();
			const result = prepareForSave({ recipe, now: FIXED_NOW });
			expect(result.createdAt).toBe("2026-01-01T00:00:00Z");
		});
	});

	describe("totalTime calculation", () => {
		it("calculates totalTime from prepTime + cookTime", () => {
			const recipe = makeRecipe({
				prepTime: "PT15M",
				cookTime: "PT25M",
			});
			const result = prepareForSave({ recipe, now: FIXED_NOW });
			expect(result.totalTime).toBe("PT40M");
		});

		it("normalizes overflow when sum exceeds 60 minutes", () => {
			const recipe = makeRecipe({
				prepTime: "PT45M",
				cookTime: "PT30M",
			});
			const result = prepareForSave({ recipe, now: FIXED_NOW });
			expect(result.totalTime).toBe("PT1H15M");
		});

		it("adds hours correctly", () => {
			const recipe = makeRecipe({
				prepTime: "PT1H",
				cookTime: "PT2H30M",
			});
			const result = prepareForSave({ recipe, now: FIXED_NOW });
			expect(result.totalTime).toBe("PT3H30M");
		});

		it("does not calculate totalTime when prepTime is missing", () => {
			const recipe = makeRecipe({
				cookTime: "PT25M",
			});
			const result = prepareForSave({ recipe, now: FIXED_NOW });
			expect(result.totalTime).toBeUndefined();
		});

		it("does not calculate totalTime when cookTime is missing", () => {
			const recipe = makeRecipe({
				prepTime: "PT15M",
			});
			const result = prepareForSave({ recipe, now: FIXED_NOW });
			expect(result.totalTime).toBeUndefined();
		});

		it("does not calculate totalTime when neither is present", () => {
			const recipe = makeRecipe();
			const result = prepareForSave({ recipe, now: FIXED_NOW });
			expect(result.totalTime).toBeUndefined();
		});

		it("does not overwrite explicit totalTime", () => {
			const recipe = makeRecipe({
				prepTime: "PT15M",
				cookTime: "PT25M",
				totalTime: "PT1H",
			});
			const result = prepareForSave({
				recipe,
				totalTimeExplicit: true,
				now: FIXED_NOW,
			});
			expect(result.totalTime).toBe("PT1H");
		});

		it("calculates totalTime when totalTime exists but is not explicit", () => {
			const recipe = makeRecipe({
				prepTime: "PT15M",
				cookTime: "PT25M",
				totalTime: "PT1H",
			});
			const result = prepareForSave({
				recipe,
				totalTimeExplicit: false,
				now: FIXED_NOW,
			});
			expect(result.totalTime).toBe("PT40M");
		});
	});

	describe("immutability", () => {
		it("does not mutate the original recipe", () => {
			const recipe = makeRecipe({
				prepTime: "PT15M",
				cookTime: "PT25M",
			});
			const originalUpdatedAt = recipe.updatedAt;
			prepareForSave({ recipe, now: FIXED_NOW });
			expect(recipe.updatedAt).toBe(originalUpdatedAt);
			expect(recipe.totalTime).toBeUndefined();
		});
	});
});
