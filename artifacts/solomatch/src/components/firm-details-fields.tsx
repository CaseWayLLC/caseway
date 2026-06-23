import { cn } from "@/lib/utils";
import type { FirmDetails } from "@/lib/account";

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30";

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
      {children}
    </label>
  );
}

// Shared firm-detail inputs used both at account creation (the sign-up form's
// "law firm" branch) and on the solo->firm upgrade page. Fully controlled so the
// caller owns the values and validation; this component only renders the inputs.
export function FirmDetailsFields({
  value,
  onChange,
  idPrefix = "firm",
}: {
  value: FirmDetails;
  onChange: (next: FirmDetails) => void;
  idPrefix?: string;
}) {
  function set<K extends keyof FirmDetails>(key: K, v: string) {
    onChange({ ...value, [key]: v });
  }
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={`${idPrefix}-name`}>Firm name</FieldLabel>
        <input
          id={`${idPrefix}-name`}
          type="text"
          required
          value={value.firmName}
          onChange={(e) => set("firmName", e.target.value)}
          placeholder="Smith & Associates LLP"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={`${idPrefix}-website`}>Firm website</FieldLabel>
        <input
          id={`${idPrefix}-website`}
          type="url"
          required
          value={value.firmWebsite}
          onChange={(e) => set("firmWebsite", e.target.value)}
          placeholder="https://www.yourfirm.com"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={`${idPrefix}-address`}>
          Main office address
        </FieldLabel>
        <input
          id={`${idPrefix}-address`}
          type="text"
          required
          value={value.firmAddress}
          onChange={(e) => set("firmAddress", e.target.value)}
          placeholder="123 Main St, Suite 400, Stamford, CT 06901"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={`${idPrefix}-phone`}>
          Main contact phone
        </FieldLabel>
        <input
          id={`${idPrefix}-phone`}
          type="tel"
          required
          value={value.firmPhone}
          onChange={(e) => set("firmPhone", e.target.value)}
          placeholder="(203) 555-0100"
          className={cn(inputClass)}
        />
      </div>
    </div>
  );
}

// Trim + validate firm details. Returns an error message string, or null when
// all fields are acceptable. Shared so the sign-up form and upgrade page enforce
// the same rules. Website must be an http(s) URL (matches the server's URL
// allowlist used elsewhere).
export function validateFirmDetails(details: FirmDetails): string | null {
  if (!details.firmName.trim()) return "Please enter your firm's name.";
  if (!details.firmWebsite.trim()) return "Please enter your firm's website.";
  try {
    const u = new URL(details.firmWebsite.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "Please enter a valid website URL (starting with http:// or https://).";
    }
  } catch {
    return "Please enter a valid website URL (starting with http:// or https://).";
  }
  if (!details.firmAddress.trim()) {
    return "Please enter your firm's main office address.";
  }
  if (!details.firmPhone.trim()) {
    return "Please enter a main contact phone number.";
  }
  return null;
}

export function trimFirmDetails(details: FirmDetails): FirmDetails {
  return {
    firmName: details.firmName.trim(),
    firmWebsite: details.firmWebsite.trim(),
    firmAddress: details.firmAddress.trim(),
    firmPhone: details.firmPhone.trim(),
  };
}
