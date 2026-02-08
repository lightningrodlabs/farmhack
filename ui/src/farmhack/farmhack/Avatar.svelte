<script lang="ts">
    import { encodeHashToBase64, type AgentPubKey } from "@holochain/client";
    import "@holochain-open-dev/profiles/dist/elements/agent-avatar.js";
    import { storeContext } from '../../contexts';
    import type { FarmHackStore } from '../../stores/farmhack-store';
    import { getContext } from "svelte";
    import { DetailsType } from "./types";
    import type { AsyncStatus } from "@holochain-open-dev/stores";
    import type { Profile } from "@holochain-open-dev/profiles";

    let store: FarmHackStore = (getContext(storeContext) as any).getStore();

    export let agentPubKey: AgentPubKey;
    export let size = 32;
    export let namePosition = "row";
    export let showAvatar = true;
    export let showNickname = true;

    $: agentPubKey;
    $: s = store.profilesStore.profiles.get(agentPubKey);
    $: profile = $s.status == "complete" ? $s.value : undefined;

    const getNickName = (asyncProfile: AsyncStatus<Profile>): string => {
        if (asyncProfile.status != "complete") return "...";
        return asyncProfile.value ? asyncProfile.value.nickname : "?";
    }
</script>

<div class="avatar-{namePosition}"
    class:clickable={profile}
    on:click={(e) => {
        if (profile) {
            store.openDetails(DetailsType.Folk, agentPubKey);
            e.stopPropagation();
        }
    }}
    on:keypress={() => {}}
>
    {#if showAvatar}
        <agent-avatar disable-tooltip={true} disable-copy={true} size={size} agent-pub-key="{encodeHashToBase64(agentPubKey)}"></agent-avatar>
    {/if}
    {#if showNickname}
        <div class="nickname">{profile ? profile.entry.nickname : encodeHashToBase64(agentPubKey).slice(0, 8) + "..."}</div>
    {/if}
</div>

<style>
    .avatar-column {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .avatar-row {
        display: inline-flex;
        flex-direction: row;
        justify-content: center;
        position: relative;
        height: 100%;
        align-items: center;
    }

    .avatar-row agent-avatar {
        margin-right: 0.5em;
    }

    .clickable {
        cursor: pointer;
    }

    .nickname {
        font-size: 0.9em;
    }
</style>
