import { useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import { Loader2, Building2, Clock } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { getAccountType, getFirmInfo, upgradeToFirm } from "@/lib/account";
import {
  FirmDetailsFields,
  validateFirmDetails,
  trimFirmDetails,
} from "@/components/firm-details-fields";

// Solo -> law firm upgrade. Unlike the old one-click upgrade, a firm account now
// must provide its details and be admin-approved before it can post additional
// listings, so this page collects the firm info and submits it for review.
export default function UpgradeFirm() {
  const { loading, isSignedIn, user } = useAuth();
  const { toast } = useToast();
  const accountType = getAccountType(user);

  const [firm, setFirm] = useState(() => getFirmInfo(user));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const firmError = validateFirmDetails(firm);
    if (firmError) {
      setError(firmError);
      return;
    }
    setSubmitting(true);
    try {
      await upgradeToFirm(trimFirmDetails(firm));
      setSubmitted(true);
      toast({
        title: "Law firm application submitted",
        description: "We'll review your firm and email you once it's approved.",
      });
    } catch {
      setError("We couldn't submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center py-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  // Already a firm (and not the one who just submitted on this page): nothing to
  // upgrade — send them to the dashboard where their firm status is shown.
  if (accountType === "firm" && !submitted) {
    return <Redirect to="/dashboard" />;
  }

  if (submitted) {
    return (
      <Layout>
        <div className="flex-1 px-4 py-28">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Clock className="h-7 w-7" />
            </div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
              Application submitted
            </h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Your law firm account is now pending approval. Once our team
              approves it, you'll be able to list unlimited attorneys — each goes
              live as soon as you publish it, with no per-listing review. Law
              firm plans are custom — our team will work with you on pricing.
            </p>
            <Button asChild size="lg" className="mt-7 h-12 w-full rounded-full">
              <Link href="/dashboard">Back to my dashboard</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1 px-4 py-28">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-7 w-7" />
            </div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
              Upgrade to a law firm account
            </h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Tell us about your firm. We review every law firm before it can
              post. Once approved, you can list unlimited attorneys that go live
              as soon as you publish them. Law firm plans are custom and arranged
              with our team.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <FirmDetailsFields
              value={firm}
              onChange={setFirm}
              idPrefix="upgrade-firm"
            />

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              size="lg"
              className="h-12 w-full rounded-full"
            >
              {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Submit for approval
            </Button>
            <div className="text-center">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-primary hover:underline"
              >
                Back to my listings
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
