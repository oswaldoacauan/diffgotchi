import { CONFIG_DESCRIPTIONS, CONFIG_SCHEMA_URL, DEFAULT_CONFIG } from "./definition";

type JsonSchema = Record<string, unknown>;

export function generateConfigSchema(): JsonSchema {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: CONFIG_SCHEMA_URL,
    title: "Diffgotchi Configuration",
    description:
      "Configuration file for Diffgotchi TUI diff reviewer (~/.config/diffgotchi/config.json)",
    type: "object",
    properties: {
      $schema: { type: "string" },
      general: objectSchema(CONFIG_DESCRIPTIONS.general, DEFAULT_CONFIG.general, {
        theme: { type: "string" },
        editor: { type: "string" },
        mouse: { type: "boolean" },
      }),
      display: objectSchema(CONFIG_DESCRIPTIONS.display, DEFAULT_CONFIG.display, {
        view: { type: "string", enum: ["auto", "split", "unified"] },
        line_numbers: { type: "boolean" },
        wrap: { type: "string", enum: ["word", "char", "none"] },
        inline_highlights: { type: "boolean" },
        backgrounds: { type: "boolean" },
        indicators: { type: "string", enum: ["classic", "none"] },
        hunk_headers: { type: "boolean" },
      }),
      diff: objectSchema(CONFIG_DESCRIPTIONS.diff, DEFAULT_CONFIG.diff, {
        context_lines: { type: "integer", minimum: 0 },
        refresh_debounce_ms: { type: "integer", minimum: 0 },
        max_bytes: { type: "integer", minimum: 0 },
        max_file_lines: { type: "integer", minimum: 0 },
        filetypes: { type: "object", additionalProperties: { type: "string" } },
        ignored_files: {
          type: "array",
          items: {
            type: "string",
            description: 'JavaScript regex pattern (e.g. "\\\\.lock$").',
          },
        },
      }),
      upgrade: objectSchema(CONFIG_DESCRIPTIONS.upgrade, DEFAULT_CONFIG.upgrade, {
        auto: { type: "boolean" },
        channel: { type: "string", enum: ["stable", "edge"] },
      }),
      storage: objectSchema(CONFIG_DESCRIPTIONS.storage, DEFAULT_CONFIG.storage, {
        cleanup_stale_days: { type: "integer", minimum: 0 },
      }),
      keybinds: {
        type: "object",
        description: CONFIG_DESCRIPTIONS.keybinds,
        propertyNames: { pattern: "^[^.]+\\.[^.]+$" },
        additionalProperties: { type: "string" },
        properties: Object.fromEntries(
          Object.entries(DEFAULT_CONFIG.keybinds).map(([key, value]) => [
            key,
            { type: "string", default: value },
          ]),
        ),
        default: DEFAULT_CONFIG.keybinds,
      },
    },
    additionalProperties: false,
  };
}

function objectSchema<T extends object>(
  descriptions: Record<keyof T, string>,
  defaults: T,
  properties: Record<keyof T, JsonSchema>,
): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        {
          ...(value as JsonSchema),
          description: descriptions[key as keyof T],
          default: defaults[key as keyof T],
        },
      ]),
    ),
    default: defaults,
  };
}

if (import.meta.main) {
  const path = new URL("../../../../../schemas/config.json", import.meta.url);
  await Bun.write(path, JSON.stringify(generateConfigSchema(), null, 2) + "\n");
}
