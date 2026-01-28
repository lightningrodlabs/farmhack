<script lang="ts">
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();
</script>

<button on:click={() => dispatch('click')} style="border: 1px solid #ddd; background: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
  Spaces
</button>
