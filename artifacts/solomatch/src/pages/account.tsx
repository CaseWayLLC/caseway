import { useState, type FormEvent } from "react";
import { Link, Redirect, useLocation } from "wouter";
import {
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Mail,
  KeyRound,
  CreditCard,
  Receipt,
  ExternalLink,
  Laptop,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  useGetAccountBillingOverview,
  getGetAccountBillingOverviewQueryKey,
  useDeleteOwnAccount,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30";

const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        tone === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary",
      )}
    >
      {children}
    </p>
  );
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Lets a signed-in attorney update the email tied to their account. Supabase
// requires the new address to be confirmed before it takes effect, so we surface
// that instruction rather than implying an instant change.
function ChangeEmailCard({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccess(null);
    const next = email.trim();
    if (!next) return;
    if (next.toLowerCase() === currentEmail.toLowerCase()) {
      setError("That is already your current email address.");
      return;
    }
    setSubmitting(true);
    try {
      // Confirm the current password before changing the email — an email
      // change is account-takeover-sensitive, so don't let an unattended
      // session repoint the login address without re-authenticating.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password,
      });
      if (signInError) {
        setError("Your current password is incorrect.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        email: next,
      });
      if (updateError) throw updateError;
      setSuccess(
        `Almost done. Check ${next} for a confirmation link (you may also need to confirm from your current email). Your email changes once confirmed.`,
      );
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="font-serif text-xl font-medium flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          Email address
        </CardTitle>
        <CardDescription>
          You currently sign in with{" "}
          <span className="font-medium text-foreground">{currentEmail}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-email">New email address</Label>
            <input
              id="new-email"
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
            <Label htmlFor="email-current-password">Current password</Label>
            <div className="relative">
              <input
                id="email-current-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Confirm with your password"
                className={cn(inputClass, "pr-10")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
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
          {error && <FormMessage tone="error">{error}</FormMessage>}
          {success && <FormMessage tone="success">{success}</FormMessage>}
          <div>
            <button
              type="submit"
              disabled={submitting}
              className={primaryButtonClass}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Update email
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Password change with a current-password re-check. Supabase lets an active
// session set a new password without the old one, but we verify the current
// password first so a borrowed/unattended session can't silently change it.
function ChangePasswordCard({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccess(null);
    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Your new password must be different from the current one.");
      return;
    }
    setSubmitting(true);
    try {
      // Re-authenticate to confirm the person at the keyboard knows the
      // existing password before we accept a new one.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) {
        setError("Your current password is incorrect.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      setSuccess("Your password has been updated.");
      reset();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="font-serif text-xl font-medium flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          Password
        </CardTitle>
        <CardDescription>
          Choose a strong password you don't use elsewhere.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-password">Current password</Label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Your current password"
                className={cn(inputClass, "pr-10")}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={cn(inputClass, "pr-10")}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <input
              id="confirm-password"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className={inputClass}
            />
          </div>

          {error && <FormMessage tone="error">{error}</FormMessage>}
          {success && <FormMessage tone="success">{success}</FormMessage>}

          <div>
            <button
              type="submit"
              disabled={submitting}
              className={primaryButtonClass}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Account-level billing & receipts. Each listing carries its own subscription
// and invoices; this rolls them up so the attorney can see what they pay and
// download receipts in one place. Day-to-day management (cancel, change plan,
// upgrade to Pro) lives on the dashboard, which this links out to.
function BillingOverviewCard() {
  const { data, isLoading, isError } = useGetAccountBillingOverview({
    query: { queryKey: getGetAccountBillingOverviewQueryKey() },
  });

  const listings = data?.listings ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="font-serif text-xl font-medium flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          Billing &amp; receipts
        </CardTitle>
        <CardDescription>
          Your plan and recent receipts across every listing on your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <FormMessage tone="error">
            We couldn't load your billing details right now. Please try again
            shortly.
          </FormMessage>
        ) : listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don't have any listings yet. Once you list your practice, your
            plan and receipts will appear here.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {listings.map((listing) => {
              const sub = listing.subscription;
              return (
                <div
                  key={listing.attorneyId}
                  className="rounded-xl border border-border/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">
                        {listing.fullName}
                      </p>
                      {listing.firmName && (
                        <p className="text-sm text-muted-foreground">
                          {listing.firmName}
                        </p>
                      )}
                    </div>
                    {listing.billingTier && (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {titleCase(listing.billingTier)} plan
                      </span>
                    )}
                  </div>

                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd className="text-foreground">
                        {sub?.status
                          ? titleCase(sub.status.replace(/_/g, " "))
                          : (listing.subscriptionStatus ?? "No subscription")}
                      </dd>
                    </div>
                    {sub?.amount != null && sub.currency && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Price</dt>
                        <dd className="text-foreground">
                          {formatMoney(sub.amount, sub.currency)}
                          {sub.interval ? ` / ${sub.interval}` : ""}
                        </dd>
                      </div>
                    )}
                    {sub?.currentPeriodEnd != null && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">
                          {sub.cancelAtPeriodEnd ? "Ends" : "Next charge"}
                        </dt>
                        <dd className="text-foreground">
                          {formatDate(sub.currentPeriodEnd)}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {sub?.cancelAtPeriodEnd && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      This subscription is set to cancel at the end of the
                      current period.
                    </p>
                  )}

                  {listing.invoices.length > 0 && (
                    <div className="mt-4 border-t border-border/60 pt-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Recent receipts
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {listing.invoices.map((invoice) => {
                          const url =
                            invoice.hostedInvoiceUrl ?? invoice.invoicePdf;
                          return (
                            <li
                              key={invoice.id}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <Receipt className="h-4 w-4 shrink-0" />
                                {formatDate(invoice.created)}
                              </span>
                              <span className="flex items-center gap-3">
                                <span className="text-foreground">
                                  {formatMoney(
                                    invoice.amountPaid ||
                                      invoice.amountDue ||
                                      0,
                                    invoice.currency,
                                  )}
                                </span>
                                {url && (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                  >
                                    View
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
            <div>
              <Button
                asChild
                variant="outline"
                className="rounded-full h-11 px-6 border-border/60"
              >
                <Link href="/dashboard">Manage billing</Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Permanently deletes the account. Re-authenticates with the current password
// (UX guard against an unattended session) and confirms in a dialog, since the
// server cancels active subscriptions and takes the user's listings down.
function DeleteAccountCard({ email }: { email: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const deleteAccount = useDeleteOwnAccount();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (submitting) return;
    setError(null);
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    setSubmitting(true);
    try {
      // Re-authenticate first so a borrowed/unattended session can't delete the
      // account without knowing the password.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError("Your password is incorrect.");
        return;
      }
      await deleteAccount.mutateAsync();
      // Clear the now-orphaned local session (the server user is gone, so a
      // global sign-out would just error).
      await supabase.auth.signOut({ scope: "local" });
      setOpen(false);
      toast({
        title: "Account deleted",
        description: "Your account and listings have been removed.",
      });
      navigate("/");
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "We couldn't delete your account. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="font-serif text-xl font-medium flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Delete account
        </CardTitle>
        <CardDescription>
          Permanently delete your account. This cancels any active subscriptions
          (no refund) and takes your listings down. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          onClick={() => {
            setError(null);
            setPassword("");
            setOpen(true);
          }}
          className="rounded-full h-11 px-6"
        >
          Delete my account
        </Button>

        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (!submitting) setOpen(next);
          }}
        >
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete your account?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your account. Any active subscriptions
                are canceled (no refund) and all of your listings are taken
                down. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-confirm-password">
                Confirm your password
              </Label>
              <div className="relative">
                <input
                  id="delete-confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className={cn(inputClass, "pr-10")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {error && <FormMessage tone="error">{error}</FormMessage>}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={submitting}
                onClick={(e) => {
                  // Keep the dialog open so we can re-auth, run the delete, and
                  // surface any error in place instead of closing immediately.
                  e.preventDefault();
                  void handleConfirm();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export default function Account() {
  const { loading: authLoading, isSignedIn, user, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  if (authLoading) {
    return (
      <Layout solidHeader>
        <div className="flex flex-1 items-center justify-center py-28">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  const email = user?.email ?? "";

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      toast({ title: "Signed out", description: "You have been signed out." });
      navigate("/");
    } finally {
      setSigningOut(false);
    }
  }

  async function handleSignOutEverywhere() {
    if (signingOutAll) return;
    setSigningOutAll(true);
    try {
      // Global scope revokes every refresh token for this user, signing them
      // out on all devices (this one included).
      await supabase.auth.signOut({ scope: "global" });
      toast({
        title: "Signed out everywhere",
        description: "You've been signed out on all devices.",
      });
      navigate("/");
    } finally {
      setSigningOutAll(false);
    }
  }

  return (
    <Layout solidHeader>
      <div className="flex-1 pt-28 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl sm:text-5xl font-serif font-medium tracking-tight">
              Account settings
            </h1>
            <p className="text-muted-foreground text-lg mt-3">
              Manage your sign-in details, billing, and account for Caseway.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <ChangeEmailCard currentEmail={email} />
            <ChangePasswordCard email={email} />
            <BillingOverviewCard />

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="font-serif text-xl font-medium">
                  Your listings
                </CardTitle>
                <CardDescription>
                  Edit your practice details, manage your subscription, or view
                  performance from your dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full h-11 px-6 border-border/60"
                >
                  <Link href="/dashboard">Go to my listings</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="font-serif text-xl font-medium">
                  Sign out
                </CardTitle>
                <CardDescription>
                  Sign out on this device, or sign out everywhere to end your
                  sessions on all devices.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    disabled={signingOut || signingOutAll}
                    className="rounded-full h-11 px-6 border-border/60"
                  >
                    {signingOut ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 h-4 w-4" />
                    )}
                    Sign out
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSignOutEverywhere}
                    disabled={signingOut || signingOutAll}
                    className="rounded-full h-11 px-6 border-border/60"
                  >
                    {signingOutAll ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Laptop className="mr-2 h-4 w-4" />
                    )}
                    Sign out of all devices
                  </Button>
                </div>
              </CardContent>
            </Card>

            <DeleteAccountCard email={email} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
