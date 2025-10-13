import { Command } from "commander";
import { runWithClient } from "../commandContext.js";
import type { ListListsParams } from "../types.js";

export function registerListCommands(program: Command): void {
  program
    .command("lists")
    .description("List existing mailing lists")
    .option("--page <page>", "Page number", parseInteger)
    .option("--per-page <size>", "Items per page", parseInteger)
    .option("--query <query>", "Filter by name or description")
    .option("--tag <tag>", "Filter by tag")
    .action(async (options, command) => {
      await runWithClient(command, async (client) => {
        const params: ListListsParams = {
          page: options.page,
          perPage: options.perPage,
          query: options.query,
          tag: options.tag,
        };

        const response = await client.listLists(params);

        if (response.results.length === 0) {
          console.log("No lists found.");
          return;
        }

        console.table(
          response.results.map((list) => ({
            id: list.id,
            name: list.name,
            type: list.type,
            optin: list.optin,
            subscribers: list.subscriber_count ?? 0,
            tags: list.tags?.join(", ") ?? "",
          })),
        );

        console.log(
          `Page ${response.page} / ${Math.ceil(
            response.total / response.per_page,
          )} • Total: ${response.total}`,
        );
      });
    });
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected a number but received "${value}"`);
  }
  return parsed;
}
