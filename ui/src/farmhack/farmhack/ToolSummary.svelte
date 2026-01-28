<script lang="ts">
  import { getStoreContext } from "../../contexts";
  import type { Info, Tool } from "./types";
  import { truncateText } from "./utils";
  import ShowFile from "./ShowFile.svelte";

  export let tool: Info<Tool>;
  const store = getStoreContext();

  $: entry = tool.record.entry;
</script>

<div class="card" on:click={() => store.openToolDetail(tool.original_hash)} on:keypress={() => {}}>
  {#if entry.pic}
    <div class="tool-pic">
      <ShowFile fileHash={entry.pic} />
    </div>
  {/if}
  <div class="tool-info" style="padding: 12px; flex: 1;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <h4 style="margin: 0; font-size: 16px;">{entry.title}</h4>
      <span class="status-badge">{entry.status}</span>
    </div>
    <p style="margin: 4px 0; opacity: 0.7; font-size: 13px;">{truncateText(entry.description, 120)}</p>
    {#if entry.tags.length > 0}
      <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px;">
        {#each entry.tags.slice(0, 5) as tag}
          <span class="tag">{tag}</span>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .card {
    cursor: pointer;
    transition: box-shadow 0.2s;
  }
  .card:hover {
    box-shadow: 0px 6px 16px rgba(0, 0, 0, 0.15);
  }
  .tool-pic {
    width: 100px;
    min-height: 80px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f0f0;
  }
  .status-badge {
    font-size: 11px;
    background: #e8f5e9;
    color: #2e7d32;
    padding: 2px 8px;
    border-radius: 12px;
    white-space: nowrap;
  }
  .tag {
    font-size: 11px;
    background: #f0f0f0;
    padding: 1px 6px;
    border-radius: 4px;
  }
</style>
