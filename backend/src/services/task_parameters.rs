use super::{Result, invalid};
use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub(super) struct Customization {
    pub parameters: BTreeMap<String, String>,
    pub execution_notes: String,
}

fn key_char(c: char) -> bool {
    c.is_ascii_alphabetic() || c == '_' || ('가'..='힣').contains(&c)
}

// Only named bracket tokens are interpreted. Other brackets remain plain text.
pub(super) fn resolve(
    template: &str,
    supplied: &BTreeMap<String, String>,
) -> Result<(String, BTreeMap<String, String>)> {
    if template.chars().count() > 200 || template.contains('\0') {
        return Err(invalid());
    }
    let mut values = BTreeMap::new();
    let mut rendered = String::new();
    let mut rest = template;
    while let Some(start) = rest.find('[') {
        rendered.push_str(&rest[..start]);
        rest = &rest[start..];
        let Some(end) = rest.find(']') else { break };
        let token = &rest[1..end];
        let (key, default) = token.split_once('=').unwrap_or((token, ""));
        let valid = !key.is_empty()
            && key.chars().count() <= 32
            && key.chars().next().is_some_and(key_char)
            && key.chars().all(|c| key_char(c) || c.is_ascii_digit())
            && default.chars().count() <= 80
            && !default.contains(['[', ']', '\n', '\r']);
        if !valid {
            rendered.push('[');
            rest = &rest[1..];
            continue;
        }
        let value = values.entry(key.to_owned()).or_insert_with(|| {
            supplied
                .get(key)
                .map(String::as_str)
                .unwrap_or(default)
                .trim()
                .to_owned()
        });
        if value.is_empty() || value.chars().count() > 80 || value.contains(['\0', '\n', '\r']) {
            return Err(invalid());
        }
        rendered.push_str(value);
        rest = &rest[end + 1..];
    }
    rendered.push_str(rest);
    let rendered = rendered.trim().to_owned();
    if rendered.is_empty()
        || rendered.chars().count() > 200
        || rendered.contains('\0')
        || supplied.keys().any(|key| !values.contains_key(key))
    {
        return Err(invalid());
    }
    Ok((rendered, values))
}
