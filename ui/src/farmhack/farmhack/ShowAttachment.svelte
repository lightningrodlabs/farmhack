<script lang="ts">
  import { onMount } from "svelte";
  import type { EntryHash } from "@holochain/client";
  import { getStoreContext } from "../../contexts";
  import { marked } from "marked";

  export let fileHash: EntryHash;
  export let name: string = "File";
  export let fileType: string = "application/octet-stream";

  const store = getStoreContext();
  let downloadUrl: string | undefined;
  let loading = true;
  let previewType: "image" | "pdf" | "text" | "markdown" | "audio" | "download" = "download";
  let textContent: string = "";
  let expanded = false;

  function detectPreview(type: string, fileName: string): typeof previewType {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (type.startsWith("image/") || ["jpg","jpeg","png","gif","webp","svg"].includes(ext)) return "image";
    if (type === "application/pdf" || ext === "pdf") return "pdf";
    if (type.startsWith("audio/") || ["mp3","wav","ogg","m4a","flac","aac"].includes(ext)) return "audio";
    if (ext === "md" || ext === "markdown") return "markdown";
    if (type.startsWith("text/") || ["txt","rtf","csv","log","json","xml","yaml","yml"].includes(ext)) return "text";
    return "download";
  }

  function getFileIcon(type: string, fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (type.includes("pdf") || ext === "pdf") return "\u{1F4C4}";
    if (type.includes("word") || ext === "doc" || ext === "docx") return "\u{1F4DD}";
    if (type.includes("spreadsheet") || ext === "xls" || ext === "xlsx") return "\u{1F4CA}";
    if (type.includes("presentation") || ext === "ppt" || ext === "pptx") return "\u{1F4CA}";
    if (type.startsWith("audio/") || ["mp3","wav","ogg","m4a"].includes(ext)) return "\u{1F3B5}";
    if (type.startsWith("text/") || ext === "txt" || ext === "rtf") return "\u{1F4C3}";
    if (ext === "md" || ext === "markdown") return "\u{1F4DD}";
    return "\u{1F4CE}";
  }

  // Configure marked renderer for safe links
  const renderer = new marked.Renderer();
  const origLink = renderer.link.bind(renderer);
  renderer.link = (token) => {
    const html = origLink(token);
    return html.replace('<a ', '<a target="_blank" rel="noopener" ');
  };

  onMount(async () => {
    try {
      const file = await store.fileStorageClient.downloadFile(fileHash);
      downloadUrl = URL.createObjectURL(file);
      if (file.name && file.name !== "file") name = file.name;
      if (file.type) fileType = file.type;

      previewType = detectPreview(fileType, name);

      if (previewType === "text" || previewType === "markdown") {
        textContent = await file.text();
      }
    } catch (e) {
      console.error("Error loading attachment:", e);
    }
    loading = false;
  });
</script>

{#if loading}
  <div class="attachment-card loading">Loading...</div>
{:else if downloadUrl}
  <div class="attachment-card">
    <div class="attachment-header">
      <a class="file-link" href={downloadUrl} download={name}>
        <span class="file-icon">{getFileIcon(fileType, name)}</span>
        <span class="file-name">{name}</span>
      </a>
      {#if previewType !== "download"}
        <button class="toggle-btn" on:click={() => expanded = !expanded}>
          {expanded ? "Hide" : "Preview"}
        </button>
      {/if}
    </div>

    {#if expanded}
      <div class="preview">
        {#if previewType === "image"}
          <img src={downloadUrl} alt={name} />
        {:else if previewType === "pdf"}
          <iframe src={downloadUrl} title={name}></iframe>
        {:else if previewType === "audio"}
          <audio controls src={downloadUrl}>
            <track kind="captions" />
          </audio>
        {:else if previewType === "markdown"}
          <div class="text-preview markdown">{@html marked.parse(textContent, { async: false, renderer })}</div>
        {:else if previewType === "text"}
          <pre class="text-preview">{textContent}</pre>
        {/if}
      </div>
    {/if}
  </div>
{:else}
  <div class="attachment-card error">Failed to load file</div>
{/if}

<style>
  .attachment-card {
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f8f8f8;
    overflow: hidden;
  }
  .attachment-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
  }
  .file-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    font-size: 13px;
    text-decoration: none;
    color: #333;
  }
  .file-link:hover {
    color: #1565c0;
  }
  .file-icon {
    font-size: 16px;
    flex-shrink: 0;
  }
  .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .toggle-btn {
    padding: 2px 8px;
    font-size: 11px;
    border: 1px solid #ccc;
    border-radius: 3px;
    background: white;
    cursor: pointer;
    color: #555;
    flex-shrink: 0;
  }
  .toggle-btn:hover {
    background: #e8f0fe;
    border-color: #1565c0;
    color: #1565c0;
  }
  .preview {
    border-top: 1px solid #ddd;
    padding: 8px;
    background: white;
  }
  .preview img {
    max-width: 100%;
    max-height: 400px;
    height: auto;
    border-radius: 4px;
  }
  .preview iframe {
    width: 100%;
    height: 500px;
    border: none;
    border-radius: 4px;
  }
  .preview audio {
    width: 100%;
  }
  .text-preview {
    max-height: 300px;
    overflow: auto;
    font-size: 13px;
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .text-preview.markdown {
    white-space: normal;
  }
  .text-preview.markdown :global(a) {
    color: #1565c0;
  }
  .loading, .error {
    padding: 6px 10px;
    opacity: 0.5;
    font-size: 12px;
  }
</style>
