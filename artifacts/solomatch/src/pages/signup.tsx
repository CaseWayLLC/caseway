import { useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateAttorney,
  useCreateCheckoutSession,
  useListMyAttorneys,
  getListAttorneysQueryKey,
  getListMyAttorneysQueryKey,
  getGetDirectoryStatsQueryKey,
} from "@workspace/api-client-react";
import { ArrowUpCircle, Loader2, Clock, XCircle } from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { getAccountType, getFirmStatus } from "@/lib/account";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AttorneyListingForm,
  attorneyFormToApiBody,
  type AttorneyFormValues,
} from "@/components/attorney-form";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createAttorney = useCreateAttorney();
  const createCheckout = useCreateCheckoutSession();
  const { loading, isSignedIn, user } = useAuth();
  const accountType = getAccountType(user);
  const firmStatus = getFirmStatus(user);

  // Solo accounts may hold a single active listing, so we need the current
  // count before deciding whether to show the form or the upgrade prompt.
  const { data: myListings, isLoading: listingsLoading } = useListMyAttorneys({
    query: {
      enabled: isSignedIn === true,
      queryKey: getListMyAttorneysQueryKey(),
    },
  });

  const [refreshing, setRefreshing] = useState(false);

  // Admin approval flips app_metadata.firmStatus server-side; the client only
  // sees it after the session token refreshes. Let a pending firm pull the new
  // status on demand instead of waiting for the next automatic refresh.
  async function handleRefreshStatus() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await supabase.auth.refreshSession();
    } catch {
      toast({
        title: "Couldn't check your status",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function onSubmit(values: AttorneyFormValues) {
    try {
      const body = attorneyFormToApiBody(values);
      // A referral captured during sign-up lives in the account's user_metadata;
      // thread it through so the referrer gets credit. Coerce defensively — it's
      // user-writable metadata, and the server re-validates it anyway.
      const referrerId = Number(
        (user?.user_metadata as { referrerAttorneyId?: unknown } | undefined)
          ?.referrerAttorneyId,
      );
      if (Number.isInteger(referrerId) && referrerId > 0) {
        body.referredById = referrerId;
      }
      const created = await createAttorney.mutateAsync({ data: body });
      queryClient.invalidateQueries({ queryKey: getListAttorneysQueryKey() });
      queryClient.invalidateQueries({
        queryKey: getGetDirectoryStatsQueryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: getListMyAttorneysQueryKey(),
      });

      // Law firms are on custom, sales-managed plans — no self-serve checkout.
      // An approved firm's listing posts live immediately, so skip Checkout and
      // go straight to the confirmation page.
      if (accountType === "firm") {
        setLocation("/listing/success");
        return;
      }

      // Pay-at-submission (solo): collect payment right away, before admin
      // review. The server auto-selects the plan (discounted Founding while
      // slots remain, else Basic) and redirects back to /listing/success.
      try {
        const session = await createCheckout.mutateAsync({
          id: created.id,
          data: { flow: "signup" },
        });
        window.location.href = session.url;
      } catch {
        // The listing was created but checkout couldn't start — send them to
        // the dashboard, where they can complete payment to submit for review.
        toast({
          title: "Listing saved — payment needed",
          description:
            "We couldn't open checkout. Complete your payment from your dashboard to submit this listing for review.",
        });
        setLocation("/dashboard");
      }
    } catch (error) {
      const message =
        (error as { data?: { error?: string } })?.data?.error ||
        "Please check your inputs and try again.";
      toast({
        title: "Could not create your listing",
        description: message,
        variant: "destructive",
      });
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

  // Listing requires an account so attorneys can sign back in and manage it.
  if (!isSignedIn) {
    return <Redirect to="/sign-up" />;
  }

  // Wait for the listing count before deciding the solo gate, so we don't flash
  // the full form and then replace it with the upgrade prompt.
  if (accountType === "solo" && listingsLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center py-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const activeCount = (myListings ?? []).filter(
    (a) => a.status !== "rejected",
  ).length;

  // Solo cap reached: offer a one-click upgrade to a law firm account instead of
  // the intake form. (The server enforces this too — this is the friendly path.)
  if (accountType === "solo" && activeCount >= 1) {
    return (
      <Layout>
        <div className="flex-1 px-4 py-28">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ArrowUpCircle className="h-7 w-7" />
            </div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
              You're on a solo account
            </h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Solo accounts can list one practice. Upgrade to a law firm account
              to list additional attorneys — each listing keeps its own
              subscription.
            </p>
            <Button asChild size="lg" className="mt-7 h-12 w-full rounded-full">
              <Link href="/upgrade-firm">Upgrade to a law firm account</Link>
            </Button>
            <div className="mt-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-primary hover:underline"
              >
                Back to my listings
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Firm account awaiting approval: it can't post until an admin approves it.
  if (accountType === "firm" && firmStatus === "pending") {
    return (
      <Layout>
        <div className="flex-1 px-4 py-28">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Clock className="h-7 w-7" />
            </div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
              Your firm is awaiting approval
            </h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Law firm accounts are reviewed before posting — typically within
              3-5 business days. Once approved, you can list unlimited attorneys
              that go live as soon as you publish them. Law firm plans are custom
              and arranged with our team.
            </p>
            <Button
              onClick={handleRefreshStatus}
              disabled={refreshing}
              size="lg"
              className="mt-7 h-12 w-full rounded-full"
            >
              {refreshing && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Check approval status
            </Button>
            <div className="mt-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-primary hover:underline"
              >
                Back to my dashboard
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Firm account rejected: cannot post. Point them to support.
  if (accountType === "firm" && firmStatus === "rejected") {
    return (
      <Layout>
        <div className="flex-1 px-4 py-28">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <XCircle className="h-7 w-7" />
            </div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
              Your firm application wasn't approved
            </h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We weren't able to approve your law firm account. If you think this
              was a mistake, please get in touch and we'll take another look.
            </p>
            <Button asChild size="lg" className="mt-7 h-12 w-full rounded-full">
              <Link href="/contact">Contact us</Link>
            </Button>
            <div className="mt-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-primary hover:underline"
              >
                Back to my dashboard
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <AttorneyListingForm
        heading="List Practice"
        subheading="List your practice and get in front of clients actively searching for your expertise — whether you're an independent attorney or a firm listing your team."
        submitLabel={
          accountType === "firm"
            ? "Publish listing"
            : "Submit & start subscription"
        }
        pendingLabel="Submitting..."
        isSubmitting={createAttorney.isPending || createCheckout.isPending}
        onSubmit={onSubmit}
        prefillEmail={user?.email}
      />
    </Layout>
  );
}
