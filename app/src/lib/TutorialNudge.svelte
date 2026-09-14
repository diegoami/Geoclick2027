<script lang="ts">
	// "New here?" on the home page (FT-12): offers the tutorial until it's been
	// started once or dismissed. Rendered only after mount by the home page,
	// which is prerendered without device storage.
	import { t } from './i18n.svelte';
	import { dispatch } from './tutorial.svelte';
	import { markTutorialSeen } from './tutorialSeen.svelte';
</script>

<aside class="nudge" aria-label={t('tutorial.button')}>
	<svg class="nudge-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"
		><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2" /><path
			d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.8v.4"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		/><circle cx="12" cy="17.3" r="1.2" fill="currentColor" /></svg
	>
	<p>{t('home.nudge.text')}</p>
	<div class="nudge-actions">
		<button type="button" class="secondary" onclick={markTutorialSeen}
			>{t('home.nudge.dismiss')}</button
		>
		<button type="button" class="primary" onclick={() => dispatch({ type: 'start' })}
			>{t('home.nudge.start')}</button
		>
	</div>
</aside>

<style>
	.nudge {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem 0.8rem;
		margin: 0 0 1.5rem;
		padding: 0.75rem 1rem;
		text-align: left;
		background: #fbf4ec;
		border: 1px solid rgba(181, 105, 31, 0.35);
		border-radius: 0.9rem;
	}
	.nudge-icon {
		flex: none;
		color: #b5691f;
	}
	.nudge p {
		flex: 1 1 12rem;
		margin: 0;
		font-size: 0.95rem;
		color: #1e2824;
	}
	.nudge-actions {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
	}
	button {
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		padding: 0.4rem 0.85rem;
		border-radius: 999px;
		cursor: pointer;
		white-space: nowrap;
	}
	.primary {
		background: #b5691f;
		border: 1px solid #b5691f;
		color: #ffffff;
	}
	.secondary {
		background: #ffffff;
		border: 1px solid rgba(30, 40, 36, 0.25);
		color: #4a5650;
	}
	button:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: 2px;
	}
</style>
