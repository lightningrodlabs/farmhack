<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { getStoreContext } from "../../contexts";
  import { toolTags } from "./types";
  import ToolSummary from "./ToolSummary.svelte";

  const dispatch = createEventDispatcher();

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

  $: totalTools = $toolsStore.filter(t => !t.record.entry.trashed).length;
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

<div class="tools-layout">
  <aside class="tools-sidebar">
    <button class="new-tool-btn" on:click={() => dispatch('create-tool')}>+ New Tool</button>
    <div class="search-box">
      <input
        type="text"
        placeholder="Search {totalTools} tools..."
        bind:value={searchQuery}
        class="search-input"
      />
      {#if searchQuery || selectedTag}
        <button class="clear-btn" on:click={clearFilters}>Clear</button>
      {/if}
    </div>
    {#if allTags.length > 0}
      <div class="sidebar-heading">Tags</div>
      <div class="tag-list">
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
  </aside>

  <div class="tools-main">
    {#each visibleTools as tool (tool.original_hash)}
      <ToolSummary {tool} />
    {:else}
      <div class="empty">
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
</div>

<style>
  .tools-layout {
    display: flex;
    gap: 16px;
    padding: 0 10px;
    width: 100%;
  }
  .tools-sidebar {
    width: 180px;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    align-self: flex-start;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
  }
  .tools-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .search-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }
  .search-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
  }
  .search-input:focus {
    border-color: #4CAF50;
  }
  .clear-btn {
    padding: 4px 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 12px;
  }
  .clear-btn:hover {
    background: #f0f0f0;
  }
  .new-tool-btn {
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: var(--primary-color, #4a7c59);
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    margin-bottom: 8px;
  }
  .new-tool-btn:hover {
    opacity: 0.9;
  }
  .sidebar-heading {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }
  .tag-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tag-filter {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    color: var(--muted-text-color);
  }
  .tag-filter:hover {
    background: #f0f0f0;
  }
  .tag-filter.active {
    background: #4CAF50;
    color: white;
  }
  .empty {
    text-align: center;
    padding: 40px;
    opacity: 0.5;
  }
  .sentinel {
    height: 1px;
  }

  @media (max-width: 600px) {
    .tools-layout {
      flex-direction: column;
    }
    .tools-sidebar {
      width: 100%;
      position: static;
      max-height: none;
    }
    .tag-list {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 4px;
    }
    .tag-filter {
      padding: 2px 8px;
      border: 1px solid #ddd;
      border-radius: 12px;
    }
  }
</style>
