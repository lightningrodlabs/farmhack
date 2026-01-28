<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { getStoreContext } from "../../contexts";
  import { ToolStatuses, type Tool, type Info } from "./types";
  import type { ActionHash } from "@holochain/client";

  export let tool: Info<Tool> | undefined = undefined;

  const store = getStoreContext();
  const dispatch = createEventDispatcher();

  let title = tool?.record.entry.title || "";
  let description = tool?.record.entry.description || "";
  let status = tool?.record.entry.status || "Concept";
  let tagsStr = tool?.record.entry.tags.join(", ") || "";
  let saving = false;

  async function handleSave() {
    if (!title.trim()) return;
    saving = true;
    try {
      const tags = tagsStr.split(",").map(t => t.trim()).filter(t => t);
      const toolData: Tool = {
        title: title.trim(),
        description: description.trim(),
        status,
        tags,
        pic: tool?.record.entry.pic,
        trashed: false,
      };

      if (tool) {
        await store.updateTool(tool.original_hash, tool.record.actionHash, toolData);
      } else {
        await store.createTool(toolData);
      }
      dispatch("save");
    } catch (e) {
      console.error("Error saving tool:", e);
    }
    saving = false;
  }
</script>

<div class="modal-overlay">
  <div class="modal-content">
    <h3>{tool ? "Edit Tool" : "New Tool"}</h3>

    <label>
      Title
      <input type="text" bind:value={title} placeholder="Tool name" />
    </label>

    <label>
      Status
      <select bind:value={status}>
        {#each ToolStatuses as s}
          <option value={s}>{s}</option>
        {/each}
      </select>
    </label>

    <label>
      Description
      <textarea bind:value={description} rows="5" placeholder="Describe this tool..."></textarea>
    </label>

    <label>
      Tags (comma-separated)
      <input type="text" bind:value={tagsStr} placeholder="e.g. irrigation, arduino, sensors" />
    </label>

    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
      <button on:click={() => dispatch("cancel")} disabled={saving}>Cancel</button>
      <button class="primary" on:click={handleSave} disabled={saving || !title.trim()}>
        {saving ? "Saving..." : (tool ? "Update" : "Create")}
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
    z-index: 1000;
  }
  .modal-content {
    background: white;
    padding: 24px;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow: auto;
  }
  h3 { margin: 0 0 16px 0; }
  label {
    display: flex;
    flex-direction: column;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 500;
  }
  input, textarea, select {
    margin-top: 4px;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  textarea { resize: vertical; }
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
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
