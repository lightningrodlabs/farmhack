use hdk::prelude::*;
use farmhack_integrity::*;

#[hdk_extern]
pub fn create_tool(tool: Tool) -> ExternResult<Record> {
    let tool_hash = create_entry(&EntryTypes::Tool(tool.clone()))?;
    let record = get(tool_hash.clone(), GetOptions::local())?
        .ok_or(
            wasm_error!(
                WasmErrorInner::Guest(String::from("Could not find the newly created Tool"))
            ),
        )?;
    let path = Path::from("all_tools");
    create_link(
        path.path_entry_hash()?,
        tool_hash.clone(),
        LinkTypes::AllTools,
        (),
    )?;
    Ok(record)
}
#[hdk_extern]
pub fn get_tool(original_tool_hash: ActionHash) -> ExternResult<Option<Record>> {
    let links = get_links(
        LinkQuery::try_new(
            original_tool_hash.clone(),
            LinkTypes::ToolUpdates,
        )?,
        GetStrategy::Local
    )?;
    let latest_link = links
        .into_iter()
        .max_by(|link_a, link_b| link_a.timestamp.cmp(&link_b.timestamp));
    let latest_tool_hash = match latest_link {
        Some(link) => ActionHash::try_from(link.target.clone()).map_err(|err| wasm_error!(err))?,
        None => original_tool_hash.clone(),
    };
    get(latest_tool_hash, GetOptions::local())
}
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateToolInput {
    pub original_tool_hash: ActionHash,
    pub previous_tool_hash: ActionHash,
    pub updated_tool: Tool,
}
#[hdk_extern]
pub fn update_tool(input: UpdateToolInput) -> ExternResult<Record> {
    let updated_tool_hash = update_entry(
        input.previous_tool_hash.clone(),
        &input.updated_tool,
    )?;
    create_link(
        input.original_tool_hash.clone(),
        updated_tool_hash.clone(),
        LinkTypes::ToolUpdates,
        (),
    )?;
    let record = get(updated_tool_hash.clone(), GetOptions::local())?
        .ok_or(
            wasm_error!(
                WasmErrorInner::Guest(String::from("Could not find the newly updated Tool"))
            ),
        )?;
    Ok(record)
}
#[hdk_extern]
pub fn delete_tool(original_tool_hash: ActionHash) -> ExternResult<ActionHash> {
    delete_entry(original_tool_hash)
}
