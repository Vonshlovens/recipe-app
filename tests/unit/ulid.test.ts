import { describe, expect, it } from "vitest";
import { generateUlid, isValidUlid } from "$lib/utils/ulid.ts";

describe("generateUlid", () => {
	it("returns a 26-character string", () => {
		const id = generateUlid();
		expect(id).toHaveLength(26);
	});

	it("returns valid Crockford Base32 characters", () => {
		const id = generateUlid();
		expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
	});

	it("generates unique IDs on successive calls", () => {
		const ids = new Set(Array.from({ length: 100 }, () => generateUlid()));
		expect(ids.size).toBe(100);
	});

	it("preserves chronological sort order", () => {
		const earlier = generateUlid(1000);
		const later = generateUlid(2000);
		expect(earlier < later).toBe(true);
	});

	it("accepts an optional seed time", () => {
		const id = generateUlid(0);
		expect(id).toHaveLength(26);
	});
});

describe("isValidUlid", () => {
	it("accepts a valid ULID", () => {
		const id = generateUlid();
		expect(isValidUlid(id)).toBe(true);
	});

	it("rejects an empty string", () => {
		expect(isValidUlid("")).toBe(false);
	});

	it("rejects a string that is too short", () => {
		expect(isValidUlid("01ARZ3NDEKTSV4RRFFQ69G5FA")).toBe(false); // 25 chars
	});

	it("rejects a string that is too long", () => {
		expect(isValidUlid("01ARZ3NDEKTSV4RRFFQ69G5FAAA")).toBe(false); // 28 chars
	});

	it("rejects lowercase characters", () => {
		expect(isValidUlid("01arz3ndektsv4rrffq69g5fav")).toBe(false);
	});

	it("rejects invalid Crockford Base32 characters (I, L, O, U)", () => {
		expect(isValidUlid("01ARZ3NDIKTSV4RRFFQ69G5FAV")).toBe(false); // I
		expect(isValidUlid("01ARZ3NDLKTSV4RRFFQ69G5FAV")).toBe(false); // L
		expect(isValidUlid("01ARZ3NDOKTSV4RRFFQ69G5FAV")).toBe(false); // O
		expect(isValidUlid("01ARZ3NDUKTSV4RRFFQ69G5FAV")).toBe(false); // U
	});

	it("rejects non-alphanumeric characters", () => {
		expect(isValidUlid("01ARZ3NDEKTSV4RRFFQ69G5FA-")).toBe(false);
		expect(isValidUlid("01ARZ3NDEKTSV4RRFFQ69G5FA!")).toBe(false);
	});
});
