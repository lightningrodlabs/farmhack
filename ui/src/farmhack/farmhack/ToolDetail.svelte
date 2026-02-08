<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { getStoreContext } from "../../contexts";
  import type { ActionHash } from "@holochain/client";
  import { encodeHashToBase64 } from "@holochain/client";
  import { toolNotes, toolTags, toolAuthors, toolFiles, type Info, type Tool, type Note } from "./types";
  import { marked } from "marked";
  import ShowFile from "./ShowFile.svelte";
  import ShowAttachment from "./ShowAttachment.svelte";
  import AnyAvatar from "./AnyAvatar.svelte";
  import NoteCrud from "./NoteCrud.svelte";
  import ToolCrud from "./ToolCrud.svelte";

  export let toolHash: ActionHash;

  const store = getStoreContext();
  const dispatch = createEventDispatcher();

  let showNoteCreate = false;
  let notes: Array<Info<Note>> = [];
  let openSection = "concept";
  let expandedImage: number | null = null;
  let toolCrudRef: ToolCrud;

  function handleEdit() {
    if (tool) {
      toolCrudRef.open(tool);
    }
  }

  async function handleEditSaved() {
    await store.fetchTools();
  }

  // Subscribe to the tools store so this re-evaluates when tools are refreshed
  const toolsStore = store.tools;
  $: tool = ($toolsStore, store.getTool(toolHash));
  $: entry = tool?.record.entry;
  $: tags = tool ? toolTags(tool) : [];
  $: noteHashes = tool ? toolNotes(tool) : [];
  $: authors = tool ? toolAuthors(tool) : [];
  $: createdAt = tool ? new Date(tool.record.action.timestamp) : null;
  $: docsFiles = tool ? toolFiles(tool, "docs") : [];
  $: manualFiles = tool ? toolFiles(tool, "manual") : [];
  $: skillsFiles = tool ? toolFiles(tool, "skills") : [];

  // Configure marked to open links in new tabs
  const renderer = new marked.Renderer();
  const origLinkRenderer = renderer.link.bind(renderer);
  renderer.link = (token) => {
    const html = origLinkRenderer(token);
    return html.replace('<a ', '<a target="_blank" rel="noopener" ');
  };

  function renderMarkdown(md: string): string {
    if (!md) return "";
    return marked.parse(md, { async: false, renderer }) as string;
  }

  function formatDate(d: Date): string {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  onMount(async () => {
    if (noteHashes.length > 0) {
      await store.fetchNote(noteHashes);
    }
  });

  const notesStore = store.notes;
  $: {
    const notesMap = $notesStore;
    notes = noteHashes.map(h => notesMap.get(encodeHashToBase64(h))).filter(n => n && !n.record.entry.trashed) as Array<Info<Note>>;
  }

  async function handleNoteCreated(event: CustomEvent) {
    const noteHash = event.detail;
    await store.createRelations([{
      src: toolHash,
      dst: noteHash,
      content: { path: "tool.note", data: "" },
    }]);
    await store.fetchTools();
    await store.fetchNote([noteHash]);
    showNoteCreate = false;
  }
</script>

<div class="tool-details">
  <!-- Breadcrumb header -->
  <div class="detail-header">
    <nav class="breadcrumb">
      <button class="breadcrumb-link" on:click={() => dispatch('close')}>Tools</button>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-current">{entry?.title || "Tool"}</span>
    </nav>
  </div>

  {#if entry}
    <div style="padding: 16px; overflow: auto; flex: 1;">
      <!-- Title and metadata -->
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <h2 style="margin: 0; flex: 1;">{entry.title}</h2>
          <button class="edit-btn" on:click={handleEdit}>Edit</button>
        </div>
        <div class="meta-row">
          {#if authors.length > 0}
            <span class="meta-item" style="display: inline-flex; align-items: center; gap: 4px;">
              By
              {#each authors as a, i}
                <AnyAvatar agent={a.agent} size={20} showAvatar={true} showNickname={true} />
                {#if i < authors.length - 1}<span>,</span>{/if}
              {/each}
            </span>
          {/if}
          {#if createdAt}
            <span class="meta-item">{formatDate(createdAt)}</span>
          {/if}
        </div>
      </div>

      <!-- Tool Concept Section -->
      <div class="accordion-section">
        <button class="accordion-header concept" on:click={() => openSection = openSection === 'concept' ? '' : 'concept'}>
          Tool Concept
          <span class="accordion-arrow" class:open={openSection === 'concept'}>&#9662;</span>
        </button>
        {#if openSection === 'concept'}
          <div class="accordion-body">
            {#if entry.pic}
              <div style="max-width: 400px; margin: 0 auto 16px auto;">
                <ShowFile fileHash={entry.pic} />
              </div>
            {/if}

            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
              <span class="status-badge">{entry.status}</span>
              {#if entry.license}
                <span class="license-badge">{entry.license}</span>
              {/if}
            </div>

            <div style="margin-bottom: 16px;">
              <p style="white-space: pre-wrap;">{entry.description}</p>
            </div>

            {#if tags.length > 0}
              <div style="margin-bottom: 16px;">
                <strong>Tags:</strong>
                <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
                  {#each tags as tag}
                    <span class="tag">{tag}</span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Documentation Section -->
      {#if entry.wiki || entry.video_url || (entry.images && entry.images.length > 0) || docsFiles.length > 0}
        <div class="accordion-section">
          <button class="accordion-header docs" on:click={() => openSection = openSection === 'docs' ? '' : 'docs'}>
            Documentation
            <span class="accordion-arrow" class:open={openSection === 'docs'}>&#9662;</span>
          </button>
          {#if openSection === 'docs'}
            <div class="accordion-body">
              {#if entry.video_url}
                <div style="margin-bottom: 16px;">
                  <div class="video-embed">
                    {#if entry.video_url.includes('youtube.com/embed/') || entry.video_url.includes('player.vimeo.com')}
                      <iframe
                        src={entry.video_url}
                        title="Video"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        style="width: 100%; aspect-ratio: 16/9;"
                      ></iframe>
                    {:else}
                      <a href={entry.video_url} target="_blank" rel="noopener">{entry.video_url}</a>
                    {/if}
                  </div>
                </div>
              {/if}

              {#if entry.images && entry.images.length > 0}
                <div class="image-gallery">
                  {#each entry.images as imgHash, i}
                    <div
                      class="gallery-thumb"
                      class:expanded={expandedImage === i}
                      on:click={() => expandedImage = expandedImage === i ? null : i}
                      on:keypress={() => {}}
                    >
                      <ShowFile fileHash={imgHash} />
                    </div>
                  {/each}
                </div>
                {#if expandedImage !== null && entry.images[expandedImage]}
                  <div class="gallery-expanded" on:click={() => expandedImage = null} on:keypress={() => {}}>
                    <ShowFile fileHash={entry.images[expandedImage]} />
                  </div>
                {/if}
              {/if}

              {#if entry.wiki}
                <div class="wiki-content">{@html renderMarkdown(entry.wiki)}</div>
              {/if}

              {#if docsFiles.length > 0}
                <div class="attached-files">
                  <h4>Attached files</h4>
                  <div class="file-list">
                    {#each docsFiles as af}
                      <ShowAttachment fileHash={af.fileHash} name={af.name} fileType={af.file_type} />
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- User Manual Section -->
      {#if entry.wiki2 || manualFiles.length > 0}
        <div class="accordion-section">
          <button class="accordion-header docs" on:click={() => openSection = openSection === 'manual' ? '' : 'manual'}>
            User Manual
            <span class="accordion-arrow" class:open={openSection === 'manual'}>&#9662;</span>
          </button>
          {#if openSection === 'manual'}
            <div class="accordion-body">
              {#if entry.wiki2}
                <div class="wiki-content">{@html renderMarkdown(entry.wiki2)}</div>
              {/if}

              {#if manualFiles.length > 0}
                <div class="attached-files">
                  <h4>Attached files</h4>
                  <div class="file-list">
                    {#each manualFiles as af}
                      <ShowAttachment fileHash={af.fileHash} name={af.name} fileType={af.file_type} />
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Skills Section -->
      {#if entry.wiki3 || skillsFiles.length > 0}
        <div class="accordion-section">
          <button class="accordion-header docs" on:click={() => openSection = openSection === 'skills' ? '' : 'skills'}>
            Skills
            <span class="accordion-arrow" class:open={openSection === 'skills'}>&#9662;</span>
          </button>
          {#if openSection === 'skills'}
            <div class="accordion-body">
              {#if entry.wiki3}
                <div class="wiki-content">{@html renderMarkdown(entry.wiki3)}</div>
              {/if}

              {#if skillsFiles.length > 0}
                <div class="attached-files">
                  <h4>Attached files</h4>
                  <div class="file-list">
                    {#each skillsFiles as af}
                      <ShowAttachment fileHash={af.fileHash} name={af.name} fileType={af.file_type} />
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Comments Section -->
      <div class="accordion-section">
        <button class="accordion-header docs" on:click={() => openSection = openSection === 'comments' ? '' : 'comments'}>
          Comments ({notes.length})
          <span class="accordion-arrow" class:open={openSection === 'comments'}>&#9662;</span>
        </button>
        {#if openSection === 'comments'}
          <div class="accordion-body">
            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
              <button on:click={() => showNoteCreate = true} style="border: 1px solid #ddd; background: white; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
                + Add Comment
              </button>
            </div>

            {#each notes as note}
              <div style="background: #f9f9f9; padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                <p style="white-space: pre-wrap;">{note.record.entry.text}</p>
                {#if note.record.entry.pic}
                  <div style="max-width: 200px; margin-top: 8px;">
                    <ShowFile fileHash={note.record.entry.pic} />
                  </div>
                {/if}
              </div>
            {:else}
              <p style="opacity: 0.5;">No comments yet.</p>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <p style="padding: 16px;">Tool not found.</p>
  {/if}

  {#if showNoteCreate}
    <NoteCrud {toolHash} on:save={handleNoteCreated} on:cancel={() => showNoteCreate = false} />
  {/if}

  <ToolCrud bind:this={toolCrudRef} {tool} showModal={false} on:save={handleEditSaved} />
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta-row {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: #666;
  }
  .author-link {
    color: var(--primary-color);
    font-weight: 600;
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    cursor: pointer;
  }
  .author-link:hover {
    text-decoration: underline;
  }
  .edit-btn {
    padding: 4px 14px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 13px;
    color: #555;
  }
  .edit-btn:hover {
    background: #f5f5f5;
    border-color: #bbb;
  }
  .status-badge {
    font-size: 12px;
    background: #e8f5e9;
    color: #2e7d32;
    padding: 3px 10px;
    border-radius: 12px;
  }
  .license-badge {
    font-size: 12px;
    background: #e3f2fd;
    color: #1565c0;
    padding: 3px 10px;
    border-radius: 12px;
  }
  .tag {
    font-size: 12px;
    background: #f0f0f0;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .accordion-section {
    border: 1px solid #ddd;
    border-radius: 6px;
    margin-bottom: 8px;
    overflow: hidden;
  }
  .accordion-header {
    width: 100%;
    padding: 12px 16px;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .accordion-header.concept {
    background: #5c8a4d;
  }
  .accordion-header.docs {
    background: #6b7b8d;
  }
  .accordion-arrow {
    transition: transform 0.2s;
  }
  .accordion-arrow.open {
    transform: rotate(180deg);
  }
  .accordion-body {
    padding: 16px;
  }
  .wiki-content {
    line-height: 1.6;
    word-break: break-word;
  }
  .wiki-content :global(img) {
    max-width: 100%;
    height: auto;
  }
  .wiki-content :global(a) {
    color: #1565c0;
    text-decoration: underline;
    cursor: pointer;
  }
  .wiki-content :global(a:hover) {
    color: #0d47a1;
  }
  .video-embed {
    max-width: 560px;
  }
  .image-gallery {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .gallery-thumb {
    width: 150px;
    height: 120px;
    overflow: hidden;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .gallery-thumb:hover, .gallery-thumb.expanded {
    border-color: #1565c0;
  }
  .gallery-thumb :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .gallery-expanded {
    margin-bottom: 16px;
    max-width: 600px;
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
  }
  .gallery-expanded :global(img) {
    width: 100%;
    height: auto;
  }
  .attached-files {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #eee;
  }
  .attached-files h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: #555;
  }
  .file-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
