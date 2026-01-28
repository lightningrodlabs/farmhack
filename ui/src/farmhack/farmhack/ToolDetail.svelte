<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { getStoreContext } from "../../contexts";
  import type { ActionHash } from "@holochain/client";
  import { encodeHashToBase64 } from "@holochain/client";
  import { toolNotes, toolTags, type Info, type Tool, type Note } from "./types";
  import ShowFile from "./ShowFile.svelte";
  import NoteCrud from "./NoteCrud.svelte";

  export let toolHash: ActionHash;

  const store = getStoreContext();
  const dispatch = createEventDispatcher();

  let showNoteCreate = false;
  let notes: Array<Info<Note>> = [];

  $: tool = store.getTool(toolHash);
  $: entry = tool?.record.entry;
  $: tags = tool ? toolTags(tool) : [];
  $: noteHashes = tool ? toolNotes(tool) : [];

  onMount(async () => {
    if (noteHashes.length > 0) {
      await store.fetchNote(noteHashes);
    }
  });

  const notesStore = store.notes;
  $: {
    const notesMap = $notesStore;
    notes = noteHashes.map(h => notesMap.get(encodeHashToBase64(h))).filter(n => n && !n.record.entry.trashed) as Array<Info<Note>>;
  }

  async function handleNoteCreated(event: CustomEvent) {
    const noteHash = event.detail;
    await store.createRelations([{
      src: toolHash,
      dst: noteHash,
      content: { path: "tool.note", data: "" },
    }]);
    await store.fetchTools();
    await store.fetchNote([noteHash]);
    showNoteCreate = false;
  }
</script>

<div class="tool-details">
  <div style="padding: 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee;">
    <button on:click={() => dispatch('close')} style="border: none; background: none; cursor: pointer; font-size: 18px;">
      &larr; Back
    </button>
    <h3 style="margin: 0;">{entry?.title || "Tool"}</h3>
    <div></div>
  </div>

  {#if entry}
    <div style="padding: 16px; overflow: auto; flex: 1;">
      {#if entry.pic}
        <div style="max-width: 400px; margin: 0 auto 16px auto;">
          <ShowFile fileHash={entry.pic} />
        </div>
      {/if}

      <div style="margin-bottom: 12px;">
        <span class="status-badge">{entry.status}</span>
      </div>

      <div style="margin-bottom: 16px;">
        <p style="white-space: pre-wrap;">{entry.description}</p>
      </div>

      {#if tags.length > 0}
        <div style="margin-bottom: 16px;">
          <strong>Tags:</strong>
          <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
            {#each tags as tag}
              <span class="tag">{tag}</span>
            {/each}
          </div>
        </div>
      {/if}

      <div style="border-top: 1px solid #eee; padding-top: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <strong>Comments ({notes.length})</strong>
          <button on:click={() => showNoteCreate = true} style="border: 1px solid #ddd; background: white; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
            + Add Comment
          </button>
        </div>

        {#each notes as note}
          <div style="background: #f9f9f9; padding: 10px; border-radius: 6px; margin-bottom: 8px;">
            <p style="white-space: pre-wrap;">{note.record.entry.text}</p>
            {#if note.record.entry.pic}
              <div style="max-width: 200px; margin-top: 8px;">
                <ShowFile fileHash={note.record.entry.pic} />
              </div>
            {/if}
          </div>
        {:else}
          <p style="opacity: 0.5;">No comments yet.</p>
        {/each}
      </div>
    </div>
  {:else}
    <p style="padding: 16px;">Tool not found.</p>
  {/if}

  {#if showNoteCreate}
    <NoteCrud {toolHash} on:save={handleNoteCreated} on:cancel={() => showNoteCreate = false} />
  {/if}
</div>

<style>
  .status-badge {
    font-size: 12px;
    background: #e8f5e9;
    color: #2e7d32;
    padding: 3px 10px;
    border-radius: 12px;
  }
  .tag {
    font-size: 12px;
    background: #f0f0f0;
    padding: 2px 8px;
    border-radius: 4px;
  }
</style>
