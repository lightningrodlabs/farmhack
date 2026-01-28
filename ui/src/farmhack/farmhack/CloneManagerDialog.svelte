<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { getCloneManagerContext } from "../../contexts";
  import type { CellInfoNormalized } from "../../stores/clone-manager-store";

  const cloneManager = getCloneManagerContext();
  const dispatch = createEventDispatcher();

  let cells: CellInfoNormalized[] = [];
  let newName = "";
  let joinSeed = "";
  let mode: "list" | "create" | "join" = "list";

  onMount(async () => {
    cells = await cloneManager.list();
  });

  async function handleCreate() {
    if (!newName.trim()) return;
    await cloneManager.create(newName.trim());
    cells = await cloneManager.list();
    mode = "list";
    newName = "";
  }

  async function handleJoin() {
    if (!newName.trim() || !joinSeed.trim()) return;
    await cloneManager.join(newName.trim(), joinSeed.trim());
    cells = await cloneManager.list();
    mode = "list";
    newName = "";
    joinSeed = "";
  }

  function activate(cell: CellInfoNormalized) {
    cloneManager.activate(cell.cellId);
    dispatch("close");
    location.reload();
  }
</script>

<div class="modal-overlay">
  <div class="modal-content">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h3 style="margin: 0;">Spaces</h3>
      <button on:click={() => dispatch("close")} style="border: none; background: none; cursor: pointer; font-size: 18px;">x</button>
    </div>

    {#if mode === "list"}
      <div style="margin-bottom: 16px;">
        {#each cells as cell}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 4px;">
            <span>{cell.displayName}</span>
            <button on:click={() => activate(cell)} style="border: 1px solid #ddd; background: white; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
              Switch
            </button>
          </div>
        {/each}
      </div>

      <div style="display: flex; gap: 8px;">
        <button on:click={() => mode = "create"}>Create New</button>
        <button on:click={() => mode = "join"}>Join Existing</button>
      </div>
    {:else if mode === "create"}
      <label>
        Name
        <input type="text" bind:value={newName} placeholder="Space name" />
      </label>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button on:click={() => mode = "list"}>Back</button>
        <button class="primary" on:click={handleCreate} disabled={!newName.trim()}>Create</button>
      </div>
    {:else}
      <label>
        Name
        <input type="text" bind:value={newName} placeholder="Space name" />
      </label>
      <label>
        Network Seed
        <input type="text" bind:value={joinSeed} placeholder="Paste network seed" />
      </label>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button on:click={() => mode = "list"}>Back</button>
        <button class="primary" on:click={handleJoin} disabled={!newName.trim() || !joinSeed.trim()}>Join</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
  }
  .modal-content {
    background: white; padding: 24px; border-radius: 8px;
    width: 90%; max-width: 400px;
  }
  label { display: flex; flex-direction: column; margin-bottom: 8px; font-size: 13px; }
  input { margin-top: 4px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
  button { padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; }
  button.primary { background: #4CAF50; color: white; border-color: #4CAF50; }
  button:disabled { opacity: 0.5; }
</style>
