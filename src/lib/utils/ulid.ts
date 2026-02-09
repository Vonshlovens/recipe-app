/**
 * ULID generation and validation utilities for recipe IDs.
 * See: specs/recipe-data-model.md § ID Generation
 *
 * ULIDs are 26-character, Crockford Base32 encoded identifiers
 * that are sortable by creation time and require no coordination.
 */

import { ulid } from "ulid";

/**
 * Crockford's Base32 character set used by ULID.
 * 26 characters: 10-byte timestamp (48-bit ms) + 16-byte randomness (80-bit).
 */
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Generate a new ULID. Optionally accepts a seed time for deterministic ordering. */
export function generateUlid(seedTime?: number): string {
	return ulid(seedTime);
}

/** Validate that a string is a well-formed ULID (26 Crockford Base32 characters). */
export function isValidUlid(value: string): boolean {
	return ULID_REGEX.test(value);
}
