export const USER_TYPE_OPTIONS = [
  {
    value: "homeowner",
    label: "Homeowner",
    description: "Designing or renovating your own space.",
  },
  {
    value: "architect_designer",
    label: "Architect / Designer",
    description: "Creating concepts, plans, or client presentations.",
  },
  {
    value: "real_estate_builder",
    label: "Real Estate / Builder",
    description: "Planning projects, listings, developments, or sales visuals.",
  },
] as const;

export type UserType = (typeof USER_TYPE_OPTIONS)[number]["value"];

const USER_TYPE_VALUES = new Set<string>(USER_TYPE_OPTIONS.map((option) => option.value));

export function isUserType(value: string | null | undefined): value is UserType {
  return !!value && USER_TYPE_VALUES.has(value);
}
