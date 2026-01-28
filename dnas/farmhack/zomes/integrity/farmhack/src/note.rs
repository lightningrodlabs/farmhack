use hdi::prelude::*;

#[hdk_entry_helper]
#[derive(Clone)]
pub struct Note {
    pub text: String,
    pub tool: ActionHash,
    pub tags: Vec<String>,
    pub pic: Option<EntryHash>,
    pub trashed: bool,
}
