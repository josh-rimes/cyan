import type { RawSnippet, Snippet, SnippetParameter } from "./types.js";

export interface ValidationError {
  field: string;
  message: string;
}

export type ValidateResult =
  | { ok: true; value: Snippet }
  | { ok: false; errors: ValidationError[] };

export function validateSnippet(raw: RawSnippet): ValidateResult {
  const errors: ValidationError[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [
        {
          field: "(root)",
          message:
            "Snippet file must contain a YAML mapping (object) at the top level",
        },
      ],
    };
  }

  const obj = raw as Record<string, unknown>;

  // top-level fields
  const requiredStringFields = [
    "name",
    "namespace",
    "version",
    "description",
  ] as const;

  for (const field of requiredStringFields) {
    if (typeof obj[field] !== "string" || obj[field] === "") {
      errors.push({
        field,
        message: `Missing or empty required field "${field}" (expected a non-empty string)`,
      });
    }
  }

  // parameters
  const parameters: Record<string, SnippetParameter> = {};

  if (obj.parameters === undefined) {
    // TODO: design choice - simple snippets may have no parameters vs no silent coercion, no guessing
  } else if (
    typeof obj.parameters !== "object" ||
    obj.parameters === null ||
    Array.isArray(obj.parameters)
  ) {
    errors.push({
      field: "parameters",
      message:
        'Field "parameters" must be a mapping of parameter name to definition',
    });
  } else {
    const paramsObj = obj.parameters as Record<string, unknown>;

    for (const [paramName, paramDefRaw] of Object.entries(paramsObj)) {
      const fieldPrefix = `parameters.${paramName}`;

      if (
        typeof paramDefRaw !== "object" ||
        paramDefRaw === null ||
        Array.isArray(paramDefRaw)
      ) {
        errors.push({
          field: fieldPrefix,
          message: `Parameter "${paramName}" must be a mapping with "type" and "required"`,
        });
        continue;
      }

      const paramDef = paramDefRaw as Record<string, unknown>;

      if (paramDef.type !== "string") {
        errors.push({
          field: `${fieldPrefix}.type`,
          message: `Parameter "${paramName}" has invalid or missing "type" (only "string" is supported)`,
        });
      }

      if (typeof paramDef.required !== "boolean") {
        errors.push({
          field: `${fieldPrefix}.required`,
          message: `Parameter "${paramName}" is missing required boolean field "required"`,
        });
      }

      if (
        paramDef.default !== undefined &&
        typeof paramDef.default !== "string"
      ) {
        errors.push({
          field: `${fieldPrefix}.default`,
          message: `Parameter "${paramName}" has a "default" value that is not a string`,
        });
      }

      if (
        paramDef.type === "string" &&
        typeof paramDef.required === "boolean"
      ) {
        parameters[paramName] = {
          type: "string",
          required: paramDef.required,
          ...(typeof paramDef.default === "string"
            ? { default: paramDef.default }
            : {}),
        };
      }
    }
  }

  // script
  let script: string[] = [];

  if (!Array.isArray(obj.script)) {
    errors.push({
      field: "script",
      message: 'Field "script" must be a list of strings',
    });
  } else if (obj.script.length === 0) {
    errors.push({
      field: "script",
      message: 'Field "script" must contain at least one line',
    });
  } else {
    const badIndexes: number[] = [];

    obj.script.forEach((line, i) => {
      if (typeof line !== "string") badIndexes.push(i);
    });

    if (badIndexes.length > 0) {
      errors.push({
        field: "script",
        message: `Field "script" must be a flat list of strings; non-string entries at index(es): ${badIndexes.join(", ")}`,
      });
    } else {
      script = obj.script as string[];
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name: obj.name as string,
      namespace: obj.namespace as string,
      version: obj.version as string,
      description: obj.description as string,
      parameters,
      script,
    },
  };
}
