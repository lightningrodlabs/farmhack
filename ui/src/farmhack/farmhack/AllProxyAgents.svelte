<script lang="ts">
import { onMount, getContext, createEventDispatcher } from 'svelte';
import { storeContext } from '../../contexts';
import ProxyAgentSummary from './ProxyAgentSummary.svelte';
import type { FarmHackStore } from '../../stores/farmhack-store';
import ProxyAgentCrud from './ProxyAgentCrud.svelte';

const dispatch = createEventDispatcher();

let store: FarmHackStore = (getContext(storeContext) as any).getStore();
let error: any = undefined;
let createProxyAgentDialog: ProxyAgentCrud;

$: proxyAgents = store.proxyAgents;
$: error;

onMount(async () => {
    await store.fetchProxyAgents();
});
</script>

<ProxyAgentCrud
    bind:this={createProxyAgentDialog}
    on:proxyagent-created={() => store.fetchProxyAgents()}
></ProxyAgentCrud>

<div class="pane-header">
    <div class="header-content">
        <h3>Proxy Agents</h3>
        <div class="section-controls">
            <button on:click={() => dispatch('proxyagents-close')}>
                Back
            </button>
            <button class="primary" on:click={() => createProxyAgentDialog.open(undefined)}>
                + Create
            </button>
        </div>
    </div>
</div>

<div class="pane-content">
    {#if error}
        <span class="error">Error fetching proxy agents: {error}</span>
    {:else if $proxyAgents.length === 0}
        <div class="notice">No Proxy Agents Found. Create one to represent contributors who don't use the app directly.</div>
    {:else}
        <div class="proxy-agents-list">
            {#each $proxyAgents as proxyAgent}
                <ProxyAgentSummary
                    {proxyAgent}
                    on:proxyagent-deleted={() => store.fetchProxyAgents()}
                ></ProxyAgentSummary>
            {/each}
        </div>
    {/if}
</div>

<style>
    .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
    }

    .section-controls {
        display: flex;
        gap: 8px;
    }

    .proxy-agents-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .notice {
        text-align: center;
        padding: 32px;
        color: #666;
    }

    .error {
        color: #c00;
        padding: 16px;
    }

    button {
        padding: 8px 16px;
        border-radius: 4px;
        border: 1px solid #ccc;
        background: white;
        cursor: pointer;
    }

    button:hover {
        background: #f0f0f0;
    }

    button.primary {
        background: var(--primary-color, #007bff);
        color: white;
        border-color: var(--primary-color, #007bff);
    }

    button.primary:hover {
        opacity: 0.9;
    }
</style>
