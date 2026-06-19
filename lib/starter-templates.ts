import type { UserType } from "./user-types";

export interface StarterTemplate {
  title: string;
  description: string;
  prompt: string;
}

export interface StarterTemplateSet {
  eyebrow: string;
  title: string;
  description: string;
  templates: StarterTemplate[];
}

const DEFAULT_STARTER_SET: StarterTemplateSet = {
  eyebrow: "Quick start",
  title: "Start with a strong brief",
  description: "Choose a starter prompt or describe your own space.",
  templates: [
    {
      title: "Family Home",
      description: "L-shaped 3-bedroom layout with open shared spaces.",
      prompt: "Create an L-shaped 3-bedroom family home with an open kitchen and dining area, a comfortable living room, master bedroom with ensuite, two bedrooms, bathroom, laundry, and clear hallway circulation.",
    },
    {
      title: "Compact Apartment",
      description: "Efficient 2-bedroom apartment for city living.",
      prompt: "Create a compact 2-bedroom apartment with a bright living room, kitchen, dining area, master bedroom, second bedroom, bathroom, laundry, and efficient circulation.",
    },
    {
      title: "Studio Concept",
      description: "Simple open-plan studio with service spaces.",
      prompt: "Create an efficient studio apartment with open living and sleeping space, kitchenette, entry, bathroom, laundry, and good natural light.",
    },
  ],
};

const STARTER_SETS: Record<UserType, StarterTemplateSet> = {
  homeowner: {
    eyebrow: "For homeowners",
    title: "Design a home you can picture living in",
    description: "Start with everyday needs: bedrooms, kitchen flow, privacy, and natural light.",
    templates: [
      {
        title: "Dream Family Home",
        description: "A practical 3-bedroom home with shared family spaces.",
        prompt: "Create a 3-bedroom family home for four people with an open kitchen and dining area, large living room, master bedroom with ensuite, two bedrooms, shared bathroom, laundry, entry, and clear separation between public and private spaces.",
      },
      {
        title: "First Apartment",
        description: "A compact apartment with no wasted hallway space.",
        prompt: "Create a compact 2-bedroom apartment for a couple with a bright living room, practical kitchen, dining area, master bedroom, guest bedroom, bathroom, laundry, and efficient circulation.",
      },
      {
        title: "Work From Home",
        description: "Narrow-lot home with a quiet study zone.",
        prompt: "Create a narrow-lot 3-bedroom home with one bedroom converted into a home office, an open kitchen and dining area, living room, master bedroom with ensuite, shared bathroom, laundry, long hallway circulation, and quiet private zone.",
      },
    ],
  },
  architect_designer: {
    eyebrow: "For architects and designers",
    title: "Start from a client-ready concept brief",
    description: "Use briefs that emphasize circulation, privacy, adjacency, and presentation value.",
    templates: [
      {
        title: "Client Concept",
        description: "A balanced 3-bedroom concept for early review.",
        prompt: "Create a client-ready 3-bedroom residential concept with clear public and private zoning, open kitchen-dining-living flow, master suite, two secondary bedrooms, shared bathroom, laundry, entry sequence, and efficient circulation.",
      },
      {
        title: "Compact Feasibility",
        description: "A dense apartment plan for early feasibility.",
        prompt: "Create a compact 2-bedroom unit feasibility layout with minimized corridor area, connected kitchen and dining, living zone with natural light, two private bedrooms, bathroom, laundry, and clear room labels.",
      },
      {
        title: "Upscale Villa",
        description: "Larger home with garage and suite logic.",
        prompt: "Create a spacious 4-bedroom villa concept with garage, grand entry, living room, kitchen, dining room, master bedroom with ensuite, three bedrooms, main bathroom, guest WC, laundry, and legible circulation.",
      },
    ],
  },
  real_estate_builder: {
    eyebrow: "For real estate and builders",
    title: "Create fast concepts for buyers and projects",
    description: "Start with layouts that are easy to present, compare, and turn into sales visuals.",
    templates: [
      {
        title: "Listing Potential",
        description: "Show how a compact property could be improved.",
        prompt: "Create a renovation concept for a compact 2-bedroom apartment with brighter living space, improved kitchen-dining connection, practical bathroom, laundry, and efficient circulation for a real estate listing presentation.",
      },
      {
        title: "Spec Home",
        description: "Builder-friendly 3-bedroom plan for broad appeal.",
        prompt: "Create a narrow-lot marketable 3-bedroom spec home with open kitchen and dining, large living room, master bedroom with ensuite, two bedrooms, bathroom, laundry, entry, and a simple buildable layout.",
      },
      {
        title: "Premium Property",
        description: "Larger villa concept with garage and extra rooms.",
        prompt: "Create a premium 4-bedroom villa with garage, grand entry, large living room, kitchen, dining room, master suite, three bedrooms, main bathroom, guest WC, laundry, and clear presentation-ready room labels.",
      },
    ],
  },
};

export function getStarterTemplateSet(userType: UserType | null | undefined): StarterTemplateSet {
  return userType ? STARTER_SETS[userType] : DEFAULT_STARTER_SET;
}
