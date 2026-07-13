import type { Category } from "@/contract/src";

/**
 * Presentation for each on-chain `Category` tag: the locale label (passed in by the caller via
 * `useStrings().categories`) plus the muted tint classes the design system reserves per category.
 * One source of truth so the chip, the card placeholder, and any later filter render the same hue.
 * Unknown tags degrade to neutral.
 */
export type CategoryTag = Category["tag"];

interface CategoryMeta {
  label: string;
  /** solid text + soft background, for the chip */
  chip: string;
  /** gradient used behind cards that have no IPFS image */
  placeholder: string;
}

const META: Record<CategoryTag, Omit<CategoryMeta, "label">> = {
  DevelopingRegions: {
    chip: "text-cat-developing bg-cat-developing-soft",
    placeholder: "from-cat-developing-soft to-cat-developing/20",
  },
  DisasterRelief: {
    chip: "text-cat-disaster bg-cat-disaster-soft",
    placeholder: "from-cat-disaster-soft to-cat-disaster/20",
  },
  Education: {
    chip: "text-cat-education bg-cat-education-soft",
    placeholder: "from-cat-education-soft to-cat-education/20",
  },
  Health: {
    chip: "text-cat-health bg-cat-health-soft",
    placeholder: "from-cat-health-soft to-cat-health/20",
  },
  FaithCommunity: {
    chip: "text-cat-faith bg-cat-faith-soft",
    placeholder: "from-cat-faith-soft to-cat-faith/20",
  },
  EnvironmentAnimals: {
    chip: "text-cat-environment bg-cat-environment-soft",
    placeholder: "from-cat-environment-soft to-cat-environment/20",
  },
};

export function categoryMeta(tag: string, categories: Record<string, string>): CategoryMeta {
  const m = META[tag as CategoryTag] ?? {
    chip: "text-muted bg-line/40",
    placeholder: "from-line/50 to-line",
  };
  return { label: categories[tag] ?? tag, ...m };
}

/** The on-chain categories, in display order — powers the filter chip row. */
export const ALL_CATEGORIES: CategoryTag[] = [
  "DevelopingRegions",
  "DisasterRelief",
  "Education",
  "Health",
  "FaithCommunity",
  "EnvironmentAnimals",
];
