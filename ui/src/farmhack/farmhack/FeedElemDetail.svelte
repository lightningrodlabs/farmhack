<script lang="ts">
  import { getContext } from "svelte";
  import { encodeHashToBase64 } from "@holochain/client";
  import { type FeedElem, FeedType } from "./types";
  import { storeContext } from "../../contexts";
  import type { FarmHackStore } from "../../stores/farmhack-store";
  import Avatar from "./Avatar.svelte";

  export let feedElem: FeedElem;

  let store: FarmHackStore = (getContext(storeContext) as any).getStore();

  $: toolsStore = store.tools;
  $: toolTitle = (() => {
    const hash = feedElem.about;
    const t = $toolsStore.find(t => encodeHashToBase64(t.original_hash) === encodeHashToBase64(hash));
    return t ? t.record.entry.title : null;
  })();

  function openTool() {
    store.openToolDetail(feedElem.about);
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
  }
</script>

<div class="feed-elem">
  <div class="elem-head">
    <span class="timestamp">{formatTime(feedElem.timestamp)}</span>
  </div>
  <div class="elem-body">
    {#if feedElem.type === FeedType.ToolNew}
      <div class="inline">
        <Avatar agentPubKey={feedElem.author} size={18} showNickname={false} />
        created a tool
      </div>
      {#if toolTitle}
        <button class="link" on:click={openTool}>{toolTitle}</button>
      {:else}
        <span class="detail">{feedElem.detail}</span>
      {/if}

    {:else if feedElem.type === FeedType.ToolUpdate}
      <div class="inline">
        <Avatar agentPubKey={feedElem.author} size={18} showNickname={false} />
        updated a tool
      </div>
      {#if toolTitle}
        <button class="link" on:click={openTool}>{toolTitle}</button>
      {:else}
        <span class="detail">{feedElem.detail?.title || ""}</span>
      {/if}

    {:else if feedElem.type === FeedType.ToolDelete}
      <div class="inline">
        <Avatar agentPubKey={feedElem.author} size={18} showNickname={false} />
        deleted a tool: {feedElem.detail}
      </div>

    {:else if feedElem.type === FeedType.NoteNew}
      <div class="inline">
        <Avatar agentPubKey={feedElem.author} size={18} showNickname={false} />
        commented on
        {#if toolTitle}
          <button class="link" on:click={openTool}>{toolTitle}</button>
        {:else}
          a tool
        {/if}
      </div>
      <div class="note-preview">{feedElem.detail}</div>

    {:else if feedElem.type === FeedType.NoteUpdate}
      <div class="inline">
        <Avatar agentPubKey={feedElem.author} size={18} showNickname={false} />
        updated a comment
      </div>

    {:else if feedElem.type === FeedType.NoteDelete}
      <div class="inline">
        <Avatar agentPubKey={feedElem.author} size={18} showNickname={false} />
        deleted a comment
      </div>

    {:else if feedElem.type === FeedType.ProxyAgentNew}
      <div class="inline">
        <Avatar agentPubKey={feedElem.author} size={18} showNickname={false} />
        added member: {feedElem.detail}
      </div>

    {:else if feedElem.type === FeedType.ProxyAgentUpdate}
      <div class="inline">
        <Avatar agentPubKey={feedElem.author} size={18} showNickname={false} />
        updated member
      </div>

    {:else if feedElem.type === FeedType.ProxyAgentDelete}
      <div class="inline">
        <Avatar agentPubKey={feedElem.author} size={18} showNickname={false} />
        {#if feedElem.detail?.claimed}
          claimed {feedElem.detail.proxyName}
        {:else}
          removed member: {typeof feedElem.detail === "string" ? feedElem.detail : JSON.stringify(feedElem.detail)}
        {/if}
      </div>

    {:else}
      <div class="inline">
        <Avatar agentPubKey={feedElem.author} size={18} showNickname={false} />
        {feedElem.detail}
      </div>
    {/if}
  </div>
</div>

<style>
  .feed-elem {
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    border-radius: 6px;
    position: relative;
    background: white;
    width: 100%;
    box-sizing: border-box;
  }
  .elem-head {
    position: absolute;
    top: 4px;
    right: 8px;
    font-size: 10px;
  }
  .timestamp {
    opacity: 0.3;
  }
  .elem-body {
    width: 100%;
    text-align: left;
    font-size: 13px;
  }
  .inline {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .link {
    border: none;
    background: none;
    color: #1565c0;
    cursor: pointer;
    padding: 0;
    font-size: 13px;
    text-decoration: underline;
  }
  .link:hover {
    color: #0d47a1;
  }
  .detail {
    color: var(--muted-text-color);
  }
  .note-preview {
    margin-top: 4px;
    padding: 6px 8px;
    background: #f5f5f5;
    border-radius: 4px;
    font-size: 12px;
    color: var(--muted-text-color);
    white-space: pre-wrap;
    overflow: hidden;
    max-height: 60px;
  }
</style>
