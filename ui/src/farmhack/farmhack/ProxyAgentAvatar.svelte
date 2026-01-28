<script lang="ts">
    import { encodeHashToBase64, type ActionHash } from "@holochain/client";
    import "@holochain-open-dev/elements/dist/elements/holo-identicon.js";
    import "@holochain-open-dev/file-storage/dist/elements/show-image.js";
    import { storeContext } from '../../contexts';
    import type { FarmHackStore } from '../../stores/farmhack-store';
    import { getContext } from "svelte";

    let store: FarmHackStore = (getContext(storeContext) as any).getStore();

    export let proxyAgentHash: ActionHash;
    export let size = 32;

    $: proxyAgentHash;
    $: proxyAgent = store.getProxyAgent(proxyAgentHash);
</script>

<div class="avatar">
    {#if proxyAgent?.record.entry.pic}
        <div class="pic" style="width:{size}px;height:{size}px;">
            <show-image style="width:{size}px;height:{size}px;" image-hash={encodeHashToBase64(proxyAgent.record.entry.pic)}></show-image>
        </div>
    {:else}
        <holo-identicon disable-tooltip={true} disable-copy={true} size={size} hash={proxyAgentHash}></holo-identicon>
    {/if}
</div>

<style>
    .pic {
        border-radius: 50%;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .avatar {
        display: inline-flex;
    }
</style>
