import { CellType, type AppClient, type DnaHash, type EntryHash } from "@holochain/client"

export const truncateText = (text: string, len: number) => {
  if (text.length <= len) return text
  return `${text.slice(0, len)}...`
}

export const errorText = (e: any) => {
  return e.data ? e.data : e
}

export const wait = (milliseconds: number) => {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

export type WALUrl = string

export const hashEqual = (a: EntryHash, b: EntryHash): boolean => {
  if (!a || !b) {
    return !a && !b
  }
  for (let i = a.length; -1 < i; i -= 1) {
    if ((a[i] !== b[i])) return false;
  }
  return true;
}

export const getMyDna = async (role: string, client: AppClient): Promise<DnaHash> => {
  const appInfo = await client.appInfo();
  const dnaHash = (appInfo.cell_info[role][0] as any)[
    CellType.Provisioned
  ].cell_id[0];
  return dnaHash
}

export const isTauriContext = () => (window as any).__TAURI_INTERNALS__ !== undefined;
