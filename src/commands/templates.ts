import { Command } from "commander";
import { runWithClient } from "../commandContext.js";
import type { TemplateType } from "../types.js";

const ALLOWED_TEMPLATE_TYPES: TemplateType[] = [
  "campaign",
  "campaign_visual",
  "tx",
];

export function registerTemplateCommands(program: Command): void {
  const templates = program
    .command("templates")
    .description("Manage Listmonk templates");

  templates
    .command("list")
    .description("List templates")
    .option("--type <type>", "Filter by template type")
    .option("--name <name>", "Filter by template name (substring match)")
    .option("--query <query>", "Filter by name or subject (substring match)")
    .action(async (options, command) => {
      await runWithClient(command, async (client) => {
        const response = await client.listTemplates();
        let results = response;

        if (options.type) {
          const type = options.type as TemplateType;
          assertOneOf("template type", type, ALLOWED_TEMPLATE_TYPES);
          results = results.filter((template) => template.type === type);
        }

        if (options.name) {
          const needle = String(options.name).toLowerCase();
          results = results.filter((template) =>
            template.name.toLowerCase().includes(needle),
          );
        }

        if (options.query) {
          const needle = String(options.query).toLowerCase();
          results = results.filter((template) => {
            const name = template.name.toLowerCase();
            const subject = template.subject?.toLowerCase() ?? "";
            return name.includes(needle) || subject.includes(needle);
          });
        }

        if (results.length === 0) {
          console.log("No templates found.");
          return;
        }

        console.table(
          results.map((template) => ({
            id: template.id ?? "",
            name: template.name,
            type: template.type,
            subject: template.subject ?? "",
            is_default: template.is_default ?? false,
          })),
        );

        console.log(`Total: ${results.length}`);
      });
    });
}

function assertOneOf<T extends string>(
  label: string,
  value: string,
  allowed: readonly T[],
): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw new Error(
      `Invalid ${label} "${value}". Allowed values: ${allowed.join(", ")}`,
    );
  }
}
