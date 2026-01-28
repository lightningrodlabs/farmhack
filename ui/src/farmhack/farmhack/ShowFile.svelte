<script lang="ts">
  import { onMount } from "svelte";
  import type { EntryHash } from "@holochain/client";
  import { getStoreContext } from "../../contexts";

  export let fileHash: EntryHash;

  const store = getStoreContext();
  let dataUrl: string | undefined;

  onMount(async () => {
    try {
      const file = await store.fileStorageClient.downloadFile(fileHash);
      const reader = new FileReader();
      reader.onload = () => {
        dataUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error("Error loading file:", e);
    }
  });
</script>

{#if dataUrl}
  <img src={dataUrl} alt="" style="max-width: 100%; height: auto; border-radius: 4px;" />
{:else}
  <div style="width: 100%; height: 60px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px;">
    <span style="opacity: 0.4; font-size: 12px;">Loading...</span>
  </div>
{/if}
