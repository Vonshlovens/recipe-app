import { describe, expect, it } from "vitest";
import {
	addDurations,
	parseDuration,
	serializeDuration,
} from "$lib/utils/duration.ts";

describe("parseDuration", () => {
	it("parses minutes only", () => {
		expect(parseDuration("PT15M")).toEqual({
			years: 0, months: 0, weeks: 0, days: 0,
			hours: 0, minutes: 15, seconds: 0,
		});
	});

	it("parses hours and minutes", () => {
		expect(parseDuration("PT1H30M")).toEqual({
			years: 0, months: 0, weeks: 0, days: 0,
			hours: 1, minutes: 30, seconds: 0,
		});
	});

	it("parses full date and time components", () => {
		expect(parseDuration("P1Y2M3W4DT5H6M7S")).toEqual({
			years: 1, months: 2, weeks: 3, days: 4,
			hours: 5, minutes: 6, seconds: 7,
		});
	});

	it("parses fractional seconds", () => {
		const d = parseDuration("PT1.5S");
		expect(d).not.toBeNull();
		expect(d!.seconds).toBe(1.5);
	});

	it("parses zero seconds", () => {
		expect(parseDuration("PT0S")).toEqual({
			years: 0, months: 0, weeks: 0, days: 0,
			hours: 0, minutes: 0, seconds: 0,
		});
	});

	it("parses days only", () => {
		expect(parseDuration("P3D")).toEqual({
			years: 0, months: 0, weeks: 0, days: 3,
			hours: 0, minutes: 0, seconds: 0,
		});
	});

	it("returns null for bare P", () => {
		expect(parseDuration("P")).toBeNull();
	});

	it("returns null for bare PT", () => {
		expect(parseDuration("PT")).toBeNull();
	});

	it("returns null for invalid string", () => {
		expect(parseDuration("15 minutes")).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(parseDuration("")).toBeNull();
	});
});

describe("addDurations", () => {
	it("adds two simple durations", () => {
		const a = parseDuration("PT15M")!;
		const b = parseDuration("PT25M")!;
		expect(addDurations(a, b)).toEqual({
			years: 0, months: 0, weeks: 0, days: 0,
			hours: 0, minutes: 40, seconds: 0,
		});
	});

	it("normalizes minutes overflow to hours", () => {
		const a = parseDuration("PT45M")!;
		const b = parseDuration("PT30M")!;
		expect(addDurations(a, b)).toEqual({
			years: 0, months: 0, weeks: 0, days: 0,
			hours: 1, minutes: 15, seconds: 0,
		});
	});

	it("normalizes seconds overflow to minutes", () => {
		const a = parseDuration("PT50S")!;
		const b = parseDuration("PT20S")!;
		expect(addDurations(a, b)).toEqual({
			years: 0, months: 0, weeks: 0, days: 0,
			hours: 0, minutes: 1, seconds: 10,
		});
	});

	it("adds mixed date and time components", () => {
		const a = parseDuration("P1DT1H")!;
		const b = parseDuration("P2DT2H30M")!;
		expect(addDurations(a, b)).toEqual({
			years: 0, months: 0, weeks: 0, days: 3,
			hours: 3, minutes: 30, seconds: 0,
		});
	});

	it("handles double overflow (seconds → minutes → hours)", () => {
		const a = parseDuration("PT59M50S")!;
		const b = parseDuration("PT1M20S")!;
		const result = addDurations(a, b);
		expect(result.hours).toBe(1);
		expect(result.minutes).toBe(1);
		expect(result.seconds).toBe(10);
	});
});

describe("serializeDuration", () => {
	it("serializes minutes only", () => {
		expect(serializeDuration(parseDuration("PT40M")!)).toBe("PT40M");
	});

	it("serializes hours and minutes", () => {
		expect(serializeDuration(parseDuration("PT1H15M")!)).toBe("PT1H15M");
	});

	it("serializes days and time", () => {
		expect(serializeDuration(parseDuration("P3DT2H")!)).toBe("P3DT2H");
	});

	it("serializes all-zero as PT0S", () => {
		expect(serializeDuration({
			years: 0, months: 0, weeks: 0, days: 0,
			hours: 0, minutes: 0, seconds: 0,
		})).toBe("PT0S");
	});

	it("round-trips through parse and serialize", () => {
		const durations = ["PT15M", "PT1H30M", "P1DT2H", "PT0S", "P1Y2M3W4DT5H6M7S"];
		for (const iso of durations) {
			expect(serializeDuration(parseDuration(iso)!)).toBe(iso);
		}
	});
});
