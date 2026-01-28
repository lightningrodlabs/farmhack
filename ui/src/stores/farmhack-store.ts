import { writable, derived, get, type Writable } from "svelte/store";
import type { ProfilesStore } from "@holochain-open-dev/profiles";
import type { FileStorageClient } from "@holochain-open-dev/file-storage";
import type { ActionHash, DnaHash, EntryHash, AgentPubKey } from "@holochain/client";
import type { FarmHackClient } from "../farmhack-client";
import type { Info, Tool, Note, UIProps, RelationInfo, Relation } from "../farmhack/farmhack/types";
import { EntryRecord } from "@holochain-open-dev/utils";
import type { CloneManagerStore } from "./clone-manager-store";
import { encodeHashToBase64 } from "@holochain/client";

export class FarmHackStore {
  tools: Writable<Array<Info<Tool>>> = writable([]);
  notes: Writable<Map<string, Info<Note>>> = writable(new Map());
  uiProps: Writable<UIProps> = writable({
    pane: "tools",
    detailHash: undefined,
  });

  constructor(
    public cloneManager: CloneManagerStore,
    public client: FarmHackClient,
    public profilesStore: ProfilesStore,
    public fileStorageClient: FileStorageClient,
    public activeDnaHash: DnaHash,
  ) {}

  async fetchTools() {
    const toolInfos = await this.client.getAllTools();
    const tools: Array<Info<Tool>> = toolInfos.map((ti: any) => ({
      original_hash: ti.original_hash,
      record: new EntryRecord(ti.record),
      relations: ti.relations,
    }));
    this.tools.set(tools);
  }

  getTool(hash: ActionHash): Info<Tool> | undefined {
    const hashB64 = encodeHashToBase64(hash);
    return get(this.tools).find(t => encodeHashToBase64(t.original_hash) === hashB64);
  }

  async fetchNote(hashes: Array<ActionHash>) {
    const currentNotes = get(this.notes);
    for (const hash of hashes) {
      const record = await this.client.getNote(hash);
      if (record) {
        const entryRecord = new EntryRecord<Note>(record);
        currentNotes.set(encodeHashToBase64(hash), {
          original_hash: hash,
          record: entryRecord,
          relations: [],
        });
      }
    }
    this.notes.set(currentNotes);
  }

  async createTool(tool: Tool): Promise<ActionHash> {
    const record = await this.client.createTool(tool);
    await this.fetchTools();
    return new EntryRecord(record).actionHash;
  }

  async updateTool(originalHash: ActionHash, previousHash: ActionHash, tool: Tool): Promise<void> {
    await this.client.updateTool({
      original_tool_hash: originalHash,
      previous_tool_hash: previousHash,
      updated_tool: tool,
    });
    await this.fetchTools();
  }

  async createNote(note: Note): Promise<ActionHash> {
    const record = await this.client.createNote(note);
    const actionHash = new EntryRecord(record).actionHash;
    return actionHash;
  }

  async createRelations(relations: Array<Relation>): Promise<Array<ActionHash>> {
    return this.client.createRelations(relations);
  }

  async deleteRelations(hashes: Array<ActionHash>): Promise<void> {
    return this.client.deleteRelations(hashes);
  }

  setUIprops(props: Partial<UIProps>) {
    this.uiProps.update(p => ({ ...p, ...props }));
  }

  openToolDetail(hash: ActionHash) {
    this.setUIprops({ detailHash: hash });
  }

  closeDetail() {
    this.setUIprops({ detailHash: undefined });
  }
}
