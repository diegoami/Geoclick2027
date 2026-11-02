<script lang="ts">
	import { t, type TranslationKey } from './i18n.svelte';
	import { mapDisplayName } from './mapCatalog';
	import type { BrowserAccountState } from './browserAccountSession';
	let {
		model,
		onSignIn,
		onSignOut,
		onSync,
		onPreview,
		onConfirm,
		onDismiss
	}: {
		model: BrowserAccountState;
		onSignIn: (remember: boolean) => unknown;
		onSignOut: () => unknown;
		onSync: () => unknown;
		onPreview: () => unknown;
		onConfirm: () => unknown;
		onDismiss: () => unknown;
	} = $props();
	let remember = $state(false);
	const preview = $derived(model.preview);
	const counts = $derived({
		add: preview?.rows.filter((row) => row.disposition === 'add').length ?? 0,
		keep: preview?.rows.filter((row) => row.disposition === 'account-wins').length ?? 0,
		unsupported: preview?.rows.filter((row) => row.disposition === 'unsupported').length ?? 0
	});
	const maps = $derived([...new Set(preview?.rows.map((row) => row.mapId) ?? [])]);
</script>

<fieldset class="account">
	<legend>{t('account.title')}</legend>
	{#if model.identity}
		<p>{t('account.identity', { name: model.identity.label || t('account.title') })}</p>
		<button type="button" onclick={() => onSignOut()}>{t('account.signout')}</button>
	{:else}
		<p>{t('account.guest')}</p>
		<label
			><input type="checkbox" bind:checked={remember} disabled={model.busy} />{t(
				'account.remember'
			)}</label
		>
		<button type="button" disabled={model.busy} onclick={() => onSignIn(remember)}
			>{t('account.signin')}</button
		>
	{/if}
	{#if model.usingAccount}
		<p role="status">{t(`account.sync.${model.sync}` as TranslationKey)}</p>
		<button type="button" disabled={model.sync === 'syncing' || model.busy} onclick={() => onSync()}
			>{t('account.retry')}</button
		>
		<p>{t('account.importHint')}</p>
		<button type="button" disabled={model.busy} onclick={() => onPreview()}
			>{t('account.review')}</button
		>
	{:else if model.identity}
		<button type="button" disabled={model.busy} onclick={() => onSync()}
			>{t('account.retry')}</button
		>
	{/if}
	{#if model.error}<p role="alert">{t(`account.error.${model.error}` as TranslationKey)}</p>{/if}
	{#if preview}
		<section aria-labelledby="account-import-preview">
			<h3 id="account-import-preview">{t('account.preview')}</h3>
			<p>{t('account.counts', counts)}</p>
			<ul>
				{#each maps as mapId (mapId)}<li>
						{mapDisplayName(mapId) ?? mapId} · {t('account.counts', {
							add: preview.rows.filter((row) => row.mapId === mapId && row.disposition === 'add')
								.length,
							keep: preview.rows.filter(
								(row) => row.mapId === mapId && row.disposition === 'account-wins'
							).length,
							unsupported: preview.rows.filter(
								(row) => row.mapId === mapId && row.disposition === 'unsupported'
							).length
						})}
					</li>{/each}
			</ul>
			<div class="actions">
				<button type="button" disabled={model.busy || counts.add === 0} onclick={() => onConfirm()}
					>{t('account.confirm')}</button
				>
				<button type="button" disabled={model.busy} onclick={() => onDismiss()}
					>{t('account.dismiss')}</button
				>
			</div>
		</section>
	{/if}
	{#if model.imported !== undefined}<p role="status">
			{t('account.imported', { count: model.imported })}
		</p>{/if}
</fieldset>

<style>
	.account {
		min-width: 0;
		margin-top: 1rem;
		border: 1px solid var(--gc-border, #c9d3cc);
		border-radius: 8px;
		padding: 0.75rem;
		overflow-wrap: anywhere;
	}
	legend {
		font-weight: 600;
	}
	p {
		line-height: 1.4;
	}
	label {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin: 0.5rem 0;
	}
	input {
		margin-top: 0.25rem;
		flex-shrink: 0;
	}
	button {
		font: inherit;
		max-width: 100%;
		min-height: 44px;
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--gc-border, #c9d3cc);
		border-radius: 8px;
		background: var(--gc-surface, white);
		color: var(--gc-text, #1c2b22);
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	ul {
		padding-inline-start: 1.25rem;
	}
	li {
		margin: 0.5rem 0;
	}
</style>
