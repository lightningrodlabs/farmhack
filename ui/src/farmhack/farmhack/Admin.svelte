<script lang="ts">
    import { decodeHashFromBase64, encodeHashToBase64, type ActionHash, type EntryHash } from "@holochain/client";
    import { storeContext, cloneManagerStoreContext } from '../../contexts';
    import type { FarmHackStore } from '../../stores/farmhack-store';
    import type { CloneManagerStore } from '../../stores/clone-manager-store';
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import type { Info, Tool, Note, ProxyAgent } from "./types";
    import { APP_VERSION, agentToLinkable } from "./types";
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

    const serializeFile = async (hash: EntryHash): Promise<any> => {
        try {
            const file = await store.fileStorageClient.downloadFile(hash);
            const data = await file.arrayBuffer();
            return {
                hash: encodeHashToBase64(hash),
                data: uint8ArrayToBase64(new Uint8Array(data)),
                file: {
                    name: file.name,
                    size: file.size,
                    file_type: file.type,
                    last_modified: file.lastModified,
                },
            };
        } catch (e) {
            console.log("Error downloading file", e);
            return null;
        }
    }

    const serializeInfo = async (info: Info<any>, hasPic: boolean): Promise<any> => {
        let entry = { ...info.record.entry };
        if (hasPic && entry.pic) {
            const serialized = await serializeFile(entry.pic);
            if (serialized) {
                entry.pic_hash = serialized.hash;
                delete entry.pic;
                entry.pic_data = serialized.data;
                entry.pic_file = serialized.file;
            }
        }
        // Serialize images array
        if (entry.images && entry.images.length > 0) {
            const serializedImages = [];
            for (const imgHash of entry.images) {
                const serialized = await serializeFile(imgHash);
                if (serialized) {
                    serializedImages.push(serialized);
                }
            }
            entry.images_data = serializedImages;
            delete entry.images;
        }
        const serializedRelations = [];
        for (const ri of info.relations) {
            const rel: any = {
                timestamp: ri.timestamp,
                src: encodeHashToBase64(ri.relation.src),
                dst: encodeHashToBase64(ri.relation.dst),
                content: ri.relation.content
            };
            // Serialize file data for file attachment relations
            if (ri.relation.content.path.startsWith("tool.file.")) {
                const fileSerialized = await serializeFile(ri.relation.dst as EntryHash);
                if (fileSerialized) {
                    rel.file_data = fileSerialized.data;
                    rel.file_info = fileSerialized.file;
                }
            }
            serializedRelations.push(rel);
        }
        const obj = {
            original_hash: encodeHashToBase64(info.original_hash),
            entry,
            relations: serializedRelations
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

    let importStatus = "";
    let importProgress = "";

    const doImport = async (data: any) => {
        const hashMap: Record<string, ActionHash> = {};
        const claimedHashes = new Set<string>(); // placeholder hashes that map to real agent
        const deferredRelations: Array<{src: string, rel: any}> = [];

        // Get current user's profile nickname for auto-claim
        let myNickname = "";
        try {
            const myProfile = await toPromise(store.profilesStore.myProfile);
            if (myProfile) myNickname = myProfile.entry.nickname.toLowerCase().trim();
        } catch {}

        // Import proxy agents first (auto-claim matching ones)
        if (data.proxyAgents) {
            importStatus = "Importing proxy agents...";
            for (let i = 0; i < data.proxyAgents.length; i++) {
                const p = data.proxyAgents[i];
                importProgress = `${i + 1}/${data.proxyAgents.length}`;
                try {
                    const e = p.entry;
                    // Auto-claim: if proxy agent nickname matches current user, use real agent pubkey
                    if (myNickname && e.nickname.toLowerCase().trim() === myNickname) {
                        hashMap[p.original_hash] = agentToLinkable(store.myPubKey);
                        claimedHashes.add(p.original_hash);
                        console.log(`Auto-claimed proxy agent "${e.nickname}" as current user`);
                        continue;
                    }
                    let pic = await uploadImportedFile(e);
                    const actionHash = await store.createProxyAgent(e.nickname, e.bio, e.location, pic);
                    hashMap[p.original_hash] = actionHash;
                } catch (err) {
                    console.error(`Error importing proxy agent ${p.entry?.nickname}:`, err);
                }
            }
        }

        // Import tools
        if (data.tools) {
            importStatus = "Importing tools...";
            for (let i = 0; i < data.tools.length; i++) {
                const t = data.tools[i];
                importProgress = `${i + 1}/${data.tools.length}`;
                try {
                    const e = t.entry;
                    let pic = await uploadImportedFile(e);

                    // Upload gallery images
                    let images: EntryHash[] = [];
                    if (e.images_data && e.images_data.length > 0) {
                        for (const imgData of e.images_data) {
                            try {
                                const file = new File([base64ToUint8Array(imgData.data)], imgData.file.name, {
                                    lastModified: imgData.file.last_modified,
                                    type: imgData.file.file_type,
                                });
                                const hash = await store.fileStorageClient.uploadFile(file);
                                images.push(hash);
                            } catch (imgErr) {
                                console.warn(`  Warning: failed to upload image for ${e.title}:`, imgErr);
                            }
                        }
                    }

                    const tool: Tool = {
                        title: e.title,
                        description: e.description || "",
                        status: e.status || "Concept",
                        tags: e.tags || [],
                        pic,
                        trashed: e.trashed || false,
                        license: e.license || "",
                        wiki: e.wiki || "",
                        wiki2: e.wiki2 || "",
                        wiki3: e.wiki3 || "",
                        video_url: e.video_url || null,
                        images,
                    };
                    const actionHash = await store.createTool(tool);
                    hashMap[t.original_hash] = actionHash;

                    // Create relations for this tool
                    if (t.relations) {
                        for (const rel of t.relations) {
                            // Handle file-bearing relations (e.g. tool.file.manual)
                            if (rel.file_data && rel.file_info) {
                                try {
                                    const file = new File([base64ToUint8Array(rel.file_data)], rel.file_info.name, {
                                        lastModified: rel.file_info.last_modified,
                                        type: rel.file_info.file_type,
                                    });
                                    const fileHash = await store.fileStorageClient.uploadFile(file);
                                    await store.createRelations([{
                                        src: actionHash,
                                        dst: fileHash,
                                        content: rel.content
                                    }]);
                                } catch (relErr) {
                                    console.warn(`  Warning: failed to upload/create file relation for ${e.title}:`, relErr);
                                }
                                continue;
                            }
                            const dst = hashMap[rel.dst];
                            if (dst) {
                                try {
                                    // For tool.author relations, use JSON format with agent type
                                    let content = rel.content;
                                    if (rel.content.path === "tool.author") {
                                        const agentType = claimedHashes.has(rel.dst) ? "Agent" : "ProxyAgent";
                                        const name = rel.content.data || "";
                                        content = { path: "tool.author", data: JSON.stringify({ name, type: agentType }) };
                                    }
                                    await store.createRelations([{
                                        src: actionHash,
                                        dst,
                                        content
                                    }]);
                                } catch (relErr) {
                                    console.warn(`  Warning: failed to create relation for ${e.title}:`, relErr);
                                }
                            } else {
                                // Destination not yet imported, defer
                                deferredRelations.push({ src: t.original_hash, rel });
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error importing tool [${i + 1}] ${t.entry?.title}:`, err);
                }
            }
        }

        // Second pass: create deferred cross-tool relations
        if (deferredRelations.length > 0) {
            importStatus = "Creating cross-tool relations...";
            for (let i = 0; i < deferredRelations.length; i++) {
                const { src, rel } = deferredRelations[i];
                importProgress = `${i + 1}/${deferredRelations.length}`;
                const srcHash = hashMap[src];
                const dstHash = hashMap[rel.dst];
                if (srcHash && dstHash) {
                    try {
                        let content = rel.content;
                        if (rel.content.path === "tool.author") {
                            const agentType = claimedHashes.has(rel.dst) ? "Agent" : "ProxyAgent";
                            const name = rel.content.data || "";
                            content = { path: "tool.author", data: JSON.stringify({ name, type: agentType }) };
                        }
                        await store.createRelations([{
                            src: srcHash,
                            dst: dstHash,
                            content
                        }]);
                    } catch (err) {
                        console.warn(`  Warning: failed deferred relation:`, err);
                    }
                }
            }
        }

        // Import notes
        if (data.notes) {
            importStatus = "Importing comments...";
            for (let i = 0; i < data.notes.length; i++) {
                const n = data.notes[i];
                importProgress = `${i + 1}/${data.notes.length}`;
                try {
                    const e = n.entry;
                    if (!e.trashed) {
                        let pic = await uploadImportedFile(e);
                        // Map tool reference: could be a placeholder hash string or already a Uint8Array
                        const toolHash = hashMap[typeof e.tool === 'string' ? e.tool : encodeHashToBase64(e.tool)];
                        if (toolHash) {
                            const note: Note = {
                                text: e.text,
                                tool: toolHash,
                                pic,
                                tags: e.tags || [],
                                trashed: false,
                            };
                            const noteHash = await store.createNote(note);
                            // Link note to tool
                            await store.createRelations([{
                                src: toolHash,
                                dst: noteHash,
                                content: { path: "tool.note", data: "" }
                            }]);
                        }
                    }
                } catch (err) {
                    console.error(`Error importing note [${i + 1}]:`, err);
                }
            }
        }

        // Refresh data
        importStatus = "Refreshing...";
        await store.fetchTools();
        await store.fetchProxyAgents();
        importStatus = "";
        importProgress = "";
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
                {#if importStatus}
                    <p style="margin-top: 8px; font-weight: 500; color: #1565c0;">
                        {importStatus} {importProgress}
                    </p>
                {/if}
            </div>
            <div style="display:flex; flex-direction: row; gap: 8px;">
                <button on:click={async () => await doExport()} disabled={!!importStatus}>
                    Export
                </button>
                <button on:click={() => fileinput.click()} disabled={!!importStatus}>
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
        color: var(--muted-text-color);
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
