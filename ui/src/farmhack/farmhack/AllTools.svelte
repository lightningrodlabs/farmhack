<script lang="ts">
  import { getStoreContext } from "../../contexts";
  import ToolSummary from "./ToolSummary.svelte";

  const store = getStoreContext();
  const toolsStore = store.tools;
  $: tools = $toolsStore.filter(t => !t.record.entry.trashed);
</script>

<div class="tools-list">
  {#each tools as tool (tool.original_hash)}
    <ToolSummary {tool} />
  {:else}
    <div style="text-align: center; padding: 40px; opacity: 0.5;">
      No tools yet. Create one to get started.
    </div>
  {/each}
</div>

<style>
  .tools-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 10px;
  }
</style>
