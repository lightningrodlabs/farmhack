pub mod tool;
pub mod all_tools;
pub mod note;
pub mod relation;
pub mod utils;
pub mod messages;
pub mod proxy_agent;
pub mod all_proxy_agents;

use hdk::prelude::*;
use farmhack_integrity::*;
use messages::*;
use std::collections::HashSet;

#[hdk_extern]
pub fn init(_: ()) -> ExternResult<InitCallbackResult> {
    let mut fns = HashSet::new();
    fns.insert((zome_info()?.name, "recv_remote_signal".into()));
    let functions = GrantedFunctions::Listed(fns);
    create_cap_grant(CapGrantEntry {
        tag: "".into(),
        access: CapAccess::Unrestricted,
        functions,
    })?;

    Ok(InitCallbackResult::Pass)
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum Signal {
    LinkCreated { action: SignedActionHashed, link_type: LinkTypes },
    LinkDeleted { action: SignedActionHashed, link_type: LinkTypes },
    EntryCreated { action: SignedActionHashed, app_entry: EntryTypes },
    EntryUpdated {
        action: SignedActionHashed,
        app_entry: EntryTypes,
        original_app_entry: EntryTypes,
    },
    EntryDeleted { action: SignedActionHashed, original_app_entry: EntryTypes },
}

#[hdk_extern(infallible)]
pub fn post_commit(committed_actions: Vec<SignedActionHashed>) {
    for action in committed_actions {
        if let Err(err) = signal_action(action) {
            error!("Error signaling new action: {:?}", err);
        }
    }
}

fn signal_action(action: SignedActionHashed) -> ExternResult<()> {
    match action.hashed.content.clone() {
        Action::CreateLink(create_link) => {
            if let Ok(Some(_link_type))
                = LinkTypes::from_type(create_link.zome_index, create_link.link_type) {
            }
            Ok(())
        }
        Action::DeleteLink(delete_link) => {
            let record = get(
                    delete_link.link_add_address.clone(),
                    GetOptions::local(),
                )?
                .ok_or(
                    wasm_error!(
                        WasmErrorInner::Guest("Failed to fetch CreateLink action"
                        .to_string())
                    ),
                )?;
            match record.action() {
                Action::CreateLink(create_link) => {
                    if let Ok(Some(_link_type))
                        = LinkTypes::from_type(
                            create_link.zome_index,
                            create_link.link_type,
                        ) {
                    }
                    Ok(())
                }
                _ => {
                    return Err(
                        wasm_error!(
                            WasmErrorInner::Guest("Create Link should exist".to_string())
                        ),
                    );
                }
            }
        }
        Action::Create(_create) => {
            if let Ok(Some(_app_entry)) = get_entry_for_action(&action.hashed.hash) {
            }
            Ok(())
        }
        Action::Update(update) => {
            if let Ok(Some(_app_entry)) = get_entry_for_action(&action.hashed.hash) {
                if let Ok(Some(_original_app_entry))
                    = get_entry_for_action(&update.original_action_address) {
                }
            }
            Ok(())
        }
        Action::Delete(delete) => {
            if let Ok(Some(_original_app_entry))
                = get_entry_for_action(&delete.deletes_address) {
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

fn get_entry_for_action(action_hash: &ActionHash) -> ExternResult<Option<EntryTypes>> {
    let record = match get_details(action_hash.clone(), GetOptions::local())? {
        Some(Details::Record(record_details)) => record_details.record,
        _ => {
            return Ok(None);
        }
    };
    let entry = match record.entry().as_option() {
        Some(entry) => entry,
        None => {
            return Ok(None);
        }
    };
    let (zome_index, entry_index) = match record.action().entry_type() {
        Some(EntryType::App(AppEntryDef { zome_index, entry_index, .. })) => {
            (zome_index, entry_index)
        }
        _ => {
            return Ok(None);
        }
    };
    Ok(
        EntryTypes::deserialize_from_type(
            zome_index.clone(),
            entry_index.clone(),
            entry,
        )?,
    )
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FarmHackSignal {
    provenance: AgentPubKey,
    message: FarmHackMessage,
}

#[hdk_extern]
pub fn recv_remote_signal(message: FarmHackMessage) -> ExternResult<()> {
    let info = call_info()?;

    let notice = FarmHackSignal {
        message,
        provenance: info.provenance,
    };
    debug!("signal received: {:?}", notice);

    emit_signal(notice)
}
