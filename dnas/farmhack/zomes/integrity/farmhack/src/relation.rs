use hdi::prelude::*;
use std::fmt;

#[derive(Serialize, Deserialize, Debug, SerializedBytes, Clone)]
pub struct Relation {
    pub src: AnyLinkableHash,
    pub dst: AnyLinkableHash,
    pub content: RelationContent,
}

#[derive(Serialize, Deserialize, Debug, SerializedBytes, Clone)]
pub struct RelationContent {
    pub path: String,
    pub data: String,
}
impl fmt::Display for RelationContent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{};{}", self.path, self.data)
    }
}

pub fn convert_relation_tag(tag: LinkTag) -> ExternResult<RelationContent> {
    let relation = RelationContent::try_from(SerializedBytes::from(UnsafeBytes::from(tag.into_inner())))
        .map_err(|_e| wasm_error!(WasmErrorInner::Guest(String::from("could not convert tag into relation"))))?;
    Ok(relation)
}
