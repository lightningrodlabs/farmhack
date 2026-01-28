<script lang="ts">
    import { decodeHashFromBase64, encodeHashToBase64, type ActionHash, type EntryHash } from "@holochain/client";
    import { storeContext, cloneManagerStoreContext } from '../../contexts';
    import type { FarmHackStore } from '../../stores/farmhack-store';
    import type { CloneManagerStore } from '../../stores/clone-manager-store';
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import type { Info, Tool, Note, ProxyAgent } from "./types";
    import { APP_VERSION } from "./types";
    import { get } from "svelte/store";
    import { toPromise } from "@holochain-open-dev/stores";

    // Helper function to convert Uint8Array to base64
    function uint8ArrayToBase64(bytes: Uint8Array): string {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Helper function to convert base64 to Uint8Array
    function base64ToUint8Array(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // Helper function to sanitize filename
    function sanitizeFilename(name: string): string {
        return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 255);
    }

    let store: FarmHackStore = (getContext(storeContext) as any).getStore();
    let exportJSON = "";
    const dispatch = createEventDispatcher();

    const { getStore: getCloneStore }: any = getContext(cloneManagerStoreContext);
    let cloneManagerStore: CloneManagerStore = getCloneStore();

    $: activeDnaHash = cloneManagerStore.activeDnaHash;
    $: activeDnaHashB64 = encodeHashToBase64($activeDnaHash);
    $: proxyAgents = store.proxyAgents;

    onMount(async () => {
        await store.fetchProxyAgents();
    });

    const download = (filename: string, text: string) => {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

    const serializeInfo = async (info: Info<any>, hasPic: boolean): Promise<any> => {
        let entry = { ...info.record.entry };
        if (hasPic && entry.pic) {
            try {
                const file = await store.fileStorageClient.downloadFile(entry.pic);
                const data = await file.arrayBuffer();
                entry.pic_hash = encodeHashToBase64(entry.pic);
                delete entry.pic;
                entry.pic_data = uint8ArrayToBase64(new Uint8Array(data));
                entry.pic_file = {
                    name: file.name,
                    size: file.size,
                    file_type: file.type,
                    last_modified: file.lastModified,
                };
            } catch (e) {
                console.log("Error downloading file", e);
            }
        }
        const obj = {
            original_hash: encodeHashToBase64(info.original_hash),
            entry,
            relations: info.relations.map(ri => {
                const rel = {
                    timestamp: ri.timestamp,
                    src: encodeHashToBase64(ri.relation.src),
                    dst: encodeHashToBase64(ri.relation.dst),
                    content: ri.relation.content
                };
                return rel;
            })
        };
        return obj;
    }

    const doExport = async () => {
        const tools = [];
        for (const t of get(store.tools)) {
            tools.push(await serializeInfo(t, true));
        }

        const notes = [];
        for (const [hash, n] of get(store.notes)) {
            notes.push(await serializeInfo(n, true));
        }

        const proxyAgentsData = [];
        for (const p of get(store.proxyAgents)) {
            proxyAgentsData.push(await serializeInfo(p, true));
        }

        const agents = [];
        for (const [agentKey, profile] of await toPromise(store.profilesStore.allProfiles)) {
            agents.push({
                pubKey: encodeHashToBase64(agentKey),
                nickname: profile.entry.nickname,
                bio: profile.entry.fields.bio,
                location: profile.entry.fields.location
            });
        }

        exportJSON = JSON.stringify({
            tools,
            notes,
            proxyAgents: proxyAgentsData,
            agents
        });
        const fileName = sanitizeFilename(`farmhack.json`);
        download(fileName, exportJSON);
    }

    let fileinput;
    const onFileSelected = (e) => {
        let file = e.target.files[0];
        let reader = new FileReader();

        reader.addEventListener("load", async () => {
            const b = JSON.parse(reader.result as string);
            doImport(b);
        }, false);
        reader.readAsText(file);
    };

    let uploadedPics = {};

    const uploadImportedFile = async (e): Promise<EntryHash | undefined> => {
        let pic = undefined;
        if (e.pic_data) {
            const file = new File([base64ToUint8Array(e.pic_data)], e.pic_file.name, {
                lastModified: e.pic_file.last_modified,
                type: e.pic_file.file_type,
            });
            pic = await store.fileStorageClient.uploadFile(file);
            uploadedPics[e.pic_hash] = pic;
        }
        return pic;
    }

    const doImport = async (data: any) => {
        // Import proxy agents first
        const proxyAgentsMap = {};
        if (data.proxyAgents) {
            for (const p of data.proxyAgents) {
                const e = p.entry;
                let pic = await uploadImportedFile(e);
                const actionHash = await store.createProxyAgent(e.nickname, e.bio, e.location, pic);
                proxyAgentsMap[p.original_hash] = actionHash;
            }
        }

        // Import tools
        const toolsMap = {};
        if (data.tools) {
            for (const t of data.tools) {
                const e = t.entry;
                let pic = await uploadImportedFile(e);
                const tool: Tool = {
                    title: e.title,
                    description: e.description,
                    status: e.status,
                    tags: e.tags || [],
                    pic,
                    trashed: e.trashed || false,
                };
                const actionHash = await store.createTool(tool);
                toolsMap[t.original_hash] = actionHash;

                // Create relations for this tool
                if (t.relations) {
                    for (const rel of t.relations) {
                        // Map destination hashes if they refer to imported items
                        let dst = toolsMap[rel.dst] || decodeHashFromBase64(rel.dst);
                        await store.createRelations([{
                            src: actionHash,
                            dst,
                            content: rel.content
                        }]);
                    }
                }
            }
        }

        // Import notes
        if (data.notes) {
            for (const n of data.notes) {
                const e = n.entry;
                if (!e.trashed) {
                    let pic = await uploadImportedFile(e);
                    // Map tool reference to imported tool
                    const toolHash = toolsMap[encodeHashToBase64(e.tool)] || e.tool;
                    const note: Note = {
                        text: e.text,
                        tool: typeof toolHash === 'string' ? decodeHashFromBase64(toolHash) : toolHash,
                        pic,
                        tags: e.tags || [],
                        trashed: false,
                    };
                    await store.createNote(note);
                }
            }
        }

        // Refresh data
        await store.fetchTools();
        await store.fetchProxyAgents();
    }
</script>

<input style="display:none" type="file" accept=".json" on:change={(e) => onFileSelected(e)} bind:this={fileinput}>

<div class="pane-header">
    <div class="header-content">
        <h3>Admin</h3>
        <div style="display:flex">
            <button on:click={() => dispatch('admin-close')}>Close</button>
        </div>
    </div>
</div>
<div class="pane-content admin-content">
    <div class="admin-header">
        <h2>FarmHack v{APP_VERSION}: Administration</h2>
        <p>Use the buttons below to configure and administer your FarmHack instance.</p>
    </div>
    <div class="admin-controls">
        <div class="admin-section">
            <div class="admin-section-desc">
                <h3>Proxy Agents</h3>
                <p>Create participant records for people who will contribute but not use the app directly.</p>
            </div>
            <div class="admin-section-right">
                <strong>Proxy Agents</strong>: {$proxyAgents.length}
                <button on:click={() => dispatch('open-proxyagents')}>
                    Manage Proxy Agents
                </button>
            </div>
        </div>

        <div class="admin-section">
            <div class="admin-section-desc">
                <h3>Import/Export</h3>
                <p>Export all data to JSON or import from a previous export.</p>
            </div>
            <div style="display:flex; flex-direction: row; gap: 8px;">
                <button on:click={async () => await doExport()}>
                    Export
                </button>
                <button on:click={() => fileinput.click()}>
                    Import
                </button>
            </div>
        </div>

        <div class="admin-section" style="flex-direction:column">
            <div style="flex-direction:row;display:flex; justify-content:space-between">
                <div class="admin-section-desc">
                    <h3>Active Network DNA Hash</h3>
                    <p style="font-size: 0.8rem; word-break: break-all;">{activeDnaHashB64}</p>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .admin-content {
        padding: 16px;
    }

    .admin-controls {
        display: flex;
        flex-direction: column;
        width: 100%;
        justify-content: center;
        margin: 0 auto;
    }

    .admin-section {
        display: flex;
        max-width: 720px;
        width: 100%;
        justify-content: space-between;
        margin: 0 auto;
        margin-bottom: 20px;
        border-radius: 10px;
        border: solid 1px #ddd;
        padding: 16px;
    }

    .admin-section-desc h3 {
        margin: 0 0 8px 0;
    }

    .admin-section-desc p {
        margin: 0;
        color: #666;
    }

    .admin-section-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
    }

    .header-content h3 {
        text-align: center;
        width: 100%;
    }

    .admin-header {
        margin-bottom: 20px;
        text-align: center;
        width: 100%;
    }

    button {
        padding: 8px 16px;
        border-radius: 4px;
        border: 1px solid #ccc;
        background: white;
        cursor: pointer;
    }

    button:hover {
        background: #f0f0f0;
    }
</style>
