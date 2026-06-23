import { Ionicons } from "@expo/vector-icons";

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Maps a high-level discovery category (group) to the specific practice areas
 * attorneys store. Category filtering intersects the group's areas with each
 * attorney's practiceAreas client-side, matching the web app.
 */
export const PRACTICE_AREAS: Record<string, string[]> = {
  "Family / Relationships": [
    "Divorce",
    "Child Custody",
    "Child Support",
    "Alimony",
    "Domestic Violence",
    "Adoption",
  ],
  "Car Accidents & Injuries": [
    "Car Accidents",
    "Truck Accidents",
    "Motorcycle Accidents",
    "Uber/Lyft Accidents",
    "Wrongful Death",
  ],
  "Other Accidents & Injuries": [
    "Slip and Fall",
    "Dog Bites",
    "Construction Accidents",
    "Premises Liability",
    "Product Liability",
  ],
  "Medical / Hospital Issues": [
    "Medical Malpractice",
    "Birth Injury",
    "Surgical Errors",
    "Misdiagnosis",
    "Nursing Home Abuse",
    "Hospital Bills",
  ],
  "Money, Business & Contracts": [
    "Business Disputes",
    "Contract Disputes",
    "Debt Collection",
    "Bankruptcy",
    "Partnership Disputes",
  ],
  "Home, Property & Neighbors": [
    "Landlord-Tenant",
    "Buying/Selling Home",
    "Foreclosure",
    "Property Damage",
    "Neighbor Disputes",
  ],
  "Job / Workplace": [
    "Wrongful Termination",
    "Discrimination",
    "Unpaid Wages",
    "Harassment",
    "Employment Contracts",
  ],
  "Criminal / Police Trouble": [
    "DUI",
    "Criminal Defense",
    "Traffic Tickets",
    "Assault",
    "Drug Charges",
    "Police Misconduct",
  ],
  "Estate Planning": [
    "Wills",
    "Trusts",
    "Probate",
    "Power of Attorney",
    "Guardianship",
  ],
  Immigration: [
    "Green Cards",
    "Citizenship",
    "Deportation Defense",
    "Visas",
    "Asylum",
  ],
};

export interface Category {
  label: string;
  value: string;
  description: string;
  icon: IoniconName;
}

export const CATEGORIES: Category[] = [
  {
    label: "Family & Relationships",
    value: "Family / Relationships",
    description: "Divorce, custody, support",
    icon: "people",
  },
  {
    label: "Car Accidents & Injuries",
    value: "Car Accidents & Injuries",
    description: "Crashes, wrongful death",
    icon: "car-sport",
  },
  {
    label: "Other Accidents & Injuries",
    value: "Other Accidents & Injuries",
    description: "Slip & fall, liability",
    icon: "bandage",
  },
  {
    label: "Medical & Hospital Issues",
    value: "Medical / Hospital Issues",
    description: "Malpractice, misdiagnosis",
    icon: "medkit",
  },
  {
    label: "Money, Business & Contracts",
    value: "Money, Business & Contracts",
    description: "Disputes, bankruptcy",
    icon: "briefcase",
  },
  {
    label: "Home, Property & Neighbors",
    value: "Home, Property & Neighbors",
    description: "Tenancy, foreclosure",
    icon: "business",
  },
  {
    label: "Job & Workplace",
    value: "Job / Workplace",
    description: "Termination, harassment",
    icon: "people-circle",
  },
  {
    label: "Criminal & Police Trouble",
    value: "Criminal / Police Trouble",
    description: "DUI, defense, tickets",
    icon: "shield-checkmark",
  },
  {
    label: "Estate Planning & Wills",
    value: "Estate Planning",
    description: "Wills, trusts, probate",
    icon: "document-text",
  },
  {
    label: "Immigration",
    value: "Immigration",
    description: "Visas, green cards, asylum",
    icon: "globe",
  },
];
