import type { InsertAttorney } from "@workspace/db";

type FairfieldTown = {
  city: string;
  zip: string;
  lat: number;
  lng: number;
};

const TOWNS: FairfieldTown[] = [
  { city: "Stamford", zip: "06901", lat: 41.0534, lng: -73.5387 },
  { city: "Bridgeport", zip: "06604", lat: 41.1792, lng: -73.1894 },
  { city: "Norwalk", zip: "06850", lat: 41.1177, lng: -73.4082 },
  { city: "Danbury", zip: "06810", lat: 41.3948, lng: -73.454 },
  { city: "Greenwich", zip: "06830", lat: 41.0262, lng: -73.6282 },
  { city: "Fairfield", zip: "06824", lat: 41.1408, lng: -73.2613 },
  { city: "Westport", zip: "06880", lat: 41.1415, lng: -73.3579 },
  { city: "Trumbull", zip: "06611", lat: 41.2428, lng: -73.2007 },
  { city: "Shelton", zip: "06484", lat: 41.3165, lng: -73.0932 },
  { city: "Stratford", zip: "06614", lat: 41.1845, lng: -73.1332 },
  { city: "Darien", zip: "06820", lat: 41.0787, lng: -73.469 },
  { city: "New Canaan", zip: "06840", lat: 41.1468, lng: -73.4948 },
  { city: "Ridgefield", zip: "06877", lat: 41.2814, lng: -73.4982 },
  { city: "Wilton", zip: "06897", lat: 41.1956, lng: -73.4376 },
  { city: "Monroe", zip: "06468", lat: 41.3326, lng: -73.2076 },
  { city: "Newtown", zip: "06470", lat: 41.4137, lng: -73.3035 },
  { city: "Bethel", zip: "06801", lat: 41.3712, lng: -73.414 },
  { city: "Brookfield", zip: "06804", lat: 41.4834, lng: -73.4051 },
];

type Practice = {
  title: string;
  areas: string[];
};

const PRACTICES: Practice[] = [
  {
    title: "Family Law Attorney",
    areas: ["Divorce", "Child Custody", "Child Support", "Alimony", "Adoption"],
  },
  {
    title: "Personal Injury Attorney",
    areas: [
      "Car Accidents",
      "Truck Accidents",
      "Motorcycle Accidents",
      "Wrongful Death",
    ],
  },
  {
    title: "Accident & Injury Attorney",
    areas: [
      "Slip and Fall",
      "Dog Bites",
      "Construction Accidents",
      "Premises Liability",
    ],
  },
  {
    title: "Medical Malpractice Attorney",
    areas: [
      "Medical Malpractice",
      "Birth Injury",
      "Surgical Errors",
      "Misdiagnosis",
    ],
  },
  {
    title: "Business Attorney",
    areas: [
      "Business Disputes",
      "Contract Disputes",
      "Partnership Disputes",
      "Debt Collection",
    ],
  },
  {
    title: "Real Estate Attorney",
    areas: [
      "Landlord-Tenant",
      "Buying/Selling Home",
      "Foreclosure",
      "Property Damage",
    ],
  },
  {
    title: "Employment Attorney",
    areas: [
      "Wrongful Termination",
      "Discrimination",
      "Unpaid Wages",
      "Harassment",
    ],
  },
  {
    title: "Criminal Defense Attorney",
    areas: [
      "DUI",
      "Criminal Defense",
      "Traffic Tickets",
      "Assault",
      "Drug Charges",
    ],
  },
  {
    title: "Estate Planning Attorney",
    areas: ["Wills", "Trusts", "Probate", "Power of Attorney", "Guardianship"],
  },
  {
    title: "Immigration Attorney",
    areas: [
      "Green Cards",
      "Citizenship",
      "Deportation Defense",
      "Visas",
      "Asylum",
    ],
  },
];

const FIRST_NAMES = [
  "James",
  "Maria",
  "Robert",
  "Jennifer",
  "Michael",
  "Linda",
  "David",
  "Patricia",
  "Daniel",
  "Sofia",
  "Christopher",
  "Angela",
  "Matthew",
  "Nicole",
  "Anthony",
  "Rebecca",
  "Joseph",
  "Laura",
  "Andrew",
  "Karen",
  "Brian",
  "Elena",
  "Kevin",
  "Rachel",
  "Steven",
];

const LAST_NAMES = [
  "Sullivan",
  "Ramirez",
  "Bennett",
  "Cohen",
  "Patel",
  "Donnelly",
  "Russo",
  "Nguyen",
  "Walsh",
  "Kim",
  "Marino",
  "Foster",
  "Delgado",
  "Brennan",
  "Okafor",
  "Schwartz",
  "Caruso",
  "Lambert",
  "Romano",
  "Hayes",
  "Vasquez",
  "Whitman",
  "Doyle",
  "Petrov",
  "Carmichael",
];

const FEE_TYPES = ["Hourly", "Flat Fee", "Contingency", "Free Consultation"];
const STREETS = [
  "Main St",
  "Bedford St",
  "Post Rd",
  "Elm St",
  "Atlantic St",
  "Washington Ave",
  "Greenwich Ave",
  "Summer St",
  "High Ridge Rd",
  "Federal Rd",
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

export function buildDemoAttorneys(): InsertAttorney[] {
  const out: InsertAttorney[] = [];
  for (let i = 0; i < 50; i++) {
    const first = pick(FIRST_NAMES, i * 7 + 3);
    const last = pick(LAST_NAMES, i * 5 + 1);
    const town = pick(TOWNS, i);
    const practice = pick(PRACTICES, i + Math.floor(i / TOWNS.length));
    const fullName = `${first} ${last}`;
    const firmName = `${last} ${pick(["Law Group", "& Associates", "Legal", "Law Offices", "Partners"], i)}`;
    const emailHandle = `${first}.${last}`.toLowerCase();
    const domain = `${last}law`.toLowerCase();
    const streetNum = 100 + ((i * 37) % 800);
    const street = pick(STREETS, i);

    const jitterLat = ((i % 7) - 3) * 0.0035;
    const jitterLng = (((i * 3) % 7) - 3) * 0.0035;

    const numAreas = 3 + (i % 3);
    const areas = practice.areas.slice(0, numAreas);

    const langs = i % 3 === 0 ? ["English", "Spanish"] : ["English"];
    const years = 4 + ((i * 13) % 28);

    out.push({
      fullName,
      firmName,
      title: practice.title,
      photoUrl: `/seed-attorneys/${(i % 12) + 1}.png`,
      phone: `(203) 555-${String(1000 + i).slice(-4)}`,
      email: `${emailHandle}@${domain}.com`,
      bio: `${fullName} is a ${practice.title.toLowerCase()} based in ${town.city}, Connecticut, with ${years} years of experience helping clients across Fairfield County. ${first} focuses on ${areas.slice(0, 2).join(" and ").toLowerCase()} matters and is known for a practical, client-first approach.`,
      yearsOfExperience: years,
      practiceAreas: areas,
      jurisdictions: ["Connecticut"],
      officeAddress: `${streetNum} ${street}, ${town.city}, CT ${town.zip}`,
      latitude: town.lat + jitterLat,
      longitude: town.lng + jitterLng,
      calendlyUrl: "https://calendly.com/caseway-demo/consultation",
      feeType: pick(FEE_TYPES, i),
      offersFreeConsultation: i % 2 === 0,
      videoConferencing: i % 3 !== 0,
      languages: langs,
      websiteUrl: null,
      status: "approved",
      isDemo: true,
      ownerId: null,
    });
  }
  return out;
}
