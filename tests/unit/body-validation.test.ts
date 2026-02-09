import { describe, expect, it } from "vitest";
import { validateBody } from "$lib/utils/validation.ts";

/** Minimal valid body with both required sections. */
const VALID_BODY = `## Ingredients

- 2 tbsp olive oil
- 1 avocado, sliced

## Instructions

1. Heat the olive oil in a pan.
2. Add the avocado slices.
`;

describe("validateBody", () => {
	describe("valid bodies", () => {
		it("accepts a minimal valid body", () => {
			const result = validateBody(VALID_BODY);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("accepts a body with optional sections", () => {
			const body = `## Ingredients

- 1 cup flour
- 2 eggs

## Instructions

1. Mix the flour and eggs.

## Notes

This is a great recipe for beginners.

## Variations

- Add chocolate chips for a sweet version.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("accepts unordered list items with different markers", () => {
			const body = `## Ingredients

* 1 cup flour
+ 2 eggs

## Instructions

- Mix everything together.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(true);
		});

		it("accepts a body with text before the first section", () => {
			const body = `Some introductory text.

## Ingredients

- 1 cup rice

## Instructions

1. Cook the rice.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(true);
		});

		it("accepts a body at exactly MAX_BODY_LENGTH", () => {
			const padding = "x".repeat(50_000 - VALID_BODY.length);
			const body = VALID_BODY + padding;
			expect(body.length).toBe(50_000);
			const result = validateBody(body);
			expect(result.valid).toBe(true);
		});
	});

	describe("missing sections", () => {
		it("rejects a body without ## Ingredients", () => {
			const body = `## Instructions

1. Do something.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: "body",
					message: expect.stringContaining("Ingredients"),
				}),
			);
		});

		it("rejects a body without ## Instructions", () => {
			const body = `## Ingredients

- 1 cup flour
`;
			const result = validateBody(body);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: "body",
					message: expect.stringContaining("Instructions"),
				}),
			);
		});

		it("rejects an empty body", () => {
			const result = validateBody("");
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThanOrEqual(2);
		});

		it("rejects a body with neither required section", () => {
			const body = `## Notes

Just some notes here.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(false);
			const fields = result.errors.map((e) => e.message);
			expect(fields.some((m) => m.includes("Ingredients"))).toBe(true);
			expect(fields.some((m) => m.includes("Instructions"))).toBe(true);
		});
	});

	describe("empty sections", () => {
		it("rejects ## Ingredients with no list items", () => {
			const body = `## Ingredients

Just some text but no actual list items.

## Instructions

1. Do something.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "body.ingredients" }),
			);
		});

		it("rejects ## Instructions with no list items", () => {
			const body = `## Ingredients

- 1 cup flour

## Instructions

Some text but no numbered or bulleted steps.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({ field: "body.instructions" }),
			);
		});

		it("rejects both sections empty of list items", () => {
			const body = `## Ingredients

No list items here.

## Instructions

No list items here either.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBe(2);
		});
	});

	describe("body length", () => {
		it("rejects a body exceeding 50,000 characters", () => {
			const body = VALID_BODY + "x".repeat(50_001);
			const result = validateBody(body);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: "body",
					message: expect.stringContaining("50000"),
				}),
			);
		});
	});

	describe("heading case sensitivity", () => {
		it("rejects lowercase heading ## ingredients", () => {
			const body = `## ingredients

- 1 cup flour

## Instructions

1. Mix.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: "body",
					message: expect.stringContaining("Ingredients"),
				}),
			);
		});

		it("rejects lowercase heading ## instructions", () => {
			const body = `## Ingredients

- 1 cup flour

## instructions

1. Mix.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: "body",
					message: expect.stringContaining("Instructions"),
				}),
			);
		});
	});

	describe("heading level", () => {
		it("does not match h1 headings as sections", () => {
			const body = `# Ingredients

- 1 cup flour

# Instructions

1. Mix.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(false);
		});

		it("does not match h3 headings as sections", () => {
			const body = `### Ingredients

- 1 cup flour

### Instructions

1. Mix.
`;
			const result = validateBody(body);
			expect(result.valid).toBe(false);
		});
	});
});
