<script lang="ts">
  import { onMount } from "svelte";
  import { getStoreContext } from "../../contexts";
  import type { RelationInfo } from "./types";

  const store = getStoreContext();
  let feedItems: Array<RelationInfo> = [];
  let loading = true;

  onMount(async () => {
    try {
      feedItems = await store.client.getFeed({ count: 50 });
    } catch (e) {
      console.error("Error loading feed:", e);
    }
    loading = false;
  });
</script>

<div style="padding: 0 10px;">
  {#if loading}
    <p style="text-align: center; padding: 20px; opacity: 0.5;">Loading feed...</p>
  {:else if feedItems.length === 0}
    <p style="text-align: center; padding: 40px; opacity: 0.5;">No activity yet.</p>
  {:else}
    {#each feedItems as item}
      <div style="padding: 10px; border-bottom: 1px solid #f0f0f0;">
        <div style="font-size: 12px; opacity: 0.5;">
          {new Date(item.timestamp).toLocaleString()}
        </div>
        <div style="font-size: 13px;">
          {item.relation.content.path.replace("feed.", "")}
          {#if item.relation.content.data}
            - {item.relation.content.data}
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>
