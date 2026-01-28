import type { AppletHash, AppletServices, AssetInfo, RecordInfo, WAL, WeaveServices } from '@theweave/api';
import { type AppClient } from '@holochain/client';
import { FarmHackStore } from './stores/farmhack-store';
import { FarmHackClient } from './farmhack-client';
import { ROLE_NAME } from './farmhack/farmhack/types';
import { CloneManagerStore } from './stores/clone-manager-store';

const TOOL_ICON_SRC = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`

let store: FarmHackStore | undefined

export const appletServices: AppletServices = {
    creatables: {},
    blockTypes: {},
    getAssetInfo: async (
      appletClient: AppClient,
      wal: WAL,
      recordInfo: RecordInfo
    ): Promise<AssetInfo | undefined> => {
      if (!store) {
        try {
          const cloneManager = new CloneManagerStore(appletClient);
          store = await cloneManager.activeStore.load();
        } catch(e) {
          console.log("Error creating store", e)
        }
      }
      if (recordInfo) {
        const entryType: string = recordInfo.entryType

        if (entryType == "tool") {
          let name = "Tool"
          if (store) {
            const toolHash = wal.hrl[1]
            try {
              await store.fetchTools()
              const tool = store.getTool(toolHash)
              if (tool) {
                name = tool.record.entry.title
              }
            } catch(e) {
              console.log("Error fetching tool", e)
            }
          }
          return {
            icon_src: TOOL_ICON_SRC,
            name,
          };
        } else {
          throw new Error("unknown entry type:" + entryType)
        }
      } else {
        throw new Error("Null WAL not supported, must supply a recordInfo")
      }
    },
    search: async (
      appletClient: AppClient,
      appletHash: AppletHash,
      weServices: WeaveServices,
      searchFilter: string
    ): Promise<Array<WAL>> => {
        return []
    },
};
