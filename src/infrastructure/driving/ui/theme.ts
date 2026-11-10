import type { Suit } from "../../../domain/card";

// Shown where a score isn't available, or where scoring doesn't yet report the figure.
export const NO_VALUE = "–";

// Class names are written out in full because Tailwind only generates classes it can find as text.
// The plural label is for counts, such as "2 Armies".
export const SUITS: Record<
  Suit,
  { label: string; plural: string; colorClass: string }
> = {
  army: { label: "Army", plural: "Armies", colorClass: "bg-suit-army" },
  artifact: {
    label: "Artifact",
    plural: "Artifacts",
    colorClass: "bg-suit-artifact",
  },
  beast: { label: "Beast", plural: "Beasts", colorClass: "bg-suit-beast" },
  flame: { label: "Flame", plural: "Flames", colorClass: "bg-suit-flame" },
  flood: { label: "Flood", plural: "Floods", colorClass: "bg-suit-flood" },
  land: { label: "Land", plural: "Lands", colorClass: "bg-suit-land" },
  leader: { label: "Leader", plural: "Leaders", colorClass: "bg-suit-leader" },
  weapon: { label: "Weapon", plural: "Weapons", colorClass: "bg-suit-weapon" },
  weather: {
    label: "Weather",
    plural: "Weather",
    colorClass: "bg-suit-weather",
  },
  wild: { label: "Wild", plural: "Wild", colorClass: "bg-suit-wild" },
  wizard: { label: "Wizard", plural: "Wizards", colorClass: "bg-suit-wizard" },
};
