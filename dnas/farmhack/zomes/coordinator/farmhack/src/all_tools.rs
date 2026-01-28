use std::collections::HashMap;

use hdk::prelude::*;
use farmhack_integrity::*;

use crate::relation::{get_relations, RelationInfo};
use crate::tool::get_tool;

#[derive(Serialize, Deserialize, Debug, SerializedBytes, Clone)]
pub struct ToolInfo {
    pub original_hash: ActionHash,
    pub record: Record,
    pub relations: Vec<RelationInfo>,
}

#[hdk_extern]
pub fn get_all_tools(_: ()) -> ExternResult<Vec<ToolInfo>> {
    let path = Path::from("all_tools");
    let links = get_links(
        LinkQuery::try_new(
            path.path_entry_hash()?,
            LinkTypes::AllTools,
        )?,
        GetStrategy::Local
    )?;

    let mut records: Vec<Record> = Vec::new();
    let mut hashes: HashMap<ActionHash, ActionHash> = HashMap::new();
    for link in links {
        if let Some(record) = get_tool(ActionHash::try_from(link.target.clone()).map_err(|err| wasm_error!(err))?)? {
            hashes.insert(record.action_address().clone(), ActionHash::try_from(link.target).map_err(|err| wasm_error!(err))?);
            records.push(record);
        }
    }

    let mut tools: Vec<ToolInfo> = Vec::new();
    for r in records {
        let hash = r.action_address().clone();
        let original_hash = hashes.get(&hash).unwrap().clone();
        let relations = get_relations(AnyLinkableHash::from(original_hash.clone()))?;
        tools.push(ToolInfo {
            original_hash,
            record: r,
            relations,
        })
    };
    Ok(tools)
}
