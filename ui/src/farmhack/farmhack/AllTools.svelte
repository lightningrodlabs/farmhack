<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getStoreContext } from "../../contexts";
  import { toolTags } from "./types";
  import ToolSummary from "./ToolSummary.svelte";

  const store = getStoreContext();
  const toolsStore = store.tools;

  let searchQuery = "";
  let selectedTag = "";
  let visibleCount = 20;
  let sentinel: HTMLElement;
  let observer: IntersectionObserver;

  // Collect all unique tags across all tools, sorted by frequency
  $: allTags = (() => {
    const tagCounts: Record<string, number> = {};
    for (const t of $toolsStore) {
      if (t.record.entry.trashed) continue;
      for (const tag of toolTags(t)) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  })();

  $: tools = $toolsStore.filter(t => {
    if (t.record.entry.trashed) return false;
    const entry = t.record.entry;
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = entry.title.toLowerCase().includes(q);
      const matchesDesc = entry.description.toLowerCase().includes(q);
      if (!matchesTitle && !matchesDesc) return false;
    }
    // Tag filter
    if (selectedTag) {
      const tags = toolTags(t);
      if (!tags.includes(selectedTag)) return false;
    }
    return true;
  });

  $: visibleTools = tools.slice(0, visibleCount);
  $: hasMore = visibleCount < tools.length;

  // Reset visible count when filters change
  $: searchQuery, selectedTag, visibleCount = 20;

  onMount(() => {
    observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        visibleCount += 20;
      }
    }, { rootMargin: "200px" });
    if (sentinel) observer.observe(sentinel);
  });

  onDestroy(() => {
    if (observer) observer.disconnect();
  });

  // Re-observe sentinel when it remounts
  function bindSentinel(el: HTMLElement) {
    sentinel = el;
    if (observer && sentinel) observer.observe(sentinel);
  }

  function clearFilters() {
    searchQuery = "";
    selectedTag = "";
  }
</script>

<div class="tools-filter-bar">
  <div class="search-row">
    <input
      type="text"
      placeholder="Search tools..."
      bind:value={searchQuery}
      class="search-input"
    />
    {#if searchQuery || selectedTag}
      <button class="clear-btn" on:click={clearFilters}>Clear</button>
    {/if}
  </div>
  {#if allTags.length > 0}
    <div class="tag-bar">
      {#each allTags as tag}
        <button
          class="tag-filter"
          class:active={selectedTag === tag}
          on:click={() => selectedTag = selectedTag === tag ? "" : tag}
        >
          {tag}
        </button>
      {/each}
    </div>
  {/if}
</div>

<div class="tools-list">
  {#each visibleTools as tool (tool.original_hash)}
    <ToolSummary {tool} />
  {:else}
    <div style="text-align: center; padding: 40px; opacity: 0.5;">
      {#if searchQuery || selectedTag}
        No tools match your filters.
      {:else}
        No tools yet. Create one to get started.
      {/if}
    </div>
  {/each}
  {#if hasMore}
    <div use:bindSentinel class="sentinel"></div>
  {/if}
</div>

<style>
  .tools-filter-bar {
    padding: 0 10px 8px 10px;
    position: sticky;
    top: 0;
    background: white;
    z-index: 5;
  }
  .search-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .search-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
  }
  .search-input:focus {
    border-color: #4CAF50;
  }
  .clear-btn {
    padding: 4px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
  }
  .clear-btn:hover {
    background: #f0f0f0;
  }
  .tag-bar {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    max-height: 68px;
    overflow-y: auto;
  }
  .tag-filter {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 12px;
    border: 1px solid #ddd;
    background: white;
    cursor: pointer;
    white-space: nowrap;
  }
  .tag-filter:hover {
    background: #f0f0f0;
  }
  .tag-filter.active {
    background: #4CAF50;
    color: white;
    border-color: #4CAF50;
  }
  .tools-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 10px;
  }
  .sentinel {
    height: 1px;
  }
</style>
