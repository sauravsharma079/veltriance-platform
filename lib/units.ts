// Standard units of measure — always available as quick-pick options across
// catalog items, requisition/PO line items, and Aria, without requiring any
// admin setup. Admins can add org-specific ones under Admin -> Lookups (type
// UNIT_OF_MEASURE); wherever a unit picker is shown, merge these with those.

export type UnitOption = { code: string; label: string };

export const STANDARD_UNITS: UnitOption[] = [
  { code: "EA", label: "Each" },
  { code: "BOX", label: "Box" },
  { code: "CASE", label: "Case" },
  { code: "PR", label: "Pair" },
  { code: "SET", label: "Set" },
  { code: "DZ", label: "Dozen" },
  { code: "KG", label: "Kilogram" },
  { code: "G", label: "Gram" },
  { code: "L", label: "Litre" },
  { code: "M", label: "Metre" },
  { code: "HR", label: "Hour" },
  { code: "DAY", label: "Day" },
  { code: "WK", label: "Week" },
  { code: "MO", label: "Month" },
  { code: "YR", label: "Year" },
  { code: "LIC", label: "License" },
  { code: "LOT", label: "Lot" },
  { code: "PROJ", label: "Project" },
];

export function mergeUnits(orgLookups: UnitOption[]): UnitOption[] {
  const merged = [...STANDARD_UNITS];
  for (const l of orgLookups) {
    if (!merged.some(u => u.code === l.code)) merged.push(l);
  }
  return merged;
}
