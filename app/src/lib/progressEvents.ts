// Immutable account-progress operations. No auth/network/storage dependencies.
import {
	MAX_EASE_FACTOR,
	MAX_INTERVAL_DAYS,
	MIN_EASE_FACTOR,
	rate,
	type CardState as SchedulerState,
	type Grade
} from '@geoclick/srs';
import { forgetLearned, recordConfusion } from './confusions';
import type { CardState, MapRecords, SessionSummary } from './progressRepository';

export interface ProgressOwner {
	readonly projectId: string;
	readonly uid: string;
}
export type ProgressOperation =
	| {
			kind: 'answer';
			mapId: string;
			targetId: string;
			roundId: string;
			grade: Grade;
			date: string;
			chosenId?: string;
	  }
	| {
			kind: 'round';
			mapId: string;
			roundId: string;
			summary: SessionSummary;
			slipped: number;
			timedMs?: number;
	  }
	| { kind: 'import-card'; mapId: string; targetId: string; state: SchedulerState }
	| { kind: 'import-map'; mapId: string; summary?: SessionSummary; records: MapRecords }
	| { kind: 'reset'; scope: 'known' | 'map'; mapId: string }
	| { kind: 'reset'; scope: 'all' };
export interface ProgressEvent {
	version: 1;
	id: string;
	projectId: string;
	uid: string;
	deviceId: string;
	sequence: number;
	logicalTime: number;
	/** Current complete causal frontier; references immutable event IDs. */
	parents: string[];
	/** Stable caller operation identity; retries must reuse it. */
	operationKey: string;
	operation: ProgressOperation;
}
export interface ProgressIssue {
	id?: string;
	reason: string;
}
export interface ProgressGraph {
	events: ProgressEvent[];
	heads: string[];
	clocks: ReadonlyMap<string, ReadonlyMap<string, number>>;
	clock: ReadonlyMap<string, number>;
	logicalTime: number;
	quarantined: ProgressIssue[];
	deferred: string[];
}
/** Minimal account-bound journal contract shared by quiz and explicit import. */
export interface ProgressJournal {
	readonly owner: Readonly<ProgressOwner>;
	snapshot(): Promise<ProgressGraph>;
	append(operation: ProgressOperation, key: string): Promise<ProgressEvent>;
}
export interface ProgressProjection {
	cards: CardState[];
	lastSession?: SessionSummary;
	records: MapRecords;
	quarantined: ProgressIssue[];
	deferred: string[];
	ignored: ProgressIssue[];
}
export const MAX_PROGRESS_PARENTS = 128;
const MAX_NUMBER = 1_000_000;
const record = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 256): v is string =>
	typeof v === 'string' &&
	v.length > 0 &&
	v.length <= max &&
	[...v].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);
const token = (v: unknown): v is string => text(v, 128) && /^[A-Za-z0-9_-]+$/.test(v);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number =>
	typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const finite = (v: unknown, min: number, max: number): v is number =>
	typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const fields = (v: Record<string, unknown>, allowed: string[]) =>
	Object.keys(v).every((k) => allowed.includes(k));
export function progressOwnerKey(owner: ProgressOwner): string {
	if (!text(owner.projectId, 128) || !text(owner.uid, 128))
		throw new Error('Invalid progress owner');
	return JSON.stringify([owner.projectId, owner.uid]);
}
function day(v: unknown): v is string {
	if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
	const year = Number(v.slice(0, 4));
	if (year < 1970 || year > 9998) return false;
	const parsed = new Date(v + 'T00:00:00.000Z');
	return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
}
function summary(v: unknown): v is SessionSummary {
	if (!record(v) || !fields(v, ['total', 'perfect', 'totalErrors', 'completedAt'])) return false;
	return (
		integer(v.total, 0, 10000) &&
		integer(v.perfect, 0, v.total) &&
		integer(v.totalErrors, 0, MAX_NUMBER) &&
		typeof v.completedAt === 'string' &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v.completedAt) &&
		day(v.completedAt.slice(0, 10)) &&
		Number.isFinite(Date.parse(v.completedAt)) &&
		new Date(v.completedAt).toISOString() ===
			(v.completedAt.includes('.') ? v.completedAt : v.completedAt.replace('Z', '.000Z'))
	);
}
function scheduler(v: unknown): v is SchedulerState {
	return (
		record(v) &&
		fields(v, [
			'easeFactor',
			'interval',
			'repetitions',
			'cleanStreak',
			'dueDate',
			'lastReviewedAt'
		]) &&
		finite(v.easeFactor, MIN_EASE_FACTOR, MAX_EASE_FACTOR) &&
		integer(v.interval, 0, MAX_INTERVAL_DAYS) &&
		integer(v.repetitions, 0, MAX_NUMBER) &&
		integer(v.cleanStreak, 0, 3) &&
		day(v.dueDate) &&
		day(v.lastReviewedAt)
	);
}
function mapRecords(v: unknown): v is MapRecords {
	if (!record(v) || !fields(v, ['bestTimeMs', 'confusions', 'slipped'])) return false;
	if (v.bestTimeMs !== undefined && !finite(v.bestTimeMs, 0.001, 1e12)) return false;
	if (v.slipped !== undefined && !integer(v.slipped, 0, 10000)) return false;
	if (
		v.confusions !== undefined &&
		(!Array.isArray(v.confusions) ||
			v.confusions.length > 20 ||
			!v.confusions.every(
				(c) =>
					record(c) &&
					fields(c, ['targetId', 'chosenId', 'count']) &&
					text(c.targetId) &&
					text(c.chosenId) &&
					integer(c.count, 1, MAX_NUMBER)
			))
	)
		return false;
	return true;
}
export function parseProgressOperation(input: unknown): ProgressOperation | undefined {
	// Take one data snapshot; inherited toJSON/getters must not alter a validated payload.
	try {
		input = structuredClone(input);
	} catch {
		return undefined;
	}
	if (!record(input)) return;
	let valid = false;
	const hasMap = text(input.mapId, 128);
	switch (input.kind) {
		case 'answer':
			valid =
				fields(input, ['kind', 'mapId', 'targetId', 'roundId', 'grade', 'date', 'chosenId']) &&
				hasMap &&
				text(input.targetId) &&
				token(input.roundId) &&
				typeof input.grade === 'string' &&
				['good', 'again', 'hard'].includes(input.grade) &&
				day(input.date) &&
				(input.chosenId === undefined || text(input.chosenId));
			break;
		case 'round':
			valid =
				fields(input, ['kind', 'mapId', 'roundId', 'summary', 'slipped', 'timedMs']) &&
				hasMap &&
				token(input.roundId) &&
				summary(input.summary) &&
				integer(input.slipped, 0, input.summary.total) &&
				(input.timedMs === undefined || finite(input.timedMs, 0.001, 1e12));
			break;
		case 'import-card':
			valid =
				fields(input, ['kind', 'mapId', 'targetId', 'state']) &&
				hasMap &&
				text(input.targetId) &&
				scheduler(input.state);
			break;
		case 'import-map':
			valid =
				fields(input, ['kind', 'mapId', 'summary', 'records']) &&
				hasMap &&
				mapRecords(input.records) &&
				(input.summary === undefined || summary(input.summary));
			break;
		case 'reset':
			valid =
				input.scope === 'all'
					? fields(input, ['kind', 'scope'])
					: fields(input, ['kind', 'scope', 'mapId']) &&
						hasMap &&
						(input.scope === 'known' || input.scope === 'map');
			break;
	}
	return valid ? (JSON.parse(JSON.stringify(input)) as ProgressOperation) : undefined;
}
export function parseProgressEvent(
	input: unknown,
	owner: ProgressOwner
): { event?: ProgressEvent; reason?: string } {
	try {
		if (!record(input)) return { reason: 'malformed-event' };
		if (input.projectId !== owner.projectId || input.uid !== owner.uid)
			return { reason: 'wrong-owner' };
		if (input.version !== 1) return { reason: 'unsupported-version' };
		if (
			!fields(input, [
				'version',
				'id',
				'projectId',
				'uid',
				'deviceId',
				'sequence',
				'logicalTime',
				'parents',
				'operationKey',
				'operation'
			]) ||
			!token(input.id) ||
			!token(input.deviceId) ||
			!integer(input.sequence, 1) ||
			!integer(input.logicalTime, 1) ||
			!text(input.operationKey, 512) ||
			!Array.isArray(input.parents) ||
			input.parents.length > MAX_PROGRESS_PARENTS ||
			!Array.from(input.parents).every(token) ||
			new Set(input.parents).size !== input.parents.length ||
			input.parents.includes(input.id)
		)
			return { reason: 'malformed-event' };
		const operation = parseProgressOperation(input.operation);
		if (!operation) return { reason: 'malformed-operation' };
		return {
			event: {
				version: 1,
				id: input.id,
				projectId: owner.projectId,
				uid: owner.uid,
				deviceId: input.deviceId,
				sequence: input.sequence,
				logicalTime: input.logicalTime,
				parents: [...input.parents].sort(),
				operationKey: input.operationKey,
				operation
			}
		};
	} catch {
		return { reason: 'malformed-event' };
	}
}
/** Canonical comparison only for already validated JSON data. */
export function progressFingerprint(value: unknown): string {
	if (Array.isArray(value)) return '[' + value.map(progressFingerprint).join(',') + ']';
	if (record(value))
		return (
			'{' +
			Object.keys(value)
				.sort()
				.map((k) => JSON.stringify(k) + ':' + progressFingerprint(value[k]))
				.join(',') +
			'}'
		);
	return JSON.stringify(value);
}
export function compareProgressEvents(a: ProgressEvent, b: ProgressEvent): number {
	const lexical = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
	return (
		a.logicalTime - b.logicalTime ||
		lexical(a.deviceId, b.deviceId) ||
		a.sequence - b.sequence ||
		lexical(a.id, b.id)
	);
}
export function analyzeProgressEvents(
	input: readonly unknown[],
	owner: ProgressOwner
): ProgressGraph {
	progressOwnerKey(owner);
	const quarantined: ProgressIssue[] = [],
		byId = new Map<string, ProgressEvent>(),
		badIds = new Set<string>();
	for (const raw of input) {
		const parsed = parseProgressEvent(raw, owner);
		if (!parsed.event) {
			quarantined.push({
				reason: parsed.reason!,
				...(record(raw) && parsed.reason !== 'wrong-owner' && token(raw.id) ? { id: raw.id } : {})
			});
			continue;
		}
		const event = parsed.event,
			old = byId.get(event.id);
		if (old && progressFingerprint(old) !== progressFingerprint(event)) badIds.add(event.id);
		else byId.set(event.id, event);
	}
	const keys = new Map<string, string>(),
		actorPositions = new Map<string, string>();
	for (const event of byId.values()) {
		if (badIds.has(event.id)) continue;
		for (const [index, key, reason] of [
			[keys, event.operationKey, 'conflicting-operation'],
			[actorPositions, JSON.stringify([event.deviceId, event.sequence]), 'conflicting-sequence']
		] as const) {
			const old = index.get(key);
			if (old && old !== event.id) {
				badIds.add(old);
				badIds.add(event.id);
				quarantined.push({ id: old, reason }, { id: event.id, reason });
			} else index.set(key, event.id);
		}
	}
	for (const id of badIds) {
		byId.delete(id);
		quarantined.push({ id, reason: 'conflicting-event' });
	}
	const candidates = [...byId.values()].sort(compareProgressEvents),
		events: ProgressEvent[] = [],
		deferred: string[] = [];
	const clocks = new Map<string, ReadonlyMap<string, number>>(),
		clock = new Map<string, number>(),
		heads = new Set<string>();
	let logicalTime = 0;
	for (const event of candidates) {
		if (event.parents.some((id) => !byId.has(id))) {
			deferred.push(event.id);
			continue;
		}
		if (event.parents.some((id) => byId.get(id)!.logicalTime >= event.logicalTime)) {
			quarantined.push({ id: event.id, reason: 'invalid-causality' });
			continue;
		}
		if (event.parents.some((id) => !clocks.has(id))) {
			deferred.push(event.id);
			continue;
		}
		const seen = new Map<string, number>();
		for (const id of event.parents)
			for (const [actor, sequence] of clocks.get(id)!)
				seen.set(actor, Math.max(seen.get(actor) ?? 0, sequence));
		if ((seen.get(event.deviceId) ?? 0) !== event.sequence - 1) {
			quarantined.push({ id: event.id, reason: 'invalid-sequence' });
			continue;
		}
		seen.set(event.deviceId, event.sequence);
		clocks.set(event.id, seen);
		events.push(event);
		for (const id of event.parents) heads.delete(id);
		heads.add(event.id);
		logicalTime = Math.max(logicalTime, event.logicalTime);
		for (const [actor, sequence] of seen)
			clock.set(actor, Math.max(clock.get(actor) ?? 0, sequence));
	}
	return {
		events,
		clocks,
		clock,
		heads: [...heads].sort(),
		logicalTime,
		quarantined,
		deferred: deferred.sort()
	};
}
export function progressHappensBefore(
	a: ProgressEvent,
	b: ProgressEvent,
	graph: ProgressGraph
): boolean {
	return a.id !== b.id && (graph.clocks.get(b.id)?.get(a.deviceId) ?? 0) >= a.sequence;
}
export function projectProgress(
	graph: ProgressGraph,
	mapId: string,
	targetIds: ReadonlySet<string>
): ProgressProjection {
	const cards = new Map<string, CardState>(),
		ignored: ProgressIssue[] = [],
		quarantined = [...graph.quarantined];
	let records: MapRecords = {},
		lastSession: SessionSummary | undefined;
	const relevant = graph.events.filter(
		(e) =>
			(e.operation.kind === 'reset' && e.operation.scope === 'all') ||
			('mapId' in e.operation && e.operation.mapId === mapId)
	);
	const resets = relevant.filter((e) => e.operation.kind === 'reset');
	const blocked = (event: ProgressEvent, keepScore: boolean) =>
		resets.some(
			(reset) =>
				reset.operation.kind === 'reset' &&
				(!keepScore || reset.operation.scope !== 'known') &&
				!progressHappensBefore(reset, event, graph)
		);
	const priorAccount = (event: ProgressEvent, target?: string) =>
		relevant.some(
			(other) =>
				other.id !== event.id &&
				(other.operation.kind === 'answer' || other.operation.kind === 'round') &&
				(target === undefined ||
					(other.operation.kind === 'answer' && other.operation.targetId === target)) &&
				!progressHappensBefore(event, other, graph)
		);
	const importedTargets = new Set<string>();
	let importedMap = false;
	for (const event of relevant) {
		const op = event.operation;
		if (op.kind === 'reset') continue;
		if (
			(op.kind === 'answer' || op.kind === 'import-card') &&
			(!targetIds.has(op.targetId) ||
				(op.kind === 'answer' && op.chosenId !== undefined && !targetIds.has(op.chosenId)))
		) {
			quarantined.push({ id: event.id, reason: 'unknown-target' });
			continue;
		}
		if (op.kind === 'import-card') {
			if (resets.length || importedTargets.has(op.targetId) || priorAccount(event, op.targetId)) {
				ignored.push({ id: event.id, reason: 'account-import-conflict' });
				continue;
			}
			importedTargets.add(op.targetId);
			cards.set(op.targetId, { targetId: op.targetId, ...op.state });
			continue;
		}
		if (op.kind === 'import-map') {
			if (
				op.records.confusions?.some((c) => !targetIds.has(c.targetId) || !targetIds.has(c.chosenId))
			) {
				quarantined.push({ id: event.id, reason: 'unknown-target' });
				continue;
			}
			if (
				resets.some((reset) => !progressHappensBefore(event, reset, graph)) ||
				importedMap ||
				priorAccount(event)
			) {
				ignored.push({ id: event.id, reason: 'account-import-conflict' });
				continue;
			}
			importedMap = true;
			if (!blocked(event, false)) records = structuredClone(op.records);
			if (op.summary && !blocked(event, true)) lastSession = { ...op.summary };
			continue;
		}
		if (op.kind === 'answer') {
			if (blocked(event, false)) {
				ignored.push({ id: event.id, reason: 'reset-wins' });
				continue;
			}
			cards.set(op.targetId, {
				targetId: op.targetId,
				...rate(cards.get(op.targetId), op.grade, op.date)
			});
			if (op.chosenId !== undefined)
				records.confusions = recordConfusion(records.confusions ?? [], op.targetId, op.chosenId);
			continue;
		}
		if (!blocked(event, true)) lastSession = { ...op.summary };
		if (blocked(event, false)) {
			ignored.push({ id: event.id, reason: 'reset-wins-records' });
			continue;
		}
		records.slipped = op.slipped;
		records.confusions = forgetLearned(
			records.confusions ?? [],
			new Map([...cards].map(([id, state]) => [id, state.cleanStreak]))
		);
		if (
			op.timedMs !== undefined &&
			op.summary.totalErrors === 0 &&
			op.summary.total > 0 &&
			(records.bestTimeMs === undefined || op.timedMs < records.bestTimeMs)
		)
			records.bestTimeMs = op.timedMs;
	}
	return {
		cards: [...cards.values()].sort((a, b) =>
			a.targetId < b.targetId ? -1 : a.targetId > b.targetId ? 1 : 0
		),
		records,
		...(lastSession ? { lastSession } : {}),
		ignored,
		quarantined,
		deferred: [...graph.deferred]
	};
}
