<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { getStoreContext } from "../../contexts";
  import type { AgentPubKey } from "@holochain/client";
  import { encodeHashToBase64 } from "@holochain/client";
  import { toolAuthors } from "./types";
  import Avatar from "./Avatar.svelte";
  import ToolSummary from "./ToolSummary.svelte";

  export let agentPubKey: AgentPubKey;

  const store = getStoreContext();
  const dispatch = createEventDispatcher();

  $: s = store.profilesStore.profiles.get(agentPubKey);
  $: profile = $s.status === "complete" ? $s.value : undefined;

  const toolsStore = store.tools;
  $: authoredTools = $toolsStore.filter(t => {
    if (t.record.entry.trashed) return false;
    return toolAuthors(t).some(a => encodeHashToBase64(a.agent.hash) === encodeHashToBase64(agentPubKey));
  });
</script>

<div class="tool-details">
  <div class="detail-header">
    <nav class="breadcrumb">
      <button class="breadcrumb-link" on:click={() => dispatch('close')}>&#8592; Back</button>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-current">{profile?.entry.nickname || "Profile"}</span>
    </nav>
  </div>

  {#if profile}
    <div class="profile-body">
      <div class="profile-header">
        <Avatar agentPubKey={agentPubKey} size={80} showNickname={false} />
        <div class="profile-info">
          <h2>{profile.entry.nickname}</h2>
          {#if profile.entry.fields.location}
            <div class="location">{profile.entry.fields.location}</div>
          {/if}
        </div>
      </div>

      {#if profile.entry.fields.bio}
        <p class="bio">{profile.entry.fields.bio}</p>
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
