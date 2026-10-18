import type { Category } from "@hisaab/types";

/** Display parent › child for subcategories; plain name for top-level. */
export function categoryLabel(
  item: Pick<Category, "id" | "name" | "parentId">,
  catalog: Array<Pick<Category, "id" | "name" | "parentId">> = [],
): string {
  if (!item.parentId) return item.name;
  const parent = catalog.find((row) => row.id === item.parentId);
  return parent ? `${parent.name} › ${item.name}` : item.name;
}
