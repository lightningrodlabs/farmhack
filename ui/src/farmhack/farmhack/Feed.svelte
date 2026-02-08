<script lang="ts">
  import { onMount } from "svelte";
  import { getStoreContext } from "../../contexts";
  import FeedElemDetail from "./FeedElemDetail.svelte";

  const store = getStoreContext();

  $: fullFeed = store.feed;
  $: feed = $fullFeed.slice().sort((a, b) => b.timestamp - a.timestamp);

  onMount(async () => {
    await store.fetchFeed({ count: 50 });
  });
</script>

<div class="feed">
  {#if feed.length === 0}
    <p class="empty">No activity yet.</p>
  {:else}
    {#each feed as f (f.hash)}
      <div class="feed-item">
        <FeedElemDetail feedElem={f} />
      </div>
    {/each}
  {/if}
</div>

<style>
  .feed {
    padding: 8px;
  }
  .feed-item {
    margin-bottom: 8px;
    border: 1px solid #eee;
    border-radius: 6px;
    overflow: hidden;
  }
  .empty {
    text-align: center;
    padding: 40px;
    opacity: 0.5;
  }
</style>
