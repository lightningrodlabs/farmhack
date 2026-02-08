<script lang="ts">
  import { getContext } from "svelte";
  import { encodeHashToBase64 } from "@holochain/client";
  import { storeContext } from "../../contexts";
  import type { FarmHackStore } from "../../stores/farmhack-store";
  import "@holochain-open-dev/profiles/dist/elements/agent-avatar.js";
  import "@holochain-open-dev/profiles/dist/elements/update-profile.js";

  let store: FarmHackStore = (getContext(storeContext) as any).getStore();

  $: myProfile = store.profilesStore.myProfile;
  $: profile = $myProfile.status === "complete" ? $myProfile.value : undefined;
  $: fields = profile
    ? Object.entries(profile.entry.fields).filter(([k, _]) => k !== "avatar")
    : [];

  let editing = false;
</script>

<div class="my-profile">
  {#if $myProfile.status !== "complete"}
    <div class="center">Loading profile...</div>
  {:else if !profile}
    <div class="center">No profile found.</div>
  {:else}
    <div class="profile-card">
      <div class="profile-header">
        <agent-avatar
          disable-tooltip={true}
          disable-copy={true}
          size={64}
          agent-pub-key={encodeHashToBase64(store.myPubKey)}
        ></agent-avatar>
        <div class="profile-info">
          <h2>{profile.entry.nickname}</h2>
          {#each fields as [label, value]}
            {#if value}
              <div class="field">
                <span class="field-label">{label}:</span>
                <span>{value}</span>
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <button class="edit-btn" on:click={() => editing = true}>Edit Profile</button>
    </div>

    {#if editing}
      <div class="edit-overlay" on:click|self={() => editing = false} on:keypress={() => {}}>
        <div class="edit-dialog">
          <div class="edit-dialog-header">
            <h3>Edit Profile</h3>
            <button class="close-btn" on:click={() => editing = false}>&#10005;</button>
          </div>
          <update-profile
            on:cancel-edit-profile={() => editing = false}
            on:profile-updated={() => editing = false}
          ></update-profile>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .my-profile {
    padding: 16px;
  }
  .center {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px;
    opacity: 0.5;
  }
  .profile-card {
    max-width: 500px;
    margin: 0 auto;
  }
  .profile-header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
  }
  .profile-info {
    flex: 1;
  }
  .profile-info h2 {
    margin: 0 0 8px 0;
  }
  .field {
    font-size: 14px;
    color: var(--muted-text-color);
    margin-bottom: 4px;
  }
  .field-label {
    font-weight: 600;
    text-transform: capitalize;
  }
  .edit-btn {
    padding: 6px 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 13px;
    color: var(--muted-text-color);
  }
  .edit-btn:hover {
    background: #f5f5f5;
    border-color: #bbb;
  }
  .edit-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
  }
  .edit-dialog {
    background: white;
    border-radius: 8px;
    padding: 20px;
    max-width: 400px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
  }
  .edit-dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .edit-dialog-header h3 {
    margin: 0;
  }
  .close-btn {
    border: none;
    background: none;
    font-size: 18px;
    cursor: pointer;
    color: var(--muted-text-color);
    padding: 4px;
  }
  .close-btn:hover {
    color: var(--dark-text-color);
  }
</style>
