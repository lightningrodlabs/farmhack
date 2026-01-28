pub mod tool;
pub use tool::*;
pub mod note;
pub use note::*;
use hdi::prelude::*;
pub mod relation;
pub use relation::*;
#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    Tool(Tool),
    Note(Note),
}
#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    AllTools,
    ToolUpdates,
    NoteUpdates,
    Relations,
}
#[hdk_extern]
pub fn genesis_self_check(
    _data: GenesisSelfCheckData,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
pub fn validate_agent_joining(
    _agent_pub_key: AgentPubKey,
    _membrane_proof: &Option<MembraneProof>,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => {
            match store_entry {
                OpEntry::CreateEntry { app_entry, action } => {
                    match app_entry {
                        EntryTypes::Tool(tool) => {
                            validate_create_tool(
                                EntryCreationAction::Create(action),
                                tool,
                            )
                        }
                        EntryTypes::Note(note) => {
                            validate_create_note(
                                EntryCreationAction::Create(action),
                                note,
                            )
                        }
                    }
                }
                OpEntry::UpdateEntry { app_entry, action, .. } => {
                    match app_entry {
                        EntryTypes::Tool(tool) => {
                            validate_create_tool(
                                EntryCreationAction::Update(action),
                                tool,
                            )
                        }
                        EntryTypes::Note(note) => {
                            validate_create_note(
                                EntryCreationAction::Update(action),
                                note,
                            )
                        }
                    }
                }
                _ => Ok(ValidateCallbackResult::Valid),
            }
        }
        FlatOp::RegisterUpdate(update_entry) => {
            match update_entry {
                OpUpdate::Entry { app_entry, .. } => {
                    match app_entry {
                        EntryTypes::Tool(_tool) => {
                            Ok(ValidateCallbackResult::Valid)
                        }
                        EntryTypes::Note(_note) => {
                            Ok(ValidateCallbackResult::Valid)
                        }
                    }
                }
                _ => Ok(ValidateCallbackResult::Valid),
            }
        }
        FlatOp::RegisterDelete(_delete_entry) => {
            Ok(ValidateCallbackResult::Valid)
        }
        FlatOp::RegisterCreateLink { link_type, .. } => {
            match link_type {
                LinkTypes::AllTools => Ok(ValidateCallbackResult::Valid),
                LinkTypes::ToolUpdates => Ok(ValidateCallbackResult::Valid),
                LinkTypes::NoteUpdates => Ok(ValidateCallbackResult::Valid),
                LinkTypes::Relations => Ok(ValidateCallbackResult::Valid),
            }
        }
        FlatOp::RegisterDeleteLink { link_type, .. } => {
            match link_type {
                LinkTypes::AllTools => Ok(ValidateCallbackResult::Valid),
                LinkTypes::ToolUpdates => Ok(ValidateCallbackResult::Valid),
                LinkTypes::NoteUpdates => Ok(ValidateCallbackResult::Valid),
                LinkTypes::Relations => Ok(ValidateCallbackResult::Valid),
            }
        }
        FlatOp::StoreRecord(store_record) => {
            match store_record {
                OpRecord::CreateEntry { app_entry, action } => {
                    match app_entry {
                        EntryTypes::Tool(tool) => {
                            validate_create_tool(
                                EntryCreationAction::Create(action),
                                tool,
                            )
                        }
                        EntryTypes::Note(note) => {
                            validate_create_note(
                                EntryCreationAction::Create(action),
                                note,
                            )
                        }
                    }
                }
                OpRecord::UpdateEntry { app_entry, action, .. } => {
                    match app_entry {
                        EntryTypes::Tool(tool) => {
                            validate_create_tool(
                                EntryCreationAction::Update(action),
                                tool,
                            )
                        }
                        EntryTypes::Note(note) => {
                            validate_create_note(
                                EntryCreationAction::Update(action),
                                note,
                            )
                        }
                    }
                }
                _ => Ok(ValidateCallbackResult::Valid),
            }
        }
        _ => Ok(ValidateCallbackResult::Valid),
    }
}

pub fn validate_create_tool(
    _action: EntryCreationAction,
    _tool: Tool,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_create_note(
    _action: EntryCreationAction,
    _note: Note,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
