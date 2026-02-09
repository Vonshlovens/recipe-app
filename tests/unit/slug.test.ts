import { describe, expect, it } from "vitest";
import { generateSlug, generateUniqueSlug } from "$lib/utils/slug.ts";

describe("generateSlug", () => {
	it("converts a simple title to a slug", () => {
		expect(generateSlug("Crispy Chickpea Bowl")).toBe("crispy-chickpea-bowl");
	});

	it("lowercases the entire string", () => {
		expect(generateSlug("UPPER CASE TITLE")).toBe("upper-case-title");
	});

	it("replaces non-alphanumeric characters with hyphens", () => {
		expect(generateSlug("Pasta & Cheese (Deluxe!)")).toBe("pasta-cheese-deluxe");
	});

	it("collapses consecutive hyphens", () => {
		expect(generateSlug("one---two---three")).toBe("one-two-three");
	});

	it("trims leading and trailing hyphens", () => {
		expect(generateSlug("---hello---")).toBe("hello");
	});

	it("handles special characters and unicode", () => {
		expect(generateSlug("Crème Brûlée")).toBe("cr-me-br-l-e");
	});

	it("handles numbers in the title", () => {
		expect(generateSlug("5-Minute Oatmeal")).toBe("5-minute-oatmeal");
	});

	it("truncates to 100 characters", () => {
		const longTitle = "a".repeat(150);
		const slug = generateSlug(longTitle);
		expect(slug.length).toBeLessThanOrEqual(100);
		expect(slug).toBe("a".repeat(100));
	});

	it("trims trailing hyphens after truncation", () => {
		// Build a title that will produce a slug ending with a hyphen at the 100-char boundary
		const title = "a".repeat(99) + " b".repeat(50);
		const slug = generateSlug(title);
		expect(slug.length).toBeLessThanOrEqual(100);
		expect(slug).not.toMatch(/-$/);
	});

	it("returns empty string for title with no valid characters", () => {
		expect(generateSlug("!!!@@@###")).toBe("");
	});

	it("returns empty string for empty title", () => {
		expect(generateSlug("")).toBe("");
	});

	it("handles single-word titles", () => {
		expect(generateSlug("Pasta")).toBe("pasta");
	});

	it("handles titles with hyphens already present", () => {
		expect(generateSlug("gluten-free pasta")).toBe("gluten-free-pasta");
	});
});

describe("generateUniqueSlug", () => {
	it("returns the base slug when no collision", async () => {
		const existsFn = async () => false;
		const slug = await generateUniqueSlug("Crispy Chickpea Bowl", existsFn);
		expect(slug).toBe("crispy-chickpea-bowl");
	});

	it("appends -2 on first collision", async () => {
		const taken = new Set(["crispy-chickpea-bowl"]);
		const existsFn = async (slug: string) => taken.has(slug);
		const slug = await generateUniqueSlug("Crispy Chickpea Bowl", existsFn);
		expect(slug).toBe("crispy-chickpea-bowl-2");
	});

	it("appends -3 when -2 is also taken", async () => {
		const taken = new Set(["crispy-chickpea-bowl", "crispy-chickpea-bowl-2"]);
		const existsFn = async (slug: string) => taken.has(slug);
		const slug = await generateUniqueSlug("Crispy Chickpea Bowl", existsFn);
		expect(slug).toBe("crispy-chickpea-bowl-3");
	});

	it("skips collision check for the excluded ID", async () => {
		const existsFn = async (_slug: string, excludeId?: string) => {
			// Simulate: slug exists but belongs to the recipe being updated
			return excludeId !== "my-recipe-id";
		};
		const slug = await generateUniqueSlug("Crispy Chickpea Bowl", existsFn, "my-recipe-id");
		expect(slug).toBe("crispy-chickpea-bowl");
	});

	it("throws when title produces no valid slug characters", async () => {
		const existsFn = async () => false;
		await expect(generateUniqueSlug("!!!", existsFn)).rejects.toThrow(
			"Cannot generate slug: title produces no valid slug characters",
		);
	});

	it("throws after 999 attempts", async () => {
		const existsFn = async () => true; // everything is taken
		await expect(generateUniqueSlug("test", existsFn)).rejects.toThrow(
			"all suffixes -2 through -999 are taken",
		);
	});

	it("ensures suffixed slugs stay within 100 characters", async () => {
		const longTitle = "a".repeat(150);
		const taken = new Set([generateSlugSync(longTitle)]);
		const existsFn = async (slug: string) => taken.has(slug);
		const slug = await generateUniqueSlug(longTitle, existsFn);
		expect(slug.length).toBeLessThanOrEqual(100);
		expect(slug).toMatch(/-2$/);
	});
});

// Helper to get the sync slug for test setup
function generateSlugSync(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100)
		.replace(/-+$/, "");
}
