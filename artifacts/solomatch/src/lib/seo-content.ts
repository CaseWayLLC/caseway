// Evergreen, lightly-templated copy for the programmatic county and
// practice-area-county landing pages. The goal is genuinely useful framing for
// people choosing an attorney (and quotable text for answer engines) on top of
// the unique attorney listings each page already renders — NOT keyword padding.
// Each practice area gets a distinct, accurate description so the pages do not
// read as near-duplicate doorway pages.

// Completes the sentence: "<Area> attorneys <blurb>."
const PRACTICE_AREA_BLURBS: Record<string, string> = {
  // Family / Relationships
  Divorce:
    "guide you through ending a marriage, from dividing property and debts to spousal support and parenting plans",
  "Child Custody":
    "help establish or modify legal and physical custody arrangements built around your children's best interests",
  "Child Support":
    "calculate, enforce, or modify child support so your children are provided for fairly",
  Alimony:
    "pursue or contest spousal support and structure payments that reflect each spouse's circumstances",
  "Domestic Violence":
    "obtain protective orders and represent you in related family and criminal matters with discretion",
  Adoption:
    "navigate the adoption process, from consent and home studies to finalizing your family in court",

  // Car Accidents & Injuries
  "Car Accidents":
    "pursue compensation for injuries, medical bills, and lost wages after a collision",
  "Truck Accidents":
    "investigate complex commercial trucking crashes and hold carriers and drivers accountable",
  "Motorcycle Accidents":
    "fight for riders injured in crashes and counter the bias motorcyclists often face",
  "Uber/Lyft Accidents":
    "untangle rideshare insurance coverage to recover for injuries from an Uber or Lyft crash",
  "Wrongful Death":
    "help families seek accountability and compensation after losing a loved one to negligence",

  // Other Accidents & Injuries
  "Slip and Fall":
    "pursue property owners when unsafe conditions cause a slip, trip, or fall injury",
  "Dog Bites":
    "recover medical costs and damages for victims of dog attacks and animal injuries",
  "Construction Accidents":
    "represent workers and bystanders hurt on job sites and construction projects",
  "Premises Liability":
    "hold property owners responsible for injuries caused by unsafe conditions",
  "Product Liability":
    "take on manufacturers and sellers when a defective product causes harm",

  // Medical / Hospital Issues
  "Medical Malpractice":
    "hold doctors and hospitals accountable when substandard care causes injury",
  "Birth Injury":
    "investigate preventable harm to mothers and newborns during pregnancy and delivery",
  "Surgical Errors":
    "pursue claims for preventable mistakes made before, during, or after surgery",
  Misdiagnosis:
    "build claims when a missed or delayed diagnosis leads to worse outcomes",
  "Nursing Home Abuse":
    "protect older adults and seek justice for neglect or abuse in care facilities",
  "Hospital Bills":
    "dispute, negotiate, and resolve unfair or inflated medical bills",

  // Money, Business & Contracts
  "Business Disputes":
    "resolve conflicts between owners, partners, vendors, and competitors",
  "Contract Disputes":
    "interpret, enforce, or defend agreements and pursue remedies for breach",
  "Debt Collection":
    "represent creditors and debtors in collection, settlement, and defense",
  Bankruptcy:
    "guide individuals and businesses through debt relief and a fresh financial start",
  "Partnership Disputes":
    "address deadlocks, buyouts, and breakups between business partners",

  // Home, Property & Neighbors
  "Landlord-Tenant":
    "handle leases, evictions, deposits, and habitability disputes for landlords and tenants",
  "Buying/Selling Home":
    "review contracts, title, and closing details to protect your real estate transaction",
  Foreclosure:
    "explore defenses and alternatives for homeowners facing foreclosure",
  "Property Damage": "pursue compensation for damage to your home or property",
  "Neighbor Disputes":
    "resolve boundary, easement, noise, and nuisance conflicts between neighbors",

  // Job / Workplace
  "Wrongful Termination":
    "pursue claims when you are fired in violation of your rights or a contract",
  Discrimination:
    "stand up to workplace discrimination based on protected characteristics",
  "Unpaid Wages":
    "recover unpaid wages, overtime, and other compensation you are owed",
  Harassment: "address workplace harassment and hold employers accountable",
  "Employment Contracts":
    "review and negotiate offers, severance, and non-compete agreements",

  // Criminal / Police Trouble
  DUI: "defend against drunk and impaired driving charges and protect your license",
  "Criminal Defense":
    "protect your rights and build a defense at every stage of a criminal case",
  "Traffic Tickets":
    "contest tickets and citations to limit points, fines, and insurance impacts",
  Assault: "defend against assault and violent-crime charges",
  "Drug Charges":
    "challenge searches and evidence and defend against drug-related charges",
  "Police Misconduct":
    "pursue claims for excessive force and violations of your civil rights",

  // Estate Planning
  Wills:
    "draft clear, valid wills that carry out your wishes and protect your family",
  Trusts:
    "set up trusts to manage assets, avoid probate, and plan for the future",
  Probate: "guide executors and heirs through administering an estate",
  "Power of Attorney":
    "prepare powers of attorney so trusted people can act for you when needed",
  Guardianship:
    "establish guardianship or conservatorship for minors and incapacitated adults",

  // Immigration
  "Green Cards":
    "help you pursue lawful permanent residence through family, work, or other paths",
  Citizenship: "guide you through naturalization and becoming a U.S. citizen",
  "Deportation Defense":
    "defend against removal and represent you in immigration court",
  Visas: "navigate work, family, student, and visitor visa applications",
  Asylum: "help those fleeing persecution seek asylum and protection",
};

export function practiceAreaBlurb(area: string): string {
  return (
    PRACTICE_AREA_BLURBS[area] ??
    `help clients with ${area.toLowerCase()} matters`
  );
}

// Standard closing line on every directory landing page — clarifies that
// Caseway is not a law firm or referral service (also an AEO-friendly fact).
const DISCLAIMER =
  "Caseway is a directory and discovery platform, not a law firm or lawyer referral service, and it does not provide legal advice. Always confirm an attorney's credentials and bar standing directly before hiring.";

export function countyIntro(county: string, state: string): string[] {
  return [
    `Finding the right attorney in ${county}, ${state} starts with understanding your options. Independent and solo attorneys often give clients direct access to the lawyer handling their case, personalized attention, and more flexible fees than large firms. Caseway maps these attorneys so you can see who practices near you and compare them at a glance.`,
    `When you compare attorneys in ${county}, look for a clear match between your legal issue and their practice areas, relevant experience, transparent fees, and responsive communication. Many list a free initial consultation, so you can ask questions before committing. ${DISCLAIMER}`,
  ];
}

export function stateIntro(state: string): string[] {
  return [
    `Looking for an attorney in ${state}? Caseway maps independent and solo attorneys across ${state} so you can browse by county, compare practice areas and fees, and reach the lawyer handling your case directly. Independent attorneys often give clients more personal attention and more flexible fees than large firms.`,
    `Choose the county nearest you to see who practices in your area, then narrow by the kind of legal help you need. Many ${state} attorneys offer a free initial consultation, so you can ask questions before committing. ${DISCLAIMER}`,
  ];
}

export function practiceAreaIntro(area: string): string[] {
  const blurb = practiceAreaBlurb(area);
  return [
    `Attorneys who handle ${area} ${blurb}. Caseway lists independent and solo ${area} attorneys across the United States — browse by location, see how each one works, and compare them side by side before you reach out.`,
    `Because every case is different, it helps to weigh an attorney's experience with matters like yours, how their fees are structured, and how clearly they communicate. Many ${area} attorneys offer a free initial consultation. ${DISCLAIMER}`,
  ];
}

export function directoryIntro(): string[] {
  return [
    `Caseway is a nationwide directory of independent and solo attorneys. Browse by state and county to find lawyers near you, or start from a legal topic to see attorneys who handle that kind of case across the country.`,
    `Every listing is reviewed before it goes live, but you should always confirm an attorney's credentials and bar standing directly before hiring. ${DISCLAIMER}`,
  ];
}

export function practiceAreaCountyIntro(
  area: string,
  county: string,
  state: string,
): string[] {
  const blurb = practiceAreaBlurb(area);
  // Lead with "Attorneys who handle {area}" rather than "{area} attorneys" —
  // several category labels are plural nouns (Visas, Wills, Green Cards) that
  // read awkwardly as a noun-adjective ("Visas attorneys ...").
  return [
    `Attorneys who handle ${area} ${blurb}. On Caseway you can browse independent and solo attorneys serving ${county}, ${state}, see how each one works, and compare them side by side before you reach out.`,
    `Because every case is different, it helps to weigh an attorney's experience with matters like yours, how their fees are structured, and how clearly they communicate. Many ${area} attorneys offer a free initial consultation. ${DISCLAIMER}`,
  ];
}
