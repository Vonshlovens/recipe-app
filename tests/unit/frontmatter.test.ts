import { describe, expect, it } from "vitest";
import {
	FrontmatterParseError,
	parseRecipeDocument,
	serializeRecipeDocument,
	splitFrontmatter,
} from "$lib/utils/frontmatter.ts";
import type { Recipe } from "$lib/types";

const FULL_DOCUMENT = `---
id: "01J5KEXAMPLE000000000ABCDE"
title: "Crispy Chickpea Bowl"
slug: "crispy-chickpea-bowl"
author: "Jane Doe"
source:
  type: "import"
  url: "https://example.com/recipe/chickpea-bowl"
  importedAt: "2026-01-15T10:30:00Z"
tags:
  cuisine: ["mediterranean"]
  meal: ["lunch", "dinner"]
  diet: ["vegan", "gluten-free"]
  technique: ["roasting"]
  custom: ["meal-prep", "quick"]
servings:
  default: 4
  unit: "bowls"
prepTime: "PT15M"
cookTime: "PT25M"
totalTime: "PT40M"
difficulty: "easy"
createdAt: "2026-01-15T10:30:00Z"
updatedAt: "2026-01-15T10:30:00Z"
---

## Ingredients

- 2 cans chickpeas
- 2 tbsp olive oil

## Instructions

1. Preheat oven to 425°F.
2. Roast chickpeas for 25 minutes.`;

const MINIMAL_DOCUMENT = `---
id: "01J5KEXAMPLE000000000ABCDE"
title: "Simple Toast"
slug: "simple-toast"
tags: {}
servings:
  default: 1
createdAt: "2026-01-15T10:30:00Z"
updatedAt: "2026-01-15T10:30:00Z"
---

## Ingredients

- 1 slice bread

## Instructions

1. Toast the bread.`;

describe("splitFrontmatter", () => {
	it("splits a valid document into frontmatter and body", () => {
		const result = splitFrontmatter(FULL_DOCUMENT);
		expect(result.frontmatter).toBeDefined();
		expect(typeof result.frontmatter).toBe("object");
		expect(result.frontmatter.title).toBe("Crispy Chickpea Bowl");
		expect(result.body).toContain("## Ingredients");
	});

	it("trims whitespace from the body", () => {
		const doc = `---
title: "Test"
---

  Body content here.  `;
		const result = splitFrontmatter(doc);
		expect(result.body).toBe("Body content here.");
	});

	it("handles empty body", () => {
		const doc = `---
title: "Test"
---
`;
		const result = splitFrontmatter(doc);
		expect(result.body).toBe("");
	});

	it("throws FrontmatterParseError for document without frontmatter", () => {
		expect(() => splitFrontmatter("Just a plain document")).toThrow(
			FrontmatterParseError,
		);
	});

	it("throws FrontmatterParseError for missing closing delimiter", () => {
		expect(() => splitFrontmatter("---\ntitle: Test\nNo closing")).toThrow(
			FrontmatterParseError,
		);
	});

	it("throws FrontmatterParseError for invalid YAML", () => {
		const doc = `---
title: [invalid yaml
  - broken: {
---

Body`;
		expect(() => splitFrontmatter(doc)).toThrow(FrontmatterParseError);
		expect(() => splitFrontmatter(doc)).toThrow(/Invalid YAML/);
	});

	it("throws FrontmatterParseError for scalar YAML (not a mapping)", () => {
		const doc = `---
just a string
---

Body`;
		expect(() => splitFrontmatter(doc)).toThrow(FrontmatterParseError);
		expect(() => splitFrontmatter(doc)).toThrow(/mapping/);
	});

	it("throws FrontmatterParseError for YAML sequence at root", () => {
		const doc = `---
- item1
- item2
---

Body`;
		expect(() => splitFrontmatter(doc)).toThrow(FrontmatterParseError);
		expect(() => splitFrontmatter(doc)).toThrow(/mapping/);
	});

	it("handles Windows-style line endings (CRLF)", () => {
		const doc = "---\r\ntitle: \"Test\"\r\n---\r\nBody content";
		const result = splitFrontmatter(doc);
		expect(result.frontmatter.title).toBe("Test");
		expect(result.body).toBe("Body content");
	});
});

describe("parseRecipeDocument", () => {
	it("parses a full recipe document with all fields", () => {
		const recipe = parseRecipeDocument(FULL_DOCUMENT);

		expect(recipe.id).toBe("01J5KEXAMPLE000000000ABCDE");
		expect(recipe.title).toBe("Crispy Chickpea Bowl");
		expect(recipe.slug).toBe("crispy-chickpea-bowl");
		expect(recipe.author).toBe("Jane Doe");
		expect(recipe.prepTime).toBe("PT15M");
		expect(recipe.cookTime).toBe("PT25M");
		expect(recipe.totalTime).toBe("PT40M");
		expect(recipe.difficulty).toBe("easy");
		expect(recipe.createdAt).toBe("2026-01-15T10:30:00Z");
		expect(recipe.updatedAt).toBe("2026-01-15T10:30:00Z");
	});

	it("parses source information", () => {
		const recipe = parseRecipeDocument(FULL_DOCUMENT);

		expect(recipe.source).toEqual({
			type: "import",
			url: "https://example.com/recipe/chickpea-bowl",
			importedAt: "2026-01-15T10:30:00Z",
		});
	});

	it("parses servings with unit", () => {
		const recipe = parseRecipeDocument(FULL_DOCUMENT);

		expect(recipe.servings).toEqual({
			default: 4,
			unit: "bowls",
		});
	});

	it("parses servings without unit", () => {
		const recipe = parseRecipeDocument(MINIMAL_DOCUMENT);

		expect(recipe.servings).toEqual({ default: 1 });
	});

	it("parses tags into correct groups", () => {
		const recipe = parseRecipeDocument(FULL_DOCUMENT);

		expect(recipe.tags.cuisine).toEqual(["mediterranean"]);
		expect(recipe.tags.meal).toEqual(["lunch", "dinner"]);
		expect(recipe.tags.diet).toEqual(["vegan", "gluten-free"]);
		expect(recipe.tags.technique).toEqual(["roasting"]);
		expect(recipe.tags.custom).toEqual(["meal-prep", "quick"]);
	});

	it("handles empty tags object", () => {
		const recipe = parseRecipeDocument(MINIMAL_DOCUMENT);
		expect(recipe.tags).toEqual({});
	});

	it("extracts body content", () => {
		const recipe = parseRecipeDocument(FULL_DOCUMENT);

		expect(recipe.body).toContain("## Ingredients");
		expect(recipe.body).toContain("2 cans chickpeas");
		expect(recipe.body).toContain("## Instructions");
		expect(recipe.body).toContain("Roast chickpeas");
	});

	it("omits optional fields when not present", () => {
		const recipe = parseRecipeDocument(MINIMAL_DOCUMENT);

		expect(recipe.author).toBeUndefined();
		expect(recipe.source).toBeUndefined();
		expect(recipe.prepTime).toBeUndefined();
		expect(recipe.cookTime).toBeUndefined();
		expect(recipe.totalTime).toBeUndefined();
		expect(recipe.difficulty).toBeUndefined();
		expect(recipe.image).toBeUndefined();
	});

	it("handles source with only type (no url or importedAt)", () => {
		const doc = `---
id: "01J5KEXAMPLE000000000ABCDE"
title: "Manual Recipe"
slug: "manual-recipe"
source:
  type: "manual"
tags: {}
servings:
  default: 2
createdAt: "2026-01-15T10:30:00Z"
updatedAt: "2026-01-15T10:30:00Z"
---

## Ingredients

- 1 item

## Instructions

1. Do the thing.`;

		const recipe = parseRecipeDocument(doc);
		expect(recipe.source).toEqual({ type: "manual" });
	});

	it("handles image field", () => {
		const doc = `---
id: "01J5KEXAMPLE000000000ABCDE"
title: "Pretty Recipe"
slug: "pretty-recipe"
image: "/images/recipe.jpg"
tags: {}
servings:
  default: 2
createdAt: "2026-01-15T10:30:00Z"
updatedAt: "2026-01-15T10:30:00Z"
---

## Ingredients

- 1 item

## Instructions

1. Do the thing.`;

		const recipe = parseRecipeDocument(doc);
		expect(recipe.image).toBe("/images/recipe.jpg");
	});

	it("coerces non-string field values to strings", () => {
		const doc = `---
id: 12345
title: 42
slug: true
tags: {}
servings:
  default: 4
createdAt: 2026-01-15
updatedAt: 2026-01-15
---

Body`;

		const recipe = parseRecipeDocument(doc);
		expect(typeof recipe.id).toBe("string");
		expect(typeof recipe.title).toBe("string");
		expect(typeof recipe.slug).toBe("string");
	});

	it("handles tags with non-array values gracefully (ignores them)", () => {
		const doc = `---
id: "01J5KEXAMPLE000000000ABCDE"
title: "Test"
slug: "test"
tags:
  cuisine: ["italian"]
  meal: "not-an-array"
  diet: 42
servings:
  default: 1
createdAt: "2026-01-15T10:30:00Z"
updatedAt: "2026-01-15T10:30:00Z"
---

Body`;

		const recipe = parseRecipeDocument(doc);
		expect(recipe.tags.cuisine).toEqual(["italian"]);
		expect(recipe.tags.meal).toBeUndefined();
		expect(recipe.tags.diet).toBeUndefined();
	});

	it("defaults servings to 0 when missing or malformed", () => {
		const doc = `---
id: "01J5KEXAMPLE000000000ABCDE"
title: "Test"
slug: "test"
tags: {}
servings: "not-an-object"
createdAt: "2026-01-15T10:30:00Z"
updatedAt: "2026-01-15T10:30:00Z"
---

Body`;

		const recipe = parseRecipeDocument(doc);
		expect(recipe.servings.default).toBe(0);
	});

	it("propagates FrontmatterParseError from invalid documents", () => {
		expect(() => parseRecipeDocument("no frontmatter here")).toThrow(
			FrontmatterParseError,
		);
	});
});

const FULL_RECIPE: Recipe = {
	id: "01J5KEXAMPLE000000000ABCDE",
	title: "Crispy Chickpea Bowl",
	slug: "crispy-chickpea-bowl",
	author: "Jane Doe",
	source: {
		type: "import",
		url: "https://example.com/recipe/chickpea-bowl",
		importedAt: "2026-01-15T10:30:00Z",
	},
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
	createdAt: "2026-01-15T10:30:00Z",
	updatedAt: "2026-01-15T10:30:00Z",
	body: "## Ingredients\n\n- 2 cans chickpeas\n- 2 tbsp olive oil\n\n## Instructions\n\n1. Preheat oven to 425°F.\n2. Roast chickpeas for 25 minutes.",
};

const MINIMAL_RECIPE: Recipe = {
	id: "01J5KEXAMPLE000000000ABCDE",
	title: "Simple Toast",
	slug: "simple-toast",
	tags: {},
	servings: { default: 1 },
	createdAt: "2026-01-15T10:30:00Z",
	updatedAt: "2026-01-15T10:30:00Z",
	body: "## Ingredients\n\n- 1 slice bread\n\n## Instructions\n\n1. Toast the bread.",
};

describe("serializeRecipeDocument", () => {
	it("serializes a full recipe to a valid document", () => {
		const doc = serializeRecipeDocument(FULL_RECIPE);

		expect(doc).toContain("---\n");
		expect(doc).toContain("title: Crispy Chickpea Bowl\n");
		expect(doc).toContain("slug: crispy-chickpea-bowl\n");
		expect(doc).toContain("author: Jane Doe\n");
		expect(doc).toContain("## Ingredients");
		expect(doc).toContain("## Instructions");
	});

	it("serializes a minimal recipe without optional fields", () => {
		const doc = serializeRecipeDocument(MINIMAL_RECIPE);

		expect(doc).toContain("title: Simple Toast\n");
		expect(doc).not.toContain("author:");
		expect(doc).not.toContain("source:");
		expect(doc).not.toContain("prepTime:");
		expect(doc).not.toContain("cookTime:");
		expect(doc).not.toContain("totalTime:");
		expect(doc).not.toContain("difficulty:");
		expect(doc).not.toContain("image:");
	});

	it("round-trips a full recipe (serialize then parse)", () => {
		const doc = serializeRecipeDocument(FULL_RECIPE);
		const parsed = parseRecipeDocument(doc);

		expect(parsed.id).toBe(FULL_RECIPE.id);
		expect(parsed.title).toBe(FULL_RECIPE.title);
		expect(parsed.slug).toBe(FULL_RECIPE.slug);
		expect(parsed.author).toBe(FULL_RECIPE.author);
		expect(parsed.source).toEqual(FULL_RECIPE.source);
		expect(parsed.tags).toEqual(FULL_RECIPE.tags);
		expect(parsed.servings).toEqual(FULL_RECIPE.servings);
		expect(parsed.prepTime).toBe(FULL_RECIPE.prepTime);
		expect(parsed.cookTime).toBe(FULL_RECIPE.cookTime);
		expect(parsed.totalTime).toBe(FULL_RECIPE.totalTime);
		expect(parsed.difficulty).toBe(FULL_RECIPE.difficulty);
		expect(parsed.createdAt).toBe(FULL_RECIPE.createdAt);
		expect(parsed.updatedAt).toBe(FULL_RECIPE.updatedAt);
		expect(parsed.body).toBe(FULL_RECIPE.body);
	});

	it("round-trips a minimal recipe", () => {
		const doc = serializeRecipeDocument(MINIMAL_RECIPE);
		const parsed = parseRecipeDocument(doc);

		expect(parsed.id).toBe(MINIMAL_RECIPE.id);
		expect(parsed.title).toBe(MINIMAL_RECIPE.title);
		expect(parsed.slug).toBe(MINIMAL_RECIPE.slug);
		expect(parsed.tags).toEqual({});
		expect(parsed.servings).toEqual({ default: 1 });
		expect(parsed.author).toBeUndefined();
		expect(parsed.source).toBeUndefined();
		expect(parsed.body).toBe(MINIMAL_RECIPE.body);
	});

	it("round-trips a parsed document (parse then serialize then parse)", () => {
		const original = parseRecipeDocument(FULL_DOCUMENT);
		const serialized = serializeRecipeDocument(original);
		const reparsed = parseRecipeDocument(serialized);

		expect(reparsed.id).toBe(original.id);
		expect(reparsed.title).toBe(original.title);
		expect(reparsed.slug).toBe(original.slug);
		expect(reparsed.author).toBe(original.author);
		expect(reparsed.source).toEqual(original.source);
		expect(reparsed.tags).toEqual(original.tags);
		expect(reparsed.servings).toEqual(original.servings);
		expect(reparsed.prepTime).toBe(original.prepTime);
		expect(reparsed.cookTime).toBe(original.cookTime);
		expect(reparsed.totalTime).toBe(original.totalTime);
		expect(reparsed.difficulty).toBe(original.difficulty);
		expect(reparsed.body).toBe(original.body);
	});

	it("includes source fields correctly", () => {
		const doc = serializeRecipeDocument(FULL_RECIPE);

		expect(doc).toContain("type: import");
		expect(doc).toContain("url: https://example.com/recipe/chickpea-bowl");
		expect(doc).toContain("importedAt:");
	});

	it("serializes source with only type (no url or importedAt)", () => {
		const recipe: Recipe = {
			...MINIMAL_RECIPE,
			source: { type: "manual" },
		};
		const doc = serializeRecipeDocument(recipe);

		expect(doc).toContain("type: manual");
		expect(doc).not.toMatch(/url:/);
		expect(doc).not.toMatch(/importedAt:/);
	});

	it("serializes servings with unit", () => {
		const doc = serializeRecipeDocument(FULL_RECIPE);
		expect(doc).toContain("default: 4");
		expect(doc).toContain("unit: bowls");
	});

	it("serializes servings without unit", () => {
		const doc = serializeRecipeDocument(MINIMAL_RECIPE);
		expect(doc).toContain("default: 1");
		expect(doc).not.toMatch(/unit:/);
	});

	it("serializes tags as flow arrays", () => {
		const doc = serializeRecipeDocument(FULL_RECIPE);
		expect(doc).toContain("cuisine:");
		expect(doc).toContain("mediterranean");
		expect(doc).toContain("meal:");
	});

	it("serializes empty tags as empty object", () => {
		const doc = serializeRecipeDocument(MINIMAL_RECIPE);
		expect(doc).toContain("tags: {}");
	});

	it("omits tag groups with empty arrays", () => {
		const recipe: Recipe = {
			...MINIMAL_RECIPE,
			tags: { cuisine: [], meal: ["lunch"] },
		};
		const doc = serializeRecipeDocument(recipe);

		expect(doc).not.toContain("cuisine:");
		expect(doc).toContain("meal:");
	});

	it("serializes image field when present", () => {
		const recipe: Recipe = {
			...MINIMAL_RECIPE,
			image: "/images/toast.jpg",
		};
		const doc = serializeRecipeDocument(recipe);
		expect(doc).toContain("image: /images/toast.jpg");
	});

	it("handles empty body", () => {
		const recipe: Recipe = { ...MINIMAL_RECIPE, body: "" };
		const doc = serializeRecipeDocument(recipe);

		expect(doc.endsWith("---\n")).toBe(true);
		// Should still be parseable
		const parsed = parseRecipeDocument(doc);
		expect(parsed.body).toBe("");
	});
});
