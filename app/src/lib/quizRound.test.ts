import { describe, expect, it } from 'vitest';
import { createQuizSession, attemptMatch } from '@geoclick/quiz-engine';
import { forgetRound, rememberRound, roundInProgress } from './quizRound';

const targets = [
	{ id: 'lazio', name: 'Lazio' },
	{ id: 'sicilia', name: 'Sicilia' }
];

describe('a round in progress', () => {
	it('has nothing to give back for a map that was never played', () => {
		expect(roundInProgress('never-played')).toBeUndefined();
	});

	it('gives back the round and the names the tray was offering', () => {
		const session = attemptMatch(createQuizSession(targets), 'lazio', 'lazio');
		rememberRound('italy-regions', { session, hand: ['sicilia'] });

		const resumed = roundInProgress('italy-regions')!;
		expect(resumed.session.items.find((i) => i.target.id === 'lazio')!.status).toBe('correct');
		expect(resumed.hand).toEqual(['sicilia']);
	});

	it('keeps one round per map', () => {
		rememberRound('italy-regions', { session: createQuizSession(targets), hand: ['lazio'] });
		rememberRound('germany-states', { session: createQuizSession(targets), hand: ['sicilia'] });
		expect(roundInProgress('italy-regions')!.hand).toEqual(['lazio']);
		expect(roundInProgress('germany-states')!.hand).toEqual(['sicilia']);
	});

	it('hands out a copy, so a resumed round is not edited from under it', () => {
		rememberRound('italy-regions', { session: createQuizSession(targets), hand: ['lazio'] });
		roundInProgress('italy-regions')!.hand.push('sicilia');
		expect(roundInProgress('italy-regions')!.hand).toEqual(['lazio']);
	});

	it('forgets a round once it is over', () => {
		rememberRound('italy-regions', { session: createQuizSession(targets), hand: [] });
		forgetRound('italy-regions');
		expect(roundInProgress('italy-regions')).toBeUndefined();
	});
});
