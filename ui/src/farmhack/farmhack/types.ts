import type { EntryRecord } from '@holochain-open-dev/utils';
import {
  type Record,
  type ActionHash,
  type SignedActionHashed,
  type EntryHash,
  type AgentPubKey,
  type Create,
  type Update,
  type Delete,
  type CreateLink,
  type DeleteLink,
  type Timestamp,
  type HoloHash,
  encodeHashToBase64,
  decodeHashFromBase64
} from '@holochain/client';

// @ts-ignore
export const APP_VERSION = __APP_VERSION__

export const ROLE_NAME = "farmhack"
export const ZOME_NAME = "farmhack"
export const APP_ID = "farmhack"

export type FarmHackSignal = {
  type: 'EntryCreated';
  action: SignedActionHashed<Create>;
  app_entry: EntryTypes;
} | {
  type: 'EntryUpdated';
  action: SignedActionHashed<Update>;
  app_entry: EntryTypes;
  original_app_entry: EntryTypes;
} | {
  type: 'EntryDeleted';
  action: SignedActionHashed<Delete>;
  original_app_entry: EntryTypes;
} | {
  type: 'LinkCreated';
  action: SignedActionHashed<CreateLink>;
  link_type: string;
} | {
  type: 'LinkDeleted';
  action: SignedActionHashed<DeleteLink>;
  link_type: string;
};

export type EntryTypes =
| ({ type: 'Tool'; } & Tool)
| ({ type: 'Note'; } & Note)
| ({ type: 'ProxyAgent'; } & ProxyAgent);

export const ToolStatuses = [
  "Concept",
  "Prototype",
  "Functional Prototype",
  "Production Ready",
  "In Use",
];

export interface Tool {
  title: string;
  description: string;
  status: string;
  tags: Array<string>;
  pic?: EntryHash;
  trashed: boolean;
  license: string;
  wiki: string;
  wiki2: string;
  wiki3: string;
  video_url?: string;
  images: Array<EntryHash>;
}

export interface Info<T> {
  original_hash: ActionHash,
  record: EntryRecord<T>,
  relations: Array<RelationInfo>,
}

export interface UpdateToolInput {
  original_tool_hash: ActionHash,
  previous_tool_hash: ActionHash,
  updated_tool: Tool,
}

export interface Note {
  text: string,
  tool: ActionHash,
  pic?: EntryHash,
  tags: Array<string>,
  trashed: boolean,
}

export interface UpdateNoteInput {
  original_note_hash: ActionHash,
  previous_note_hash: ActionHash,
  updated_note: Note,
}

export interface ProxyAgent {
  nickname: string,
  bio: string,
  location: string,
  pic?: EntryHash,
}

export interface UpdateProxyAgentInput {
  original_hash: ActionHash,
  previous_hash: ActionHash,
  updated_proxy_agent: ProxyAgent,
}

export type AnyAgent =
  {type: 'ProxyAgent', hash: ActionHash} |
  {type: 'Agent', hash: AgentPubKey}

export interface RelationContent {
  path: string
  data: string
}

export interface Relation {
  src: HoloHash,
  dst: HoloHash,
  content: RelationContent,
}

export interface RelationInfo {
  create_link_hash: ActionHash,
  author: AgentPubKey,
  timestamp: Timestamp,
  relation: Relation,
}

export interface GetFeedInput {
  agent_filter?: AgentPubKey
  newer_than?: Timestamp
  older_than?: Timestamp
  count?: number
}

export enum FeedType {
  ToolNew = 0,
  ToolUpdate,
  ToolDelete,
  NoteNew,
  NoteUpdate,
  NoteDelete,
  ProxyAgentNew,
  ProxyAgentUpdate,
  ProxyAgentDelete,
}

export interface FeedElem {
  hash: ActionHash,
  timestamp: Timestamp,
  author: AgentPubKey,
  about: ActionHash,
  type: FeedType,
  detail: any,
}

export const getTypeName = (type: FeedType): string => {
  switch(type) {
    case FeedType.ToolNew: return "New Tool"
    case FeedType.ToolUpdate: return "Update Tool"
    case FeedType.ToolDelete: return "Delete Tool"
    case FeedType.NoteNew: return "New Comment"
    case FeedType.NoteUpdate: return "Update Comment"
    case FeedType.NoteDelete: return "Delete Comment"
    case FeedType.ProxyAgentNew: return "New Proxy Agent"
    case FeedType.ProxyAgentUpdate: return "Update Proxy Agent"
    case FeedType.ProxyAgentDelete: return "Delete Proxy Agent"
  }
  return "Unknown"
}

export const toolNotes = (tool: Info<Tool>): Array<ActionHash> => {
  return tool.relations.filter(r => r.relation.content.path == "tool.note").map(r => r.relation.dst)
}

export const toolTags = (tool: Info<Tool>): Array<string> => {
  const tagsMap: Record<string, number> = {}
  tool.relations.filter(r => r.relation.content.path == "tool.tag").forEach(r => tagsMap[r.relation.content.data] = (tagsMap[r.relation.content.data] || 0) + 1)
  return Object.keys(tagsMap).sort((a, b) => tagsMap[b] - tagsMap[a])
}

export interface AuthorInfo {
  agent: AnyAgent;
  name: string;
  relationHash: ActionHash;
}

// AgentPubKey prefix: hCAk (base64 pos 3 = 'A')
// EntryHash prefix:   hCEk (base64 pos 3 = 'E')
// AnyLinkableHash deserialization doesn't handle AgentPubKey,
// so we convert to EntryHash format for use in relation dst fields.
function setCharAt(str: string, index: number, chr: string): string {
  if (index > str.length - 1) return str;
  return str.substring(0, index) + chr + str.substring(index + 1);
}

export function agentToLinkable(pubKey: AgentPubKey): Uint8Array {
  return decodeHashFromBase64(setCharAt(encodeHashToBase64(pubKey), 3, 'E'));
}

export function linkableToAgent(hash: Uint8Array): AgentPubKey {
  return decodeHashFromBase64(setCharAt(encodeHashToBase64(hash), 3, 'A')) as AgentPubKey;
}

export const toolAuthors = (tool: Info<Tool>): Array<AuthorInfo> => {
  return tool.relations
    .filter(r => r.relation.content.path === "tool.author")
    .map(r => {
      let name = r.relation.content.data;
      let agentType: "Agent" | "ProxyAgent" = "ProxyAgent";
      try {
        const parsed = JSON.parse(r.relation.content.data);
        name = parsed.name || name;
        agentType = parsed.type || "ProxyAgent";
      } catch {
        // Old format: plain string name, assume ProxyAgent
      }
      const hash = agentType === "Agent" ? linkableToAgent(r.relation.dst) : r.relation.dst;
      return {
        agent: { type: agentType, hash } as AnyAgent,
        name,
        relationHash: r.create_link_hash,
      };
    });
}

export interface FileAttachment {
  fileHash: EntryHash;
  relationHash: ActionHash;
  name: string;
  file_type: string;
  size: number;
}

export const toolFiles = (tool: Info<Tool>, section: string): Array<FileAttachment> => {
  const path = `tool.file.${section}`;
  return tool.relations
    .filter(r => r.relation.content.path === path)
    .map(r => {
      let meta = { name: "File", file_type: "application/octet-stream", size: 0 };
      try { meta = { ...meta, ...JSON.parse(r.relation.content.data) }; } catch {}
      return {
        fileHash: r.relation.dst as EntryHash,
        relationHash: r.create_link_hash,
        name: meta.name,
        file_type: meta.file_type,
        size: meta.size,
      };
    });
}

export enum DetailsType {
  Tool = 0,
  Folk,
  ProxyAgent,
}

export interface Details {
  type: DetailsType,
  hash: ActionHash,
}

export interface UIProps {
  pane: string,
  detailsStack: Array<Details>,
}
