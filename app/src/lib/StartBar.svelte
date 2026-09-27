<script lang="ts">
	// The start screen's toolbar (FT-82, #91), after the owner's card games:
	// everything that sat above the map - the title, language, Tutorial,
	// Exit, the Map / List switch, Favourites and Recent, the download link -
	// in one bar of icons, so the map has the screen. Each icon's name is its
	// aria-label and title. My maps and About are pages of their own, as the
	// games' History and About are views, so Back and Escape need no code.
	import { resolve } from '$app/paths';
	import { t } from './i18n.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import { exitApp } from './platform';
	import TutorialButton from './TutorialButton.svelte';

	let {
		showMap,
		switchDisabled,
		onView,
		isApp,
		myMapsCount
	}: {
		showMap: boolean;
		switchDisabled: boolean;
		onView: (view: 'map' | 'list') => void;
		/** The Exit button is the apps' own: a web page cannot close its tab. */
		isApp: boolean;
		/** Favourites and Recent together, shown on the icon once there are any. */
		myMapsCount: number;
	} = $props();
</script>

<header class="gc-bar" aria-label={t('home.toolbar')}>
	<h1 class="gc-wordmark gc-narrow-hidden">Geoclick</h1>

	<!-- The map or the list (FT-78), kept on the device. -->
	<div class="gc-toggle" role="group" aria-label={t('home.viewLabel')}>
		<button
			type="button"
			class="gc-tool"
			aria-pressed={showMap}
			aria-label={t('home.viewMap')}
			title={t('home.viewMap')}
			disabled={switchDisabled}
			onclick={() => onView('map')}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z" /><path
					d="M9 4v13.5M15 6.5V20"
				/></svg
			>
		</button>
		<button
			type="button"
			class="gc-tool"
			aria-pressed={!showMap}
			aria-label={t('home.viewList')}
			title={t('home.viewList')}
			disabled={switchDisabled}
			onclick={() => onView('list')}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path d="M9 7h11M9 12h11M9 17h11" /><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" /></svg
			>
		</button>
	</div>

	<div class="gc-tools">
		<a
			class="gc-tool"
			href={resolve('/my-maps')}
			aria-label={myMapsCount > 0 ? `${t('home.myMaps')} (${myMapsCount})` : t('home.myMaps')}
			title={t('home.myMaps')}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path
					d="M12 3.6l2.55 5.2 5.75.84-4.16 4.05.98 5.72L12 16.72l-5.12 2.69.98-5.72L3.7 9.64l5.75-.84z"
				/></svg
			>
			{#if myMapsCount > 0}<span class="gc-count" aria-hidden="true">{myMapsCount}</span>{/if}
		</a>
		<LanguageSwitcher />
		<TutorialButton icon />
		<a
			class="gc-tool"
			href={resolve('/about')}
			aria-label={t('home.about')}
			title={t('home.about')}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><circle cx="12" cy="12" r="8.5" /><path d="M12 11.2v5.3" /><path d="M12 7.6v1" /></svg
			>
		</a>
		{#if isApp}
			<button
				type="button"
				class="gc-tool"
				aria-label={t('home.exit')}
				title={t('home.exit')}
				onclick={() => exitApp()}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"
					><path d="M10 4H5v16h5" /><path d="M14 8l4 4-4 4" /><path d="M18 12H9" /></svg
				>
			</button>
		{/if}
	</div>
</header>
