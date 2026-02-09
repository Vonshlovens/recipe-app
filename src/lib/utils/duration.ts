/**
 * ISO 8601 duration parsing and arithmetic.
 * Used by on-save logic to calculate totalTime from prepTime + cookTime.
 */

/** Parsed components of an ISO 8601 duration. */
export interface DurationComponents {
	years: number;
	months: number;
	weeks: number;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

const ISO_DURATION_REGEX =
	/^P(?!$)(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?!$)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * Parse an ISO 8601 duration string into its components.
 * Returns null if the string is not a valid duration.
 */
export function parseDuration(iso: string): DurationComponents | null {
	const m = iso.match(ISO_DURATION_REGEX);
	if (!m) return null;

	return {
		years: m[1] ? parseInt(m[1], 10) : 0,
		months: m[2] ? parseInt(m[2], 10) : 0,
		weeks: m[3] ? parseInt(m[3], 10) : 0,
		days: m[4] ? parseInt(m[4], 10) : 0,
		hours: m[5] ? parseInt(m[5], 10) : 0,
		minutes: m[6] ? parseInt(m[6], 10) : 0,
		seconds: m[7] ? parseFloat(m[7]) : 0,
	};
}

/**
 * Add two DurationComponents together.
 * Normalizes seconds→minutes and minutes→hours, but leaves
 * days/weeks/months/years un-normalized (no calendar math).
 */
export function addDurations(
	a: DurationComponents,
	b: DurationComponents,
): DurationComponents {
	let seconds = a.seconds + b.seconds;
	let minutes = a.minutes + b.minutes;
	let hours = a.hours + b.hours;
	const days = a.days + b.days;
	const weeks = a.weeks + b.weeks;
	const months = a.months + b.months;
	const years = a.years + b.years;

	// Normalize time components
	if (seconds >= 60) {
		minutes += Math.floor(seconds / 60);
		seconds = seconds % 60;
	}
	if (minutes >= 60) {
		hours += Math.floor(minutes / 60);
		minutes = minutes % 60;
	}

	return { years, months, weeks, days, hours, minutes, seconds };
}

/**
 * Serialize DurationComponents back to an ISO 8601 duration string.
 * Omits zero-valued components for conciseness.
 */
export function serializeDuration(d: DurationComponents): string {
	let datePart = "";
	if (d.years) datePart += `${d.years}Y`;
	if (d.months) datePart += `${d.months}M`;
	if (d.weeks) datePart += `${d.weeks}W`;
	if (d.days) datePart += `${d.days}D`;

	let timePart = "";
	if (d.hours) timePart += `${d.hours}H`;
	if (d.minutes) timePart += `${d.minutes}M`;
	if (d.seconds) {
		timePart += Number.isInteger(d.seconds)
			? `${d.seconds}S`
			: `${d.seconds}S`;
	}

	if (!datePart && !timePart) return "PT0S";
	return `P${datePart}${timePart ? `T${timePart}` : ""}`;
}
