<script lang="ts">
import { createEventDispatcher, getContext } from 'svelte';
import "@holochain-open-dev/file-storage/dist/elements/show-image.js";
import { storeContext } from '../../contexts';
import type { Info, ProxyAgent } from './types';
import type { FarmHackStore } from '../../stores/farmhack-store';
import ProxyAgentAvatar from "./ProxyAgentAvatar.svelte";
import ProxyAgentCrud from './ProxyAgentCrud.svelte';
import { encodeHashToBase64 } from '@holochain/client';

const dispatch = createEventDispatcher();

export let proxyAgent: Info<ProxyAgent>;

let store: FarmHackStore = (getContext(storeContext) as any).getStore();
let editDialog: ProxyAgentCrud;
let showConfirmDelete = false;

async function deleteProxyAgent() {
    try {
        await store.deleteProxyAgent(proxyAgent.original_hash);
        dispatch('proxyagent-deleted', { proxyAgentHash: proxyAgent.original_hash });
        showConfirmDelete = false;
    } catch (e: any) {
        console.error("Error deleting proxy agent:", e);
    }
}
</script>

<ProxyAgentCrud
    bind:this={editDialog}
    on:proxyagent-updated={() => store.fetchProxyAgents()}
></ProxyAgentCrud>

<div class="summary card">
    <div class="pic">
        <ProxyAgentAvatar size={48} proxyAgentHash={proxyAgent.original_hash}></ProxyAgentAvatar>
    </div>
    <div class="info">
        <h3>{proxyAgent.record.entry.nickname}</h3>
        {#if proxyAgent.record.entry.location}
            <div class="location">
                <strong>Location:</strong> {proxyAgent.record.entry.location}
            </div>
        {/if}
        {#if proxyAgent.record.entry.bio}
            <div class="bio">
                {proxyAgent.record.entry.bio}
            </div>
        {/if}
    </div>
    <div class="actions">
        <button on:click={() => editDialog.open(proxyAgent)}>Edit</button>
        <button class="danger" on:click={() => showConfirmDelete = true}>Delete</button>
    </div>
</div>

{#if showConfirmDelete}
    <div class="confirm-overlay">
        <div class="confirm-dialog">
            <p>Are you sure you want to delete this proxy agent?</p>
            <div class="confirm-actions">
                <button on:click={() => showConfirmDelete = false}>Cancel</button>
                <button class="danger" on:click={deleteProxyAgent}>Delete</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .summary {
        display: flex;
        align-items: center;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        gap: 12px;
    }

    .pic {
        flex-shrink: 0;
    }

    .info {
        flex: 1;
    }

    .info h3 {
        margin: 0 0 4px 0;
    }

    .location, .bio {
        font-size: 0.9em;
        color: #666;
    }

    .actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
    }

    button {
        padding: 6px 12px;
        border-radius: 4px;
        border: 1px solid #ccc;
        background: white;
        cursor: pointer;
        font-size: 0.9em;
    }

    button:hover {
        background: #f0f0f0;
    }

    button.danger {
        color: #c00;
        border-color: #c00;
    }

    button.danger:hover {
        background: #fee;
    }

    .confirm-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .confirm-dialog {
        background: white;
        padding: 24px;
        border-radius: 8px;
        max-width: 400px;
    }

    .confirm-dialog p {
        margin: 0 0 16px 0;
    }

    .confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }
</style>
