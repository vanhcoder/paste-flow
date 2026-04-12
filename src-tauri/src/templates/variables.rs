use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableMeta {
    pub name: String,
    #[serde(rename = "type")]
    pub var_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<serde_json::Value>,
}

/// Parse template content and extract structured variable metadata.
/// Syntax: {{name}}, {{name:type}}, {{name:type:options}}
/// Built-in variables (ALL_CAPS like TODAY, NOW) are excluded.
pub fn parse_variables(content: &str) -> Vec<VariableMeta> {
    let re = regex::Regex::new(r"\{\{([^}]+)\}\}").unwrap();
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();

    for cap in re.captures_iter(content) {
        let raw = cap[1].trim().to_string();

        // Skip built-in variables (all uppercase, optionally with :format)
        let name_part = raw.split(':').next().unwrap_or("");
        if !name_part.is_empty()
            && name_part == name_part.to_uppercase()
            && name_part.chars().all(|c| c.is_ascii_uppercase() || c == '_')
        {
            continue;
        }

        let parts: Vec<&str> = raw.splitn(3, ':').collect();
        let name = parts[0].to_string();
        if seen.contains(&name) {
            continue;
        }
        seen.insert(name.clone());

        let var_type = parts.get(1).unwrap_or(&"text").to_string();
        let options = parts.get(2).map(|o| {
            if var_type == "select" {
                let opts: Vec<&str> = o.split(',').map(|s| s.trim()).collect();
                serde_json::json!(opts)
            } else {
                serde_json::json!(o.to_string())
            }
        });

        result.push(VariableMeta {
            name,
            var_type,
            options,
        });
    }

    result
}

pub fn variables_to_json(vars: &[VariableMeta]) -> String {
    serde_json::to_string(vars).unwrap_or_else(|_| "[]".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_text_variable() {
        let vars = parse_variables("Hello {{name}}, welcome!");
        assert_eq!(vars.len(), 1);
        assert_eq!(vars[0].name, "name");
        assert_eq!(vars[0].var_type, "text");
    }

    #[test]
    fn test_typed_variables() {
        let content = "Price: {{price:currency:VND}}, Date: {{date:date:YYYY-MM-DD}}";
        let vars = parse_variables(content);
        assert_eq!(vars.len(), 2);
        assert_eq!(vars[0].name, "price");
        assert_eq!(vars[0].var_type, "currency");
        assert_eq!(vars[1].name, "date");
        assert_eq!(vars[1].var_type, "date");
    }

    #[test]
    fn test_select_variable() {
        let vars = parse_variables("Dear {{title:select:Mr,Mrs,Ms}}");
        assert_eq!(vars.len(), 1);
        assert_eq!(vars[0].var_type, "select");
        let opts = vars[0].options.as_ref().unwrap().as_array().unwrap();
        assert_eq!(opts.len(), 3);
    }

    #[test]
    fn test_builtin_excluded() {
        let vars = parse_variables("Today is {{TODAY}} and {{name}} says hi");
        assert_eq!(vars.len(), 1);
        assert_eq!(vars[0].name, "name");
    }

    #[test]
    fn test_deduplication() {
        let vars = parse_variables("{{name}} and {{name}} again");
        assert_eq!(vars.len(), 1);
    }
}
