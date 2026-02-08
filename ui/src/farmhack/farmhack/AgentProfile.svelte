<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { getStoreContext } from "../../contexts";
  import type { ActionHash } from "@holochain/client";
  import { encodeHashToBase64 } from "@holochain/client";
  import { toolAuthors, agentToLinkable } from "./types";
  import { toPromise } from "@holochain-open-dev/stores";
  import ProxyAgentAvatar from "./ProxyAgentAvatar.svelte";
  import ToolSummary from "./ToolSummary.svelte";

  export let profileHash: ActionHash;

  const store = getStoreContext();
  const dispatch = createEventDispatcher();

  $: proxyAgent = store.getProxyAgent(profileHash);
  $: entry = proxyAgent?.record.entry;

  // Find tools authored by this agent
  const toolsStore = store.tools;
  $: authoredTools = $toolsStore.filter(t => {
    if (t.record.entry.trashed) return false;
    return toolAuthors(t).some(a => encodeHashToBase64(a.agent.hash) === encodeHashToBase64(profileHash));
  });

  let claiming = false;

  async function claimAgent() {
    claiming = true;
    try {
      let myNickname = "";
      try {
        const myProfile = await toPromise(store.profilesStore.myProfile);
        if (myProfile) myNickname = myProfile.entry.nickname;
      } catch {}

      const myLinkable = agentToLinkable(store.myPubKey);
      const proxyHashB64 = encodeHashToBase64(profileHash);

      for (const tool of authoredTools) {
        const proxyAuthor = toolAuthors(tool).find(
          a => encodeHashToBase64(a.agent.hash) === proxyHashB64
        );
        if (!proxyAuthor) continue;

        await store.deleteRelations([proxyAuthor.relationHash]);
        await store.createRelations([{
          src: tool.original_hash,
          dst: myLinkable,
          content: {
            path: "tool.author",
            data: JSON.stringify({ name: myNickname, type: "Agent" }),
          },
        }]);
      }

      await store.deleteProxyAgent(profileHash);
      await store.fetchTools();
      await store.fetchProxyAgents();
      dispatch('close');
    } catch (err) {
      console.error("Error claiming proxy agent:", err);
    }
    claiming = false;
  }
</script>

<div class="tool-details">
  <div class="detail-header">
    <nav class="breadcrumb">
      <button class="breadcrumb-link" on:click={() => dispatch('close')}>&#8592; Back</button>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-current">{entry?.nickname || "Profile"}</span>
    </nav>
  </div>

  {#if entry}
    <div class="profile-body">
      <div class="profile-header">
        <ProxyAgentAvatar size={80} proxyAgentHash={profileHash} />
        <div class="profile-info">
          <h2>{entry.nickname}</h2>
          {#if entry.location}
            <div class="location">{entry.location}</div>
          {/if}
          <button class="claim-btn" on:click={claimAgent} disabled={claiming}>
            {claiming ? "Claiming..." : "Claim as me"}
          </button>
        </div>
      </div>

      {#if entry.bio}
        <p class="bio">{entry.bio}</p>
      {/if}

      {#if authoredTools.length > 0}
        <h3 class="section-title">Tools ({authoredTools.length})</h3>
        <div class="tools-list">
          {#each authoredTools as tool (tool.original_hash)}
            <ToolSummary {tool} />
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div style="padding: 40px; text-align: center; opacity: 0.5;">
      Agent not found.
    </div>
  {/if}
</div>

<style>
  .detail-header {
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    background: #fafafa;
  }
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }
  .breadcrumb-link {
    border: none;
    background: none;
    cursor: pointer;
    color: #1565c0;
    font-size: 14px;
    padding: 0;
  }
  .breadcrumb-link:hover {
    text-decoration: underline;
  }
  .breadcrumb-sep {
    opacity: 0.4;
  }
  .breadcrumb-current {
    opacity: 0.7;
  }
  .profile-body {
    padding: 16px;
    overflow: auto;
    flex: 1;
  }
  .profile-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  .profile-info h2 {
    margin: 0;
  }
  .claim-btn {
    margin-top: 8px;
    padding: 4px 12px;
    border: 1px solid #1565c0;
    border-radius: 4px;
    background: #e3f2fd;
    color: #1565c0;
    cursor: pointer;
    font-size: 13px;
  }
  .claim-btn:hover {
    background: #bbdefb;
  }
  .claim-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .location {
    color: #666;
    font-size: 13px;
    margin-top: 4px;
  }
  .bio {
    color: #555;
    margin-bottom: 24px;
    line-height: 1.5;
  }
  .section-title {
    font-size: 15px;
    margin: 0 0 12px 0;
    color: #333;
  }
  .tools-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
