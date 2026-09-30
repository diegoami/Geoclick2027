<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getLanguage } from './i18n.svelte';
	import { seaChartPatternDataUrl } from './seaChartPattern';

	let { children }: { children: Snippet } = $props();
	let pattern = $derived(seaChartPatternDataUrl(getLanguage()));
</script>

<div class="chart-map-shell" style={`--chart-pattern: url("${pattern}")`}>
	{@render children()}
</div>

<style>
	.chart-map-shell {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background-color: #f2eddf;
		background-image:
			linear-gradient(rgba(242, 237, 223, 0.72), rgba(242, 237, 223, 0.72)), var(--chart-pattern);
		background-size:
			auto,
			16rem 16rem;
		background-repeat: no-repeat, repeat;
	}
	.chart-map-shell :global(.container),
	.chart-map-shell :global(.map) {
		position: absolute;
		inset: 0.5rem;
		width: auto;
		height: auto;
		overflow: hidden;
		border-radius: 0.3rem;
		box-shadow: 0 1px 5px rgba(45, 53, 44, 0.2);
	}
</style>
