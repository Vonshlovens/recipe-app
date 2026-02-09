import { describe, expect, it } from "vitest";
import { validateFrontmatter } from "$lib/utils/validation.ts";
import type { RecipeFrontmatter } from "$lib/types";

/** Minimal valid frontmatter for testing. Override individual fields as needed. */
function validFrontmatter(overrides: Partial<RecipeFrontmatter> = {}): RecipeFrontmatter {
	return {
		id: "01KH0AWE08BJ36XYKJETJA5MVH",
		title: "Test Recipe",
		slug: "test-recipe",
		tags: {},
		servings: { default: 4 },
		createdAt: "2026-01-15T10:30:00Z",
		updatedAt: "2026-01-15T10:30:00Z",
		...overrides,
	};
}

describe("validateFrontmatter", () => {
	describe("valid recipes", () => {
		it("accepts a minimal valid frontmatter", () => {
			const result = validateFrontmatter(validFrontmatter());
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("accepts a fully populated frontmatter", () => {
			const result = validateFrontmatter(validFrontmatter({
				author: "Jane Doe",
				source: { type: "import", url: "https://example.com", importedAt: "2026-01-15T10:30:00Z" },
				tags: {
					cuisine: ["mediterranean"],
					meal: ["lunch", "dinner"],
					diet: ["vegan", "gluten-free"],
					technique: ["roasting"],
					custom: ["meal-prep", "quick"],
				},
				servings: { default: 4, unit: "bowls" },
				prepTime: "PT15M",
				cookTime: "PT25M",
				totalTime: "PT40M",
				difficulty: "easy",
				image: "/images/recipe.jpg",
			}));
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe("id validation", () => {
		it("rejects an empty id", () => {
			const result = validateFrontmatter(validFrontmatter({ id: "" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "id" }),
			);
		});

		it("rejects a lowercase ULID", () => {
			const result = validateFrontmatter(validFrontmatter({ id: "01j5kexample000000000abcde" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "id" }),
			);
		});

		it("rejects a wrong-length id", () => {
			const result = validateFrontmatter(validFrontmatter({ id: "TOOSHORT" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "id" }),
			);
		});

		it("rejects a ULID with invalid characters (I, L, O, U)", () => {
			const result = validateFrontmatter(validFrontmatter({ id: "01J5KEXAMPLEI00000000ABCDE" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "id" }),
			);
		});
	});

	describe("title validation", () => {
		it("rejects an empty title", () => {
			const result = validateFrontmatter(validFrontmatter({ title: "" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "title" }),
			);
		});

		it("accepts a single-character title", () => {
			const result = validateFrontmatter(validFrontmatter({ title: "X" }));
			expect(result.valid).toBe(true);
		});

		it("accepts a 200-character title", () => {
			const result = validateFrontmatter(validFrontmatter({ title: "A".repeat(200) }));
			expect(result.valid).toBe(true);
		});

		it("rejects a 201-character title", () => {
			const result = validateFrontmatter(validFrontmatter({ title: "A".repeat(201) }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "title" }),
			);
		});
	});

	describe("slug validation", () => {
		it("rejects an empty slug", () => {
			const result = validateFrontmatter(validFrontmatter({ slug: "" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "slug" }),
			);
		});

		it("rejects uppercase characters in slug", () => {
			const result = validateFrontmatter(validFrontmatter({ slug: "My-Recipe" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "slug" }),
			);
		});

		it("rejects spaces in slug", () => {
			const result = validateFrontmatter(validFrontmatter({ slug: "my recipe" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "slug" }),
			);
		});

		it("rejects underscores in slug", () => {
			const result = validateFrontmatter(validFrontmatter({ slug: "my_recipe" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "slug" }),
			);
		});

		it("accepts a 100-character slug", () => {
			const result = validateFrontmatter(validFrontmatter({ slug: "a".repeat(100) }));
			expect(result.valid).toBe(true);
		});

		it("rejects a 101-character slug", () => {
			const result = validateFrontmatter(validFrontmatter({ slug: "a".repeat(101) }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "slug" }),
			);
		});
	});

	describe("servings validation", () => {
		it("rejects zero servings", () => {
			const result = validateFrontmatter(validFrontmatter({ servings: { default: 0 } }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "servings.default" }),
			);
		});

		it("rejects negative servings", () => {
			const result = validateFrontmatter(validFrontmatter({ servings: { default: -1 } }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "servings.default" }),
			);
		});

		it("rejects non-integer servings", () => {
			const result = validateFrontmatter(validFrontmatter({ servings: { default: 2.5 } }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "servings.default" }),
			);
		});

		it("accepts 1 serving", () => {
			const result = validateFrontmatter(validFrontmatter({ servings: { default: 1 } }));
			expect(result.valid).toBe(true);
		});
	});

	describe("datetime validation", () => {
		it("rejects invalid createdAt", () => {
			const result = validateFrontmatter(validFrontmatter({ createdAt: "not-a-date" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "createdAt" }),
			);
		});

		it("rejects invalid updatedAt", () => {
			const result = validateFrontmatter(validFrontmatter({ updatedAt: "2026-13-01T00:00:00Z" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "updatedAt" }),
			);
		});

		it("accepts UTC datetimes", () => {
			const result = validateFrontmatter(validFrontmatter({
				createdAt: "2026-01-15T10:30:00Z",
				updatedAt: "2026-06-15T23:59:59Z",
			}));
			expect(result.valid).toBe(true);
		});

		it("accepts datetimes with timezone offset", () => {
			const result = validateFrontmatter(validFrontmatter({
				createdAt: "2026-01-15T10:30:00+05:30",
				updatedAt: "2026-01-15T10:30:00-08:00",
			}));
			expect(result.valid).toBe(true);
		});

		it("accepts datetimes with fractional seconds", () => {
			const result = validateFrontmatter(validFrontmatter({
				createdAt: "2026-01-15T10:30:00.123Z",
			}));
			expect(result.valid).toBe(true);
		});

		it("rejects a date-only string (no time)", () => {
			const result = validateFrontmatter(validFrontmatter({ createdAt: "2026-01-15" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "createdAt" }),
			);
		});

		it("rejects a datetime without timezone", () => {
			const result = validateFrontmatter(validFrontmatter({ createdAt: "2026-01-15T10:30:00" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "createdAt" }),
			);
		});
	});

	describe("duration validation", () => {
		it("accepts PT15M", () => {
			const result = validateFrontmatter(validFrontmatter({ prepTime: "PT15M" }));
			expect(result.valid).toBe(true);
		});

		it("accepts PT1H30M", () => {
			const result = validateFrontmatter(validFrontmatter({ prepTime: "PT1H30M" }));
			expect(result.valid).toBe(true);
		});

		it("accepts P1DT2H", () => {
			const result = validateFrontmatter(validFrontmatter({ prepTime: "P1DT2H" }));
			expect(result.valid).toBe(true);
		});

		it("accepts PT0S", () => {
			const result = validateFrontmatter(validFrontmatter({ prepTime: "PT0S" }));
			expect(result.valid).toBe(true);
		});

		it("accepts PT1H", () => {
			const result = validateFrontmatter(validFrontmatter({ cookTime: "PT1H" }));
			expect(result.valid).toBe(true);
		});

		it("accepts P2W", () => {
			const result = validateFrontmatter(validFrontmatter({ totalTime: "P2W" }));
			expect(result.valid).toBe(true);
		});

		it("accepts fractional seconds PT30.5S", () => {
			const result = validateFrontmatter(validFrontmatter({ prepTime: "PT30.5S" }));
			expect(result.valid).toBe(true);
		});

		it("rejects bare P with no components", () => {
			const result = validateFrontmatter(validFrontmatter({ prepTime: "P" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "prepTime" }),
			);
		});

		it("rejects PT with no time components", () => {
			const result = validateFrontmatter(validFrontmatter({ prepTime: "PT" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "prepTime" }),
			);
		});

		it("rejects plain string as duration", () => {
			const result = validateFrontmatter(validFrontmatter({ cookTime: "25 minutes" }));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "cookTime" }),
			);
		});

		it("does not validate duration when field is absent", () => {
			const result = validateFrontmatter(validFrontmatter());
			// No prepTime, cookTime, totalTime set — should be valid
			expect(result.valid).toBe(true);
		});
	});

	describe("difficulty validation", () => {
		it("accepts easy", () => {
			const result = validateFrontmatter(validFrontmatter({ difficulty: "easy" }));
			expect(result.valid).toBe(true);
		});

		it("accepts medium", () => {
			const result = validateFrontmatter(validFrontmatter({ difficulty: "medium" }));
			expect(result.valid).toBe(true);
		});

		it("accepts hard", () => {
			const result = validateFrontmatter(validFrontmatter({ difficulty: "hard" }));
			expect(result.valid).toBe(true);
		});

		it("rejects invalid difficulty", () => {
			const result = validateFrontmatter(validFrontmatter({
				difficulty: "extreme" as RecipeFrontmatter["difficulty"],
			}));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "difficulty" }),
			);
		});

		it("does not validate difficulty when absent", () => {
			const result = validateFrontmatter(validFrontmatter());
			expect(result.valid).toBe(true);
		});
	});

	describe("source validation", () => {
		it("accepts source with type manual", () => {
			const result = validateFrontmatter(validFrontmatter({
				source: { type: "manual" },
			}));
			expect(result.valid).toBe(true);
		});

		it("accepts source with type import", () => {
			const result = validateFrontmatter(validFrontmatter({
				source: { type: "import", url: "https://example.com", importedAt: "2026-01-15T10:30:00Z" },
			}));
			expect(result.valid).toBe(true);
		});

		it("accepts source with type ocr", () => {
			const result = validateFrontmatter(validFrontmatter({
				source: { type: "ocr" },
			}));
			expect(result.valid).toBe(true);
		});

		it("rejects invalid source type", () => {
			const result = validateFrontmatter(validFrontmatter({
				source: { type: "scraped" as RecipeFrontmatter["source"] extends { type: infer T } ? T : never },
			}));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "source.type" }),
			);
		});

		it("does not validate source when absent", () => {
			const result = validateFrontmatter(validFrontmatter());
			expect(result.valid).toBe(true);
		});
	});

	describe("tag validation", () => {
		it("accepts empty tags object", () => {
			const result = validateFrontmatter(validFrontmatter({ tags: {} }));
			expect(result.valid).toBe(true);
		});

		it("accepts valid tags", () => {
			const result = validateFrontmatter(validFrontmatter({
				tags: { cuisine: ["mediterranean", "italian"], meal: ["dinner"] },
			}));
			expect(result.valid).toBe(true);
		});

		it("rejects uppercase tag values", () => {
			const result = validateFrontmatter(validFrontmatter({
				tags: { cuisine: ["Mediterranean"] },
			}));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "tags.cuisine[0]" }),
			);
		});

		it("rejects tag values with spaces", () => {
			const result = validateFrontmatter(validFrontmatter({
				tags: { custom: ["meal prep"] },
			}));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "tags.custom[0]" }),
			);
		});

		it("rejects empty string tag value", () => {
			const result = validateFrontmatter(validFrontmatter({
				tags: { cuisine: [""] },
			}));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "tags.cuisine[0]" }),
			);
		});

		it("rejects tag values over 50 characters", () => {
			const result = validateFrontmatter(validFrontmatter({
				tags: { custom: ["a".repeat(51)] },
			}));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "tags.custom[0]" }),
			);
		});

		it("accepts 50-character tag value", () => {
			const result = validateFrontmatter(validFrontmatter({
				tags: { custom: ["a".repeat(50)] },
			}));
			expect(result.valid).toBe(true);
		});

		it("accepts 20 tags per group", () => {
			const tags = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
			const result = validateFrontmatter(validFrontmatter({
				tags: { custom: tags },
			}));
			expect(result.valid).toBe(true);
		});

		it("rejects 21 tags per group", () => {
			const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
			const result = validateFrontmatter(validFrontmatter({
				tags: { custom: tags },
			}));
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "tags.custom" }),
			);
		});

		it("rejects tag values with underscores", () => {
			const result = validateFrontmatter(validFrontmatter({
				tags: { cuisine: ["south_american"] },
			}));
			expect(result.valid).toBe(false);
		});

		it("accepts tag values with hyphens and numbers", () => {
			const result = validateFrontmatter(validFrontmatter({
				tags: { custom: ["30-minute", "5-ingredient"] },
			}));
			expect(result.valid).toBe(true);
		});
	});

	describe("multiple errors", () => {
		it("collects all errors from multiple invalid fields", () => {
			const result = validateFrontmatter(validFrontmatter({
				id: "",
				title: "",
				slug: "INVALID SLUG!",
				servings: { default: -1 },
				createdAt: "not-a-date",
				updatedAt: "also-not-a-date",
				difficulty: "extreme" as RecipeFrontmatter["difficulty"],
			}));
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThanOrEqual(7);

			const fields = result.errors.map((e) => e.field);
			expect(fields).toContain("id");
			expect(fields).toContain("title");
			expect(fields).toContain("slug");
			expect(fields).toContain("servings.default");
			expect(fields).toContain("createdAt");
			expect(fields).toContain("updatedAt");
			expect(fields).toContain("difficulty");
		});
	});
});
