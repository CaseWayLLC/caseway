import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Attorney account tier, chosen at signup and stored in Supabase user_metadata.
// It gates how many listings the account may hold: solo = one, firm = many.
// Treat ONLY an exact "firm" as a firm; every missing/invalid value is solo.
// This MUST mirror getAccountType on the server (lib/supabaseAuth.ts), which is
// the authoritative enforcement point.
export type AccountType = "solo" | "firm";

export function getAccountType(user: User | null | undefined): AccountType {
  const raw = (user?.user_metadata as { accountType?: unknown } | undefined)
    ?.accountType;
  return raw === "firm" ? "firm" : "solo";
}

// Firm-account review status. The authoritative copy lives in service-role-only
// app_metadata (the server can NEVER be fooled by a client). This client read is
// for UI gating only and MUST mirror getFirmStatus on the server. A firm account
// with no/invalid value is treated as "pending". Solo accounts ignore this.
export type FirmStatus = "pending" | "approved" | "rejected";

export function getFirmStatus(user: User | null | undefined): FirmStatus {
  const raw = (user?.app_metadata as { firmStatus?: unknown } | undefined)
    ?.firmStatus;
  return raw === "approved" || raw === "rejected" ? raw : "pending";
}

// Firm details collected at signup / upgrade and stored in user_metadata.
export type FirmDetails = {
  firmName: string;
  firmWebsite: string;
  firmAddress: string;
  firmPhone: string;
};

function readStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function getFirmInfo(user: User | null | undefined): FirmDetails {
  const m = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return {
    firmName: readStr(m.firmName),
    firmWebsite: readStr(m.firmWebsite),
    firmAddress: readStr(m.firmAddress),
    firmPhone: readStr(m.firmPhone),
  };
}

// Upgrade the signed-in account from solo to law firm. The account enters the
// firm-approval queue (firmStatus lives in service-role-only app_metadata, so it
// stays "pending" until an admin approves it — the client cannot set it). The
// firm details go into user_metadata for the admin's review. updateUser merges
// the provided keys (other keys, e.g. referrer info, are kept) and fires an
// onAuthStateChange("USER_UPDATED") so the AuthProvider's session — and so
// getAccountType(user) — reflects the change immediately.
export async function upgradeToFirm(details: FirmDetails): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: {
      accountType: "firm",
      firmName: details.firmName,
      firmWebsite: details.firmWebsite,
      firmAddress: details.firmAddress,
      firmPhone: details.firmPhone,
    },
  });
  if (error) throw error;
}
