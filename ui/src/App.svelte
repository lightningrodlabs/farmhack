<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { AdminWebsocket, AppWebsocket, type AppClient, type AppWebsocketConnectionOptions } from "@holochain/client";
  import { WeaveClient, initializeHotReload, isWeaveContext } from '@theweave/api';
  import { appletServices } from './we';
  import { CloneManagerStore } from "./stores/clone-manager-store";
  import { storeContext, cloneManagerStoreContext } from "./contexts";
  import { APP_ID, ROLE_NAME, DetailsType } from "./farmhack/farmhack/types";
  import AllTools from "./farmhack/farmhack/AllTools.svelte";
  import ToolDetail from "./farmhack/farmhack/ToolDetail.svelte";
  import ToolCrud from "./farmhack/farmhack/ToolCrud.svelte";
  import Feed from "./farmhack/farmhack/Feed.svelte";
  import Admin from "./farmhack/farmhack/Admin.svelte";
  import AllProxyAgents from "./farmhack/farmhack/AllProxyAgents.svelte";
  import AgentProfile from "./farmhack/farmhack/AgentProfile.svelte";
  import Folk from "./farmhack/farmhack/Folk.svelte";
  import MyProfile from "./farmhack/farmhack/MyProfile.svelte";
  import "@shoelace-style/shoelace/dist/themes/light.css";
  import "@holochain-open-dev/profiles/dist/elements/profiles-context.js";
  import "@holochain-open-dev/profiles/dist/elements/create-profile.js";
  import "@holochain-open-dev/file-storage/dist/elements/file-storage-context.js";

  let client: AppClient | undefined;
  let weClient: WeaveClient;
  let cloneManagerStore: CloneManagerStore | undefined;
  let loading = true;
  let connected = false;
  let error: string | undefined;
  let showCreateTool = false;

  $: store = cloneManagerStore?.activeStore;
  $: prof = $store ? $store.profilesStore.myProfile : undefined;
  $: isWeave = $store ? $store.isWeaveContext : false;
  $: uiProps = $store ? $store.uiProps : undefined;
  $: pane = $store ? $uiProps.pane : "tools";
  $: topDetail = $store && $uiProps.detailsStack.length > 0 ? $uiProps.detailsStack[0] : undefined;

  onMount(async () => {
    try {
      if ((import.meta as any).env.DEV) {
        try {
          await initializeHotReload();
        } catch (e) {
          console.warn("Could not initialize applet hot-reloading. This is only expected to work in a Moss context in dev mode.");
        }
      }

      if (!isWeaveContext()) {
        const adminPort: string = import.meta.env.VITE_ADMIN_PORT;
        const appPort: string = import.meta.env.VITE_APP_PORT;
        const url = appPort ? `ws://localhost:${appPort}` : `ws://localhost`;

        let tokenResp;
        if (adminPort) {
          const adminUrl = `ws://localhost:${adminPort}`;
          const adminWebsocket = await AdminWebsocket.connect({ url: new URL(adminUrl) });
          tokenResp = await adminWebsocket.issueAppAuthenticationToken({
            installed_app_id: APP_ID,
          });
          const cellIds = await adminWebsocket.listCellIds();
          await adminWebsocket.authorizeSigningCredentials(cellIds[0]);
        }

        const params: AppWebsocketConnectionOptions = { url: new URL(url), defaultTimeout: 240000 };
        if (tokenResp) params.token = tokenResp.token;
        client = await AppWebsocket.connect(params);
      } else {
        weClient = await WeaveClient.connect(appletServices);
        switch (weClient.renderInfo.type) {
          case "applet-view":
            switch (weClient.renderInfo.view.type) {
              case "main":
                break;
              case "block":
                throw new Error("Unknown applet-view block type:" + weClient.renderInfo.view.block);
              case "asset":
                if (!weClient.renderInfo.view.recordInfo) {
                  throw new Error("FarmHack does not implement asset views pointing to DNAs instead of Records.");
                } else {
                  switch (weClient.renderInfo.view.recordInfo.roleName) {
                    case ROLE_NAME:
                      switch (weClient.renderInfo.view.recordInfo.entryType) {
                        case "tool":
                          break;
                        default:
                          throw new Error("Unknown entry type:" + weClient.renderInfo.view.recordInfo.entryType);
                      }
                      break;
                    default:
                      throw new Error("Unknown role name:" + weClient.renderInfo.view.recordInfo.roleName);
                  }
                }
                break;
              default:
                throw new Error("Unsupported applet-view type");
            }
            break;
          case "cross-group-view":
            throw new Error("Cross-group views not yet supported.");
          default:
            throw new Error("Unknown render view type");
        }

        //@ts-ignore
        client = weClient.renderInfo.appletClient;
      }

      cloneManagerStore = new CloneManagerStore(client, weClient);
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
    await Promise.all([$store.fetchTools(), $store.fetchProxyAgents(), $store.fetchFeed()]);
    loading = false;
  };

  $: $store, loadStore();

  function setPane(p: string) {
    if ($store) {
      $store.setUIprops({ pane: p, detailsStack: [] });
      if (p === "tools") {
        $store.fetchTools();
      } else if (p === "feed") {
        $store.fetchFeed();
      } else if (p === "admin" || p === "proxyagents") {
        $store.fetchTools();
        $store.fetchProxyAgents();
      }
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
      <profiles-context store={$store.profilesStore}>
      <file-storage-context client={$store.fileStorageClient}>
      {#if !isWeave && $prof && $prof.status === "complete" && $prof.value === undefined}
        <div class="welcome">
          <div class="welcome-card">
            <h2>Welcome to FarmHack</h2>
            <p>Create a profile to get started.</p>
            <create-profile
              on:profile-created={() => {}}
            ></create-profile>
          </div>
        </div>
      {:else}
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
          {:else if pane === "you"}
            <MyProfile />
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
          {:else if topDetail.type === DetailsType.Folk}
            <Folk agentPubKey={topDetail.hash} on:close={() => $store.closeDetails()} />
          {:else if topDetail.type === DetailsType.ProxyAgent}
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
        <button class="nav-button" class:selected={pane === "you"} on:click={() => setPane("you")}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span class="button-title">You</span>
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
      {/if}
      </file-storage-context>
      </profiles-context>
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
  .welcome {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    padding: 20px;
  }
  .welcome-card {
    text-align: center;
    max-width: 400px;
  }
  .welcome-card h2 {
    margin: 0 0 8px 0;
  }
  .welcome-card p {
    color: var(--muted-text-color);
    margin: 0 0 24px 0;
  }
</style>
