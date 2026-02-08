import type {
  Record,
  AppClient,
  EntryHash,
  AgentPubKey,
  ActionHash,
  RoleName,
  ZomeName
} from '@holochain/client';
import type { Tool, UpdateToolInput, Note, UpdateNoteInput, Relation, RelationInfo, GetFeedInput, FeedElem, Info, ProxyAgent, UpdateProxyAgentInput } from './farmhack/farmhack/types';

export class FarmHackClient {
  constructor(public client: AppClient, public roleName: RoleName, public zomeName: ZomeName = 'farmhack') {}

  async createTool(tool: Tool): Promise<Record> {
    return this.callZome('create_tool', tool);
  }

  async getTool(toolHash: ActionHash): Promise<Record | undefined> {
    return this.callZome('get_tool', toolHash);
  }

  async updateTool(input: UpdateToolInput): Promise<Record> {
    return this.callZome('update_tool', input);
  }

  async deleteTool(toolHash: ActionHash): Promise<ActionHash> {
    return this.callZome('delete_tool', toolHash);
  }

  async getAllTools(): Promise<Array<any>> {
    return this.callZome('get_all_tools', null);
  }

  async createNote(note: Note): Promise<Record> {
    return this.callZome('create_note', note);
  }

  async getNote(noteHash: ActionHash): Promise<Record | undefined> {
    return this.callZome('get_note', noteHash);
  }

  async updateNote(input: UpdateNoteInput): Promise<Record> {
    return this.callZome('update_note', input);
  }

  async deleteNote(noteHash: ActionHash): Promise<ActionHash> {
    return this.callZome('delete_note', noteHash);
  }

  async createRelations(relations: Array<Relation>): Promise<Array<ActionHash>> {
    return this.callZome('create_relations', relations);
  }

  async deleteRelations(hashes: Array<ActionHash>): Promise<void> {
    return this.callZome('delete_relations', hashes);
  }

  async getFeed(input: GetFeedInput): Promise<Array<FeedElem>> {
    const relations: Array<RelationInfo> = await this.callZome('get_feed', input);
    return relations.map(ri => {
      const r = ri.relation;
      const author = r.src;
      (author as any)[1] = 32;
      return {
        hash: ri.create_link_hash,
        timestamp: ri.timestamp / 1000,
        author,
        about: r.dst,
        type: parseInt(r.content.path.split(".")[1]),
        detail: JSON.parse(r.content.data),
      };
    });
  }

  async createProxyAgent(proxyAgent: ProxyAgent): Promise<Record> {
    return this.callZome('create_proxy_agent', proxyAgent);
  }

  async getProxyAgent(proxyAgentHash: ActionHash): Promise<Record | undefined> {
    return this.callZome('get_proxy_agent', proxyAgentHash);
  }

  async updateProxyAgent(input: UpdateProxyAgentInput): Promise<Record> {
    return this.callZome('update_proxy_agent', input);
  }

  async deleteProxyAgent(proxyAgentHash: ActionHash): Promise<ActionHash> {
    return this.callZome('delete_proxy_agent', proxyAgentHash);
  }

  async getAllProxyAgents(): Promise<Array<any>> {
    return this.callZome('get_all_proxy_agents', null);
  }

  private callZome(fn_name: string, payload: any) {
    return this.client.callZome({
      role_name: this.roleName,
      zome_name: this.zomeName,
      fn_name,
      payload,
    });
  }
}
