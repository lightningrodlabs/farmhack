use hdk::prelude::*;
use farmhack_integrity::*;

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum FarmHackMessage {
    NewTool(Tool),
}
