import { getContext } from "svelte";
import type { FarmHackStore } from "./stores/farmhack-store";
import type { CloneManagerStore } from "./stores/clone-manager-store";

export const clientContext = 'appAgentClient';
export const storeContext = 'farmhackStore'
export const cloneManagerStoreContext = 'cloneManagerStore'

export function getStoreContext(): FarmHackStore {
  return (getContext(storeContext) as any).getStore();
}

export function getCloneManagerContext(): CloneManagerStore {
  return (getContext(cloneManagerStoreContext) as any).getStore();
}
