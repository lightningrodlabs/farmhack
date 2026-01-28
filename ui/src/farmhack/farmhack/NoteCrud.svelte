<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { getStoreContext } from "../../contexts";
  import type { ActionHash } from "@holochain/client";
  import type { Note } from "./types";

  export let toolHash: ActionHash;

  const store = getStoreContext();
  const dispatch = createEventDispatcher();

  let text = "";
  let saving = false;

  async function handleSave() {
    if (!text.trim()) return;
    saving = true;
    try {
      const note: Note = {
        text: text.trim(),
        tool: toolHash,
        tags: [],
        trashed: false,
      };
      const hash = await store.createNote(note);
      dispatch("save", hash);
    } catch (e) {
      console.error("Error creating comment:", e);
    }
    saving = false;
  }
</script>

<div class="modal-overlay">
  <div class="modal-content">
    <h3>Add Comment</h3>

    <label>
      <textarea bind:value={text} rows="4" placeholder="Write your comment..."></textarea>
    </label>

    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px;">
      <button on:click={() => dispatch("cancel")} disabled={saving}>Cancel</button>
      <button class="primary" on:click={handleSave} disabled={saving || !text.trim()}>
        {saving ? "Saving..." : "Post Comment"}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1001;
  }
  .modal-content {
    background: white;
    padding: 24px;
    border-radius: 8px;
    width: 90%;
    max-width: 400px;
  }
  h3 { margin: 0 0 12px 0; }
  label { display: flex; flex-direction: column; }
  textarea {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: vertical;
  }
  button {
    padding: 8px 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  }
  button.primary {
    background: #4CAF50;
    color: white;
    border-color: #4CAF50;
  }
  button:disabled { opacity: 0.5; cursor: default; }
</style>
