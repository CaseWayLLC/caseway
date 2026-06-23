import { useState, type FormEvent, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";
import {
  AttorneyReferralPicker,
  type ReferrerSelection,
} from "@/components/attorney-referral-picker";
import {
  FirmDetailsFields,
  validateFirmDetails,
  trimFirmDetails,
} from "@/components/firm-details-fields";
import type { FirmDetails } from "@/lib/account";
import { useGetAttorney } from "@workspace/api-client-react";

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

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30";

const primaryButtonClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

// Custom attorney sign-up form on Supabase email/password auth. It collects
// email + password (with a confirm field) plus an optional "who referred you"
// attorney picker, stored in user_metadata so the referrer gets credit at
// listing time. When email confirmation is enabled, signUp returns no session
// and we collect the emailed code (verifyOtp); when it is disabled, signUp
// returns a session immediately and we skip straight to the listing form.
export function AttorneySignUpForm() {
  const [, navigate] = useLocation();
  const search = useSearch();

  const [step, setStep] = useState<"collect" | "verify">("collect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [referred, setReferred] = useState<"yes" | "no" | null>(null);
  const [referrer, setReferrer] = useState<ReferrerSelection | null>(null);
  const [accountType, setAccountType] = useState<"solo" | "firm">("solo");
  const [firm, setFirm] = useState<FirmDetails>({
    firmName: "",
    firmWebsite: "",
    firmAddress: "",
    firmPhone: "",
  });

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto-populate referrer from ?ref=<id> on the URL. This powers attorney-to-
  // attorney invite links (e.g. /sign-up?ref=42). The server re-validates the
  // referrer at listing creation time.
  const refParam = new URLSearchParams(search).get("ref");
  const refId = refParam ? Number(refParam) : NaN;
  const { data: refAttorney } = useGetAttorney(
    Number.isInteger(refId) && refId > 0 ? refId : 0,
    {
      query: {
        enabled: Number.isInteger(refId) && refId > 0,
        queryKey: ["getAttorney", refId],
      },
    },
  );
  useEffect(() => {
    if (refAttorney && !referrer) {
      setReferred("yes");
      setReferrer({
        id: refAttorney.id,
        fullName: refAttorney.fullName,
        firmName: refAttorney.firmName,
      });
    }
  }, [refAttorney, referrer]);

  async function handleCollect(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (password.length < 8) {
      setError("Your password is too short. Please use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords don't match. Please re-enter them.");
      return;
    }
    if (referred === "yes" && !referrer) {
      setError(
        "Please pick the attorney who referred you, or choose No above.",
      );
      return;
    }
    if (accountType === "firm") {
      const firmError = validateFirmDetails(firm);
      if (firmError) {
        setError(firmError);
        return;
      }
    }

    setSubmitting(true);
    try {
      const metadata: Record<string, unknown> = { accountType };
      if (accountType === "firm") {
        // Firm details go into user_metadata for the admin's review. The
        // approval status itself lives in service-role-only app_metadata, so a
        // new firm account is "pending" until an admin approves it.
        Object.assign(metadata, trimFirmDetails(firm));
      }
      if (referred === "yes" && referrer) {
        metadata.referrerAttorneyId = referrer.id;
        metadata.referrerAttorneyName = referrer.fullName;
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      if (signUpError) throw signUpError;

      // Email-enumeration protection: signing up an already-confirmed email
      // succeeds with an obfuscated user that has no identities. Surface the
      // "already exists" hint instead of sending them to a code step that will
      // never arrive.
      if (data.user && data.user.identities?.length === 0) {
        setError(
          "An account with this email already exists. Try signing in instead.",
        );
        return;
      }

      // Confirmation disabled -> a session is returned immediately.
      if (data.session) {
        navigate("/signup");
        return;
      }

      // Confirmation enabled -> collect the emailed code.
      setStep("verify");
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "signup",
      });
      if (verifyError) throw verifyError;
      if (data.session) {
        navigate("/signup");
        return;
      }
      setError("We couldn't verify that code. Please try again.");
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (submitting) return;
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (resendError) throw resendError;
    } catch (err) {
      setError(mapAuthError(err));
    }
  }

  return (
    <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      <div className="flex flex-col items-center gap-6 px-8 py-10">
        <Logo className="h-10 w-auto" />

        {step === "collect" ? (
          <>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <h2 className="font-serif text-2xl text-foreground">
                Create your account
              </h2>
              <p className="text-sm text-muted-foreground">
                List your practice on Caseway
              </p>
            </div>

            <form
              onSubmit={handleCollect}
              className="flex w-full flex-col gap-5"
            >
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="signup-account-solo">
                  Account type
                </FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="signup-account-solo"
                    type="button"
                    onClick={() => setAccountType("solo")}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      accountType === "solo"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:bg-muted/60",
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">
                      Solo attorney
                    </span>
                    <span className="text-xs text-muted-foreground">
                      One listing
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType("firm")}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      accountType === "firm"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:bg-muted/60",
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">
                      Law firm
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Multiple listings
                    </span>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  You can upgrade a solo account to a law firm later.
                </p>
              </div>

              {accountType === "firm" && (
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">
                      Firm details
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Law firm accounts are reviewed before posting. Once
                      approved, you can list unlimited attorneys that go live as
                      soon as you publish them. Law firm plans are custom and
                      arranged with our team.
                    </p>
                  </div>
                  <FirmDetailsFields
                    value={firm}
                    onChange={setFirm}
                    idPrefix="signup-firm"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="signup-email">Email address</FieldLabel>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@firm.com"
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={cn(inputClass, "pr-10")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="signup-confirm">
                  Confirm password
                </FieldLabel>
                <div className="relative">
                  <input
                    id="signup-confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className={cn(inputClass, "pr-10")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-xs text-destructive">
                    Passwords don't match yet.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="signup-referred-yes">
                  Were you referred by an attorney?
                </FieldLabel>
                <div className="flex gap-2">
                  <button
                    id="signup-referred-yes"
                    type="button"
                    onClick={() => setReferred("yes")}
                    className={cn(
                      "h-10 flex-1 rounded-xl border text-sm font-medium transition-colors",
                      referred === "yes"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:bg-muted/60",
                    )}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReferred("no");
                      setReferrer(null);
                    }}
                    className={cn(
                      "h-10 flex-1 rounded-xl border text-sm font-medium transition-colors",
                      referred === "no"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:bg-muted/60",
                    )}
                  >
                    No
                  </button>
                </div>
                {referred === "yes" && (
                  <div className="pt-1">
                    <AttorneyReferralPicker
                      value={referrer}
                      onSelect={setReferrer}
                    />
                  </div>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={primaryButtonClass}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
              </button>
            </form>

            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-primary hover:text-primary/80"
              >
                Sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <h2 className="font-serif text-2xl text-foreground">
                Verify your email
              </h2>
              <p className="text-sm text-muted-foreground">
                We sent a verification code to{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </p>
            </div>

            <form
              onSubmit={handleVerify}
              className="flex w-full flex-col gap-5"
            >
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="signup-code">Verification code</FieldLabel>
                <input
                  id="signup-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter the 6-digit code"
                  className={cn(inputClass, "text-center tracking-[0.3em]")}
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={primaryButtonClass}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify email
              </button>
            </form>

            <div className="flex flex-col items-center gap-3 text-sm">
              <button
                type="button"
                onClick={handleResend}
                className="font-medium text-primary hover:text-primary/80"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("collect");
                  setError(null);
                  setCode("");
                }}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
