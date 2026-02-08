<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { getStoreContext } from "../../contexts";
  import { ToolStatuses, toolFiles, type Tool, type Info, type FileAttachment } from "./types";
  import type { ActionHash } from "@holochain/client";
  import { encodeHashToBase64, type EntryHash } from "@holochain/client";
  import '@holochain-open-dev/file-storage/dist/elements/upload-files.js';
  import type { UploadFiles } from '@holochain-open-dev/file-storage/dist/elements/upload-files.js';
  import ShowFile from "./ShowFile.svelte";
  import ShowAttachment from "./ShowAttachment.svelte";

  export let tool: Info<Tool> | undefined = undefined;

  const store = getStoreContext();
  const dispatch = createEventDispatcher();

  export let showModal = true;
  let title = tool?.record.entry.title || "";
  let description = tool?.record.entry.description || "";
  let status = tool?.record.entry.status || "Concept";
  let tagsStr = tool?.record.entry.tags.join(", ") || "";
  let license = tool?.record.entry.license || "";
  let wiki = tool?.record.entry.wiki || "";
  let wiki2 = tool?.record.entry.wiki2 || "";
  let wiki3 = tool?.record.entry.wiki3 || "";
  let videoUrl = tool?.record.entry.video_url || "";
  let pic: EntryHash | undefined = tool?.record.entry.pic;
  let images: Array<EntryHash> = tool?.record.entry.images || [];
  let uploadPic: UploadFiles;
  let uploadImages: UploadFiles;
  let saving = false;
  let activeSection = "basic";

  // File attachments per section
  type PendingFile = { hash: EntryHash; name: string; file_type: string };
  let existingFiles: Record<string, FileAttachment[]> = { docs: [], manual: [], skills: [] };
  let pendingFiles: Record<string, PendingFile[]> = { docs: [], manual: [], skills: [] };
  let deletedRelations: ActionHash[] = [];

  export function open(toolData: Info<Tool>) {
    tool = toolData;
    const e = toolData.record.entry;
    title = e.title || "";
    description = e.description || "";
    status = e.status || "Concept";
    tagsStr = e.tags.join(", ") || "";
    license = e.license || "";
    wiki = e.wiki || "";
    wiki2 = e.wiki2 || "";
    wiki3 = e.wiki3 || "";
    videoUrl = e.video_url || "";
    pic = e.pic;
    images = e.images || [];
    if (uploadPic) {
      uploadPic.defaultValue = pic ? encodeHashToBase64(pic) : undefined;
      uploadPic.reset();
    }
    if (uploadImages) {
      uploadImages.defaultValue = undefined;
      uploadImages.reset();
    }
    // Load existing file attachments from relations
    existingFiles = {
      docs: toolFiles(toolData, "docs"),
      manual: toolFiles(toolData, "manual"),
      skills: toolFiles(toolData, "skills"),
    };
    pendingFiles = { docs: [], manual: [], skills: [] };
    deletedRelations = [];
    activeSection = "basic";
    showModal = true;
  }

  function removeImage(index: number) {
    images = images.filter((_, i) => i !== index);
  }

  function removeExistingFile(section: string, index: number) {
    const file = existingFiles[section][index];
    deletedRelations = [...deletedRelations, file.relationHash];
    existingFiles[section] = existingFiles[section].filter((_, i) => i !== index);
    existingFiles = existingFiles; // trigger reactivity
  }

  function removePendingFile(section: string, index: number) {
    pendingFiles[section] = pendingFiles[section].filter((_, i) => i !== index);
    pendingFiles = pendingFiles;
  }

  function handleFileUploaded(section: string, e: CustomEvent) {
    const file = e.detail.file;
    pendingFiles[section] = [...pendingFiles[section], {
      hash: file.hash,
      name: file.name || "File",
      file_type: file.type || "application/octet-stream",
    }];
    pendingFiles = pendingFiles;
  }

  async function handleSave() {
    if (!title.trim()) return;
    saving = true;
    try {
      const tags = tagsStr.split(",").map(t => t.trim()).filter(t => t);
      const toolData: Tool = {
        title: title.trim(),
        description: description.trim(),
        status,
        tags,
        pic,
        trashed: false,
        license: license.trim(),
        wiki: wiki.trim(),
        wiki2: wiki2.trim(),
        wiki3: wiki3.trim(),
        video_url: videoUrl.trim() || null,
        images,
      };

      let toolHash: ActionHash;
      if (tool) {
        await store.updateTool(tool.original_hash, tool.record.actionHash, toolData);
        toolHash = tool.original_hash;
      } else {
        toolHash = await store.createTool(toolData);
      }

      // Delete removed file attachment relations
      if (deletedRelations.length > 0) {
        await store.deleteRelations(deletedRelations);
      }

      // Create new file attachment relations
      for (const section of ["docs", "manual", "skills"]) {
        for (const pf of pendingFiles[section]) {
          await store.createRelations([{
            src: toolHash,
            dst: pf.hash,
            content: {
              path: `tool.file.${section}`,
              data: JSON.stringify({ name: pf.name, file_type: pf.file_type }),
            },
          }]);
        }
      }

      showModal = false;
      dispatch("save");
    } catch (e) {
      console.error("Error saving tool:", e);
    }
    saving = false;
  }

  function handleCancel() {
    showModal = false;
    dispatch("cancel");
  }
</script>

{#if showModal}
<div class="modal-overlay">
  <div class="modal-content">
    <h3>{tool ? "Edit Tool" : "New Tool"}</h3>

    <div class="section-tabs">
      <button class:active={activeSection === "basic"} on:click={() => activeSection = "basic"}>Basic Info</button>
      <button class:active={activeSection === "docs"} on:click={() => activeSection = "docs"}>Documentation</button>
      <button class:active={activeSection === "manual"} on:click={() => activeSection = "manual"}>User Manual</button>
      <button class:active={activeSection === "skills"} on:click={() => activeSection = "skills"}>Skills</button>
    </div>

    <div class="tab-body">
      {#if activeSection === "basic"}
        <div class="two-col">
          <div class="col-fields">
            <label>
              Title
              <input type="text" bind:value={title} placeholder="Tool name" />
            </label>

            <label>
              Status
              <select bind:value={status}>
                {#each ToolStatuses as s}
                  <option value={s}>{s}</option>
                {/each}
              </select>
            </label>

            <label>
              License
              <input type="text" bind:value={license} placeholder="e.g. Open Source Hardware, CC BY-SA" />
            </label>

            <label>
              Tags (comma-separated)
              <input type="text" bind:value={tagsStr} placeholder="e.g. irrigation, arduino, sensors" />
            </label>
          </div>

          <div class="col-image">
            <div class="field-label">Main Image</div>
            {#if pic}
              <div class="current-pic">
                <ShowFile fileHash={pic} />
                <button class="remove-btn" on:click={() => { pic = undefined; }}>Remove</button>
              </div>
            {:else}
              <div class="upload-area">
                <upload-files
                  bind:this={uploadPic}
                  one-file
                  accepted-files="image/jpeg,image/png,image/gif"
                  on:file-uploaded={(e) => { pic = e.detail.file.hash; }}
                ></upload-files>
              </div>
            {/if}
          </div>
        </div>

        <label class="expand">
          Description
          <textarea bind:value={description} placeholder="A short description of the tool concept..."></textarea>
        </label>
      {/if}

      {#if activeSection === "docs"}
        <div class="two-col">
          <div class="col-fields">
            <label>
              Video URL
              <input type="text" bind:value={videoUrl} placeholder="YouTube or Vimeo URL" />
            </label>
          </div>

          <div class="col-image">
            <div class="field-label">Images</div>
            {#if images.length > 0}
              <div class="image-thumbs">
                {#each images as imgHash, i}
                  <div class="thumb">
                    <ShowFile fileHash={imgHash} />
                    <button class="remove-btn" on:click={() => removeImage(i)}>x</button>
                  </div>
                {/each}
              </div>
            {/if}
            <div class="upload-area">
              <upload-files
                bind:this={uploadImages}
                accepted-files="image/jpeg,image/png,image/gif"
                on:file-uploaded={(e) => { images = [...images, e.detail.file.hash]; }}
              ></upload-files>
            </div>
          </div>
        </div>

        <label class="expand">
          Documentation
          <textarea bind:value={wiki} placeholder="Build instructions, design rationale, bill of materials..."></textarea>
        </label>

        <div class="file-section two-col">
          <div class="col-fields">
            <div class="field-label">Attached Files</div>
            <div class="file-attach-list">
              {#each existingFiles.docs as af, i}
                <div class="file-attach-item">
                  <span class="file-attach-name">{af.name}</span>
                  <button class="file-remove-btn" on:click={() => removeExistingFile("docs", i)}>x</button>
                </div>
              {/each}
              {#each pendingFiles.docs as pf, i}
                <div class="file-attach-item pending">
                  <span class="file-attach-name">{pf.name}</span>
                  <button class="file-remove-btn" on:click={() => removePendingFile("docs", i)}>x</button>
                </div>
              {/each}
            </div>
          </div>
          <div class="col-upload">
            <div class="upload-area">
              <upload-files
                on:file-uploaded={(e) => handleFileUploaded("docs", e)}
              ></upload-files>
            </div>
          </div>
        </div>
      {/if}

      {#if activeSection === "manual"}
        <label class="expand">
          User Manual
          <textarea bind:value={wiki2} placeholder="How to use this tool, operation instructions..."></textarea>
        </label>

        <div class="file-section two-col">
          <div class="col-fields">
            <div class="field-label">Attached Files</div>
            <div class="file-attach-list">
              {#each existingFiles.manual as af, i}
                <div class="file-attach-item">
                  <span class="file-attach-name">{af.name}</span>
                  <button class="file-remove-btn" on:click={() => removeExistingFile("manual", i)}>x</button>
                </div>
              {/each}
              {#each pendingFiles.manual as pf, i}
                <div class="file-attach-item pending">
                  <span class="file-attach-name">{pf.name}</span>
                  <button class="file-remove-btn" on:click={() => removePendingFile("manual", i)}>x</button>
                </div>
              {/each}
            </div>
          </div>
          <div class="col-upload">
            <div class="upload-area">
              <upload-files
                on:file-uploaded={(e) => handleFileUploaded("manual", e)}
              ></upload-files>
            </div>
          </div>
        </div>
      {/if}

      {#if activeSection === "skills"}
        <label class="expand">
          Skills & Learning Resources
          <textarea bind:value={wiki3} placeholder="Skills needed, learning resources, training materials..."></textarea>
        </label>

        <div class="file-section two-col">
          <div class="col-fields">
            <div class="field-label">Attached Files</div>
            <div class="file-attach-list">
              {#each existingFiles.skills as af, i}
                <div class="file-attach-item">
                  <span class="file-attach-name">{af.name}</span>
                  <button class="file-remove-btn" on:click={() => removeExistingFile("skills", i)}>x</button>
                </div>
              {/each}
              {#each pendingFiles.skills as pf, i}
                <div class="file-attach-item pending">
                  <span class="file-attach-name">{pf.name}</span>
                  <button class="file-remove-btn" on:click={() => removePendingFile("skills", i)}>x</button>
                </div>
              {/each}
            </div>
          </div>
          <div class="col-upload">
            <div class="upload-area">
              <upload-files
                on:file-uploaded={(e) => handleFileUploaded("skills", e)}
              ></upload-files>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button on:click={handleCancel} disabled={saving}>Cancel</button>
      <button class="primary" on:click={handleSave} disabled={saving || !title.trim()}>
        {saving ? "Saving..." : (tool ? "Update" : "Create")}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 95px; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: stretch;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }
  .modal-content {
    background: white;
    border-radius: 8px;
    width: 100%;
    max-width: 800px;
    display: flex;
    flex-direction: column;
    padding: 24px 24px 0 24px;
  }
  h3 { margin: 0 0 16px 0; flex-shrink: 0; }
  .section-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 0;
    border-bottom: 1px solid #ddd;
    padding-bottom: 8px;
    flex-shrink: 0;
  }
  .tab-body {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    padding: 16px 0;
    min-height: 0;
  }
  .modal-footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 16px 0;
    border-top: 1px solid #eee;
    flex-shrink: 0;
  }
  .section-tabs button {
    padding: 6px 12px;
    border: 1px solid transparent;
    border-radius: 4px 4px 0 0;
    background: none;
    cursor: pointer;
    font-size: 13px;
    color: #666;
  }
  .section-tabs button.active {
    border-color: #ddd;
    border-bottom-color: white;
    color: #333;
    font-weight: 500;
    background: white;
  }
  label {
    display: flex;
    flex-direction: column;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 500;
    flex-shrink: 0;
  }
  label.expand {
    flex: 1;
    flex-shrink: 1;
    min-height: 0;
  }
  label.expand textarea {
    flex: 1;
    min-height: 80px;
  }
  input, textarea, select {
    margin-top: 4px;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  textarea { resize: vertical; }
  .two-col {
    display: flex;
    gap: 16px;
    flex-shrink: 0;
  }
  .col-fields {
    flex: 1;
    min-width: 0;
  }
  .col-image {
    width: 240px;
    flex-shrink: 0;
  }
  .field-label {
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 4px;
  }
  .upload-area {
    margin-bottom: 8px;
  }
  .upload-area :global(upload-files) {
    --icon-font-size: 32px;
    --message-margin: 4px 0;
    --message-margin-top: 4px;
  }
  .upload-area :global(upload-files)::part(dropzone) {
    min-height: 80px;
  }
  .current-pic {
    position: relative;
    margin-bottom: 8px;
    border-radius: 6px;
    overflow: hidden;
  }
  .current-pic :global(img) {
    width: 100%;
    height: auto;
    display: block;
  }
  .image-thumbs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .thumb {
    position: relative;
    width: 70px;
    height: 56px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid #ddd;
  }
  .thumb :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .remove-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    padding: 0 5px;
    font-size: 11px;
    background: rgba(0,0,0,0.6);
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    line-height: 18px;
  }
  .remove-btn:hover {
    background: rgba(200,0,0,0.8);
  }
  button {
    padding: 8px 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  }
  button.primary {
    background: #4CAF50;
    color: white;
    border-color: #4CAF50;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .file-section {
    flex-shrink: 0;
    margin-bottom: 8px;
    padding-top: 8px;
    border-top: 1px solid #eee;
  }
  .col-upload {
    width: 180px;
    flex-shrink: 0;
  }
  .file-attach-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 6px;
  }
  .file-attach-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
  }
  .file-attach-item.pending {
    background: #e8f5e9;
    border-color: #c8e6c9;
  }
  .file-attach-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-remove-btn {
    padding: 0 4px;
    font-size: 11px;
    background: none;
    border: 1px solid #ccc;
    border-radius: 3px;
    cursor: pointer;
    line-height: 16px;
    color: #888;
  }
  .file-remove-btn:hover {
    background: #fee;
    border-color: #c00;
    color: #c00;
  }
</style>
