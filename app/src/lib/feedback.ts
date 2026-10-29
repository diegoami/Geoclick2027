// A short answer to every drop (#268): a light tap of the phone on Android,
// and, when the player has switched sound on, a quiet tone. Right and wrong
// feel different, so the result is noticed even with a finger over the map.
//
// The tones are made with Web Audio rather than played from files: two notes
// need no assets, no licence and no download. Every failure is swallowed -
// feedback is a nicety, and a missing AudioContext or plugin must never
// break the quiz.

import { soundOn } from './mapPrefs.svelte';

/** One note of a tone: pitch in Hz, start and length in seconds. */
export interface Note {
	hz: number;
	at: number;
	length: number;
}

/** Right: two quick rising notes. Wrong: one low, slightly longer note. */
export function tone(correct: boolean): Note[] {
	return correct
		? [
				{ hz: 660, at: 0, length: 0.09 },
				{ hz: 880, at: 0.08, length: 0.12 }
			]
		: [{ hz: 196, at: 0, length: 0.2 }];
}

/** Haptics only in the Android app, and not for a player who asked the
 * system to reduce motion. */
export function shouldVibrate(native: boolean, reducedMotion: boolean): boolean {
	return native && !reducedMotion;
}

/** Quiet: feedback, not a fanfare. */
const VOLUME = 0.05;

let audio: AudioContext | undefined;

function play(notes: Note[], correct: boolean) {
	audio ??= new AudioContext();
	const now = audio.currentTime;
	for (const note of notes) {
		const osc = audio.createOscillator();
		const gain = audio.createGain();
		osc.type = correct ? 'sine' : 'triangle';
		osc.frequency.value = note.hz;
		// A short fade in and out, or each note starts and ends with a click.
		gain.gain.setValueAtTime(0, now + note.at);
		gain.gain.linearRampToValueAtTime(VOLUME, now + note.at + 0.01);
		gain.gain.linearRampToValueAtTime(0, now + note.at + note.length);
		osc.connect(gain).connect(audio.destination);
		osc.start(now + note.at);
		osc.stop(now + note.at + note.length + 0.02);
	}
}

async function vibrate(correct: boolean) {
	const { Capacitor } = await import('@capacitor/core');
	const reduced =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (!shouldVibrate(Capacitor.isNativePlatform(), reduced)) return;
	const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
	if (correct) await Haptics.impact({ style: ImpactStyle.Light });
	else await Haptics.notification({ type: NotificationType.Error });
}

/** Called once for every scored answer. */
export function answerFeedback(correct: boolean): void {
	if (soundOn()) {
		try {
			play(tone(correct), correct);
		} catch (e) {
			console.warn('Could not play the answer sound:', e);
		}
	}
	vibrate(correct).catch((e) => console.warn('Could not vibrate:', e));
}
