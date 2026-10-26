import { createHash } from 'node:crypto';
import type { TownBinding } from './townSnapshot.js';
export interface TownBindingsCache {
	countryId: string;
	fetchedAt: string;
	query: string;
	querySha256: string;
	results: { bindings: TownBinding[] };
}
/** A saved response must retain the identity/time/query of the actual fetch. */
export function validateTownBindingsCache(
	input: unknown,
	countryId: string,
	query?: string,
	now = Date.now()
): TownBindingsCache {
	const cache = input as Partial<TownBindingsCache> | null;
	if (!cache || cache.countryId !== countryId)
		throw new Error('Saved bindings country does not match ' + countryId);
	if (
		typeof cache.fetchedAt !== 'string' ||
		!Number.isFinite(Date.parse(cache.fetchedAt)) ||
		Date.parse(cache.fetchedAt) > now
	)
		throw new Error('Saved bindings need a valid original fetchedAt timestamp');
	if (
		typeof cache.query !== 'string' ||
		!cache.query ||
		cache.querySha256 !== createHash('sha256').update(cache.query).digest('hex')
	)
		throw new Error('Saved bindings query/digest is invalid');
	if (query !== undefined && query !== cache.query)
		throw new Error(
			'Saved bindings query differs from the current country profile; fetch a new response'
		);
	if (
		!Array.isArray(cache.results?.bindings) ||
		cache.results.bindings.length === 0 ||
		cache.results.bindings.length >= 10000
	)
		throw new Error('Saved bindings are empty, invalid or reached the query limit');
	return cache as TownBindingsCache;
}
