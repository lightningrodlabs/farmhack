use hdi::prelude::*;

#[hdk_entry_helper]
#[derive(Clone)]
pub struct Tool {
    pub title: String,
    pub description: String,
    pub status: String,
    pub tags: Vec<String>,
    pub pic: Option<EntryHash>,
    pub trashed: bool,
}
