<script lang="ts">
import { createEventDispatcher, getContext, onMount } from 'svelte';
import { storeContext } from '../../contexts';
import type { Info, ProxyAgent } from './types';
import '@holochain-open-dev/file-storage/dist/elements/upload-files.js';
import type { UploadFiles } from '@holochain-open-dev/file-storage/dist/elements/upload-files.js';
import type { FarmHackStore } from '../../stores/farmhack-store';
import { encodeHashToBase64, type EntryHash } from '@holochain/client';

let store: FarmHackStore = (getContext(storeContext) as any).getStore();

const dispatch = createEventDispatcher();
export let proxyAgent: Info<ProxyAgent> | undefined = undefined;

let nickname: string = '';
let bio: string = '';
let location: string = '';
let pic: EntryHash | undefined = undefined;
let uploadFiles: UploadFiles;
let dialog: HTMLDialogElement;
let error: string = '';

$: nickname, bio, location;
$: isProxyAgentValid = nickname !== "";

onMount(() => {
});

export const open = (pagent: Info<ProxyAgent> | undefined) => {
    proxyAgent = pagent;
    error = '';

    if (proxyAgent) {
        nickname = proxyAgent.record.entry.nickname;
        bio = proxyAgent.record.entry.bio;
        location = proxyAgent.record.entry.location;
        pic = proxyAgent.record.entry.pic;
        if (uploadFiles) {
            uploadFiles.defaultValue = pic ? encodeHashToBase64(pic) : undefined;
            uploadFiles.reset();
        }
    } else {
        nickname = "";
        bio = "";
        location = "";
        pic = undefined;
        if (uploadFiles) {
            uploadFiles.defaultValue = undefined;
            uploadFiles.reset();
        }
    }
    dialog.showModal();
}

async function updateProxyAgent() {
    if (proxyAgent) {
        try {
            await store.updateProxyAgent(proxyAgent.original_hash, nickname, bio, location, pic);
            dispatch('proxyagent-updated', { actionHash: proxyAgent.original_hash });
            dialog.close();
        } catch (e) {
            console.log("UPDATE PROXYAGENT ERROR", e);
            error = `Error updating the proxy agent: ${e}`;
        }
    }
}

async function createProxyAgent() {
    try {
        const actionHash = await store.createProxyAgent(nickname, bio, location, pic);
        await store.fetchProxyAgents();
        dispatch('proxyagent-created', { actionHash });
        dialog.close();
    } catch (e) {
        console.log("CREATE PROXYAGENT ERROR", e);
        error = `Error creating the proxy agent: ${e}`;
    }
}
</script>

<dialog bind:this={dialog}>
    <div class="dialog-content">
        <h2>{proxyAgent ? "Edit Proxy Agent" : "Create Proxy Agent"}</h2>

        {#if error}
            <div class="error">{error}</div>
        {/if}

        <div class="form-field">
            <label for="nickname">Nickname</label>
            <input
                id="nickname"
                type="text"
                value={nickname}
                on:input={e => { nickname = e.target.value; }}
            />
        </div>

        <div class="form-field">
            <label for="bio">Bio</label>
            <textarea
                id="bio"
                value={bio}
                on:input={e => { bio = e.target.value; }}
            ></textarea>
        </div>

        <div class="form-field">
            <label for="location">Location</label>
            <textarea
                id="location"
                value={location}
                on:input={e => { location = e.target.value; }}
            ></textarea>
        </div>

        <div class="form-field">
            <label>Picture (optional)</label>
            <upload-files
                bind:this={uploadFiles}
                one-file
                accepted-files="image/jpeg,image/png,image/gif"
                on:file-uploaded={(e) => {
                    pic = e.detail.file.hash;
                }}
            ></upload-files>
        </div>

        <div class="dialog-actions">
            <button on:click={() => dialog.close()}>Cancel</button>
            {#if proxyAgent}
                <button
                    on:click={() => updateProxyAgent()}
                    disabled={!isProxyAgentValid}
                    class="primary"
                >Save</button>
            {:else}
                <button
                    on:click={() => createProxyAgent()}
                    disabled={!isProxyAgentValid}
                    class="primary"
                >Create</button>
            {/if}
        </div>
    </div>
</dialog>

<style>
    dialog {
        border: none;
        border-radius: 8px;
        padding: 0;
        max-width: 500px;
        width: 90%;
    }

    dialog::backdrop {
        background: rgba(0, 0, 0, 0.5);
    }

    .dialog-content {
        padding: 24px;
    }

    h2 {
        margin: 0 0 16px 0;
    }

    .form-field {
        margin-bottom: 16px;
    }

    .form-field label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
    }

    .form-field input,
    .form-field textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
    }

    .form-field textarea {
        min-height: 80px;
        resize: vertical;
    }

    .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 24px;
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

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .error {
        background: #fee;
        color: #c00;
        padding: 8px;
        border-radius: 4px;
        margin-bottom: 16px;
    }
</style>
