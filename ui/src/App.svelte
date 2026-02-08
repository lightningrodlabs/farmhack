<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { AppWebsocket } from "@holochain/client";
  import { CloneManagerStore } from "./stores/clone-manager-store";
  import { storeContext, cloneManagerStoreContext } from "./contexts";
  import { ROLE_NAME, DetailsType } from "./farmhack/farmhack/types";
  import AllTools from "./farmhack/farmhack/AllTools.svelte";
  import ToolDetail from "./farmhack/farmhack/ToolDetail.svelte";
  import ToolCrud from "./farmhack/farmhack/ToolCrud.svelte";
  import Feed from "./farmhack/farmhack/Feed.svelte";
  import Admin from "./farmhack/farmhack/Admin.svelte";
  import AllProxyAgents from "./farmhack/farmhack/AllProxyAgents.svelte";
  import AgentProfile from "./farmhack/farmhack/AgentProfile.svelte";
  import "@holochain-open-dev/file-storage/dist/elements/file-storage-context.js";

  let cloneManagerStore: CloneManagerStore | undefined;
  let loading = true;
  let connected = false;
  let error: string | undefined;
  let showCreateTool = false;

  $: store = cloneManagerStore?.activeStore;
  $: uiProps = $store ? $store.uiProps : undefined;
  $: pane = $store ? $uiProps.pane : "tools";
  $: topDetail = $store && $uiProps.detailsStack.length > 0 ? $uiProps.detailsStack[0] : undefined;

  onMount(async () => {
    try {
      const url = `ws://localhost:${import.meta.env.VITE_APP_PORT}`;
      const client = await AppWebsocket.connect(import.meta.env.VITE_APP_PORT ? url : undefined);

      cloneManagerStore = new CloneManagerStore(client);
      await cloneManagerStore.activeStore.load();
      connected = true;
    } catch (e) {
      console.error(e);
      error = `Failed to connect: ${e}`;
    }
  });

  setContext(storeContext, {
    getStore: () => $store,
  });

  setContext(cloneManagerStoreContext, {
    getStore: () => cloneManagerStore,
  });

  const loadStore = async () => {
    if (!$store) return;
    loading = true;
    await Promise.all([$store.fetchTools(), $store.fetchProxyAgents()]);
    loading = false;
  };

  $: $store, loadStore();

  function setPane(p: string) {
    if ($store) {
      $store.setUIprops({ pane: p, detailsStack: [] });
    }
  }

  function handleToolCreated() {
    showCreateTool = false;
  }
</script>

<div id="content">
  {#if connected}
    {#if error}
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; color: red;">
        <span>{error}</span>
      </div>
    {:else if loading}
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
        <span>Loading...</span>
      </div>
    {:else if $store}
      <file-storage-context client={$store.fileStorageClient}>
      <div class="pane">
        <div class="pane-header">
          <div class="header-content">
            <h3>FarmHack</h3>
            <div style="display: flex; gap: 8px; align-items: center;">
              {#if pane === "tools"}
                <button on:click={() => showCreateTool = true} style="border: none; background: var(--primary-color); color: white; padding: 4px 12px; border-radius: 4px; cursor: pointer;">
                  + New Tool
                </button>
              {/if}
            </div>
          </div>
        </div>

        <div class="pane-content">
          {#if pane === "tools"}
            <AllTools />
          {:else if pane === "feed"}
            <Feed />
          {:else if pane === "admin"}
            <Admin
              on:admin-close={() => setPane("tools")}
              on:open-proxyagents={() => setPane("proxyagents")}
            />
          {:else if pane === "proxyagents"}
            <AllProxyAgents
              on:proxyagents-close={() => setPane("admin")}
            />
          {/if}
        </div>

        {#if topDetail}
          {#if topDetail.type === DetailsType.Tool}
            <ToolDetail toolHash={topDetail.hash} on:close={() => $store.closeDetails()} />
          {:else if topDetail.type === DetailsType.Profile}
            <AgentProfile profileHash={topDetail.hash} on:close={() => $store.closeDetails()} />
          {/if}
        {/if}
      </div>

      <nav class="nav">
        <button class="nav-button" class:selected={pane === "tools"} on:click={() => setPane("tools")}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          <span class="button-title">Tools</span>
        </button>
        <button class="nav-button" class:selected={pane === "feed"} on:click={() => setPane("feed")}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>
          </svg>
          <span class="button-title">Feed</span>
        </button>
        <button class="nav-button" class:selected={pane === "admin" || pane === "proxyagents"} on:click={() => setPane("admin")}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span class="button-title">Admin</span>
        </button>
      </nav>

      {#if showCreateTool}
        <ToolCrud on:save={handleToolCreated} on:cancel={() => showCreateTool = false} />
      {/if}
      </file-storage-context>
    {/if}
  {:else}
    {#if error}
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; color: red;">
        <span>{error}</span>
      </div>
    {:else}
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
        <span>Connecting...</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  h3 {
    font-size: 18px;
    font-weight: 600;
  }
</style>
