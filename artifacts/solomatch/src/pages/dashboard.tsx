import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMyAttorneys,
  useDeleteAttorney,
  useSetAttorneyPaused,
  useGetBillingPlans,
  useCreateCheckoutSession,
  useCreateBillingPortalSession,
  useConfirmBilling,
  useUpgradeListingToPro,
  useGetAttorneyAnalytics,
  getListMyAttorneysQueryKey,
  getListAttorneysQueryKey,
  getGetDirectoryStatsQueryKey,
  getGetBillingPlansQueryKey,
  getGetAttorneyAnalyticsQueryKey,
  type Plan,
} from "@workspace/api-client-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Loader2,
  Pencil,
  Plus,
  FileText,
  Trash2,
  PauseCircle,
  PlayCircle,
  Users,
  CreditCard,
  BarChart3,
  Eye,
  CalendarCheck,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
  Circle,
  ArrowUpCircle,
  Link2,
  Copy,
  Check,
  Clock,
  XCircle,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { getAccountType, getFirmStatus } from "@/lib/account";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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
import { useToast } from "@/hooks/use-toast";
import { resolvePhotoUrl } from "@/lib/photo";

type Listing = {
  id: number;
  fullName: string;
  title: string;
  firmName: string;
  officeAddress: string;
  photoUrl: string | null;
  bio?: string | null;
  calendlyUrl?: string | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  barNumber?: string | null;
  status: string;
  subscriptionStatus?: string | null;
  billingTier?: string | null;
};

// Optional-but-valuable fields that strengthen a public profile. Required intake
// fields are always present, so completeness measures the extras that build
// client trust and improve conversion.
const COMPLETENESS_CHECKS: { label: string; done: (a: Listing) => boolean }[] =
  [
    { label: "Professional headshot", done: (a) => Boolean(a.photoUrl) },
    {
      label: "Bio / about section",
      done: (a) => (a.bio?.trim().length ?? 0) >= 40,
    },
    { label: "Online booking link", done: (a) => Boolean(a.calendlyUrl) },
    { label: "Website", done: (a) => Boolean(a.websiteUrl) },
    { label: "LinkedIn profile", done: (a) => Boolean(a.linkedinUrl) },
    { label: "State bar number", done: (a) => Boolean(a.barNumber) },
  ];

function ProfileCompleteness({ a }: { a: Listing }) {
  const results = COMPLETENESS_CHECKS.map((c) => ({
    label: c.label,
    done: c.done(a),
  }));
  const doneCount = results.filter((r) => r.done).length;
  const total = results.length;
  const pct = Math.round((doneCount / total) * 100);
  const missing = results.filter((r) => !r.done);
  const complete = missing.length === 0;

  return (
    <div className="border-t border-border/60 bg-muted/20 px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          Profile strength
        </span>
        <span
          className={`text-sm font-semibold ${
            complete ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {pct}%
        </span>
      </div>
      <Progress value={pct} className="mt-2 h-2" />
      {complete ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          Your profile is fully complete.
        </p>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Add these to help clients choose you:
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {missing.map((m) => (
              <li
                key={m.label}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />
                {m.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function isActiveSub(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

const TIER_LABELS: Record<string, string> = {
  founding: "Founding",
  basic: "Basic",
  pro: "Pro",
};

function formatPrice(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function badgeClass(className: string): string {
  return `inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${className}`;
}

// Paid-posts model: an approved listing is only "Live" while it has an active
// subscription. Approved-but-unsubscribed shows as "Approved" so the owner
// knows they still need to choose a plan to publish.
function StatusBadge({ a }: { a: Listing }) {
  if (a.status === "approved") {
    return isActiveSub(a.subscriptionStatus) ? (
      <span
        className={badgeClass("bg-primary/10 text-primary border-primary/20")}
      >
        Live
      </span>
    ) : (
      <span
        className={badgeClass(
          "bg-amber-500/10 text-amber-700 border-amber-500/20",
        )}
      >
        Approved · not published
      </span>
    );
  }
  const map: Record<string, { label: string; className: string }> = {
    pending: {
      label: "Pending review",
      className: "bg-muted text-muted-foreground border-border",
    },
    rejected: {
      label: "Not approved",
      className: "bg-destructive/10 text-destructive border-destructive/20",
    },
    paused: {
      label: "Paused",
      className: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    },
  };
  const s = map[a.status] ?? map.pending;
  return <span className={badgeClass(s.className)}>{s.label}</span>;
}

const ANALYTICS_PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

function AnalyticsStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <Card className="rounded-xl border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold tabular-nums">
            {value.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground truncate">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsPanel({ attorneyId }: { attorneyId: number }) {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, isError } = useGetAttorneyAnalytics(
    attorneyId,
    days,
    { query: { queryKey: getGetAttorneyAnalyticsQueryKey(attorneyId, days) } },
  );

  const totals = data?.totals;
  const timeseries = data?.timeseries ?? [];
  const hasActivity =
    !!totals &&
    totals.profileViews + totals.consultationClicks + totals.websiteClicks > 0;

  return (
    <div className="border-t border-border/60 px-6 py-6 space-y-5 bg-muted/20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h4 className="font-medium">Performance</h4>
          <p className="text-sm text-muted-foreground">
            How clients are engaging with this listing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ANALYTICS_PERIODS.map((p) => (
            <Button
              key={p.days}
              size="sm"
              variant={days === p.days ? "default" : "outline"}
              className="rounded-full border-border/60"
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError || !data ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          We couldn't load analytics right now. Please try again shortly.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AnalyticsStat
              icon={Eye}
              label="Profile views"
              value={totals?.profileViews ?? 0}
            />
            <AnalyticsStat
              icon={CalendarCheck}
              label="Consultation clicks"
              value={totals?.consultationClicks ?? 0}
            />
            <AnalyticsStat
              icon={ExternalLink}
              label="Website clicks"
              value={totals?.websiteClicks ?? 0}
            />
          </div>

          <Card className="rounded-xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Activity over time
              </CardTitle>
              <CardDescription>Daily interactions</CardDescription>
            </CardHeader>
            <CardContent>
              {!hasActivity ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No activity in this period yet. Engagement will appear here
                  once clients start viewing your listing.
                </p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeseries}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))" }}
                        contentStyle={{
                          borderRadius: "0.75rem",
                          border: "1px solid hsl(var(--border))",
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12 }}
                        iconType="circle"
                      />
                      <Bar
                        dataKey="profileViews"
                        name="Profile views"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="consultationClicks"
                        name="Consultation clicks"
                        fill="hsl(var(--gold))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="websiteClicks"
                        name="Website clicks"
                        fill="hsl(var(--muted-foreground))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ListingCard({
  a,
  plans,
  foundingAvailable,
  isFirm,
}: {
  a: Listing;
  plans: Plan[];
  foundingAvailable: boolean;
  isFirm: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteAttorney = useDeleteAttorney();
  const setPaused = useSetAttorneyPaused();
  const createCheckout = useCreateCheckoutSession();
  const createPortal = useCreateBillingPortalSession();
  const upgradePro = useUpgradeListingToPro();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const subscribed = isActiveSub(a.subscriptionStatus);
  const isPro = a.billingTier === "pro";
  // Checkout auto-selects the plan server-side: discounted Founding while slots
  // remain, else Basic. Surface the price the attorney will actually be charged.
  const autoPlan = foundingAvailable
    ? (plans.find((p) => p.tier === "founding") ??
      plans.find((p) => p.tier === "basic"))
    : plans.find((p) => p.tier === "basic");
  const proPlan = plans.find((p) => p.tier === "pro");

  async function handleCompletePayment() {
    try {
      const session = await createCheckout.mutateAsync({
        id: a.id,
        data: { flow: "dashboard" },
      });
      window.location.href = session.url;
    } catch (error) {
      const message =
        (error as { data?: { error?: string } })?.data?.error ||
        "Please try again in a moment.";
      toast({
        title: "Could not start checkout",
        description: message,
        variant: "destructive",
      });
    }
  }

  async function handleUpgradePro() {
    try {
      await upgradePro.mutateAsync({ id: a.id });
      invalidateListingQueries();
      setProOpen(false);
      toast({
        title: "Upgraded to Pro",
        description: `${a.fullName} now ranks above standard listings in search.`,
      });
    } catch (error) {
      const message =
        (error as { data?: { error?: string } })?.data?.error ||
        "Please try again in a moment.";
      toast({
        title: "Could not upgrade to Pro",
        description: message,
        variant: "destructive",
      });
    }
  }

  async function handleManageBilling() {
    try {
      const session = await createPortal.mutateAsync({ id: a.id });
      window.location.href = session.url;
    } catch (error) {
      const message =
        (error as { data?: { error?: string } })?.data?.error ||
        "Please try again in a moment.";
      toast({
        title: "Could not open billing",
        description: message,
        variant: "destructive",
      });
    }
  }

  function invalidateListingQueries() {
    queryClient.invalidateQueries({ queryKey: getListMyAttorneysQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAttorneysQueryKey() });
    queryClient.invalidateQueries({
      queryKey: getGetDirectoryStatsQueryKey(),
    });
  }

  async function handleTogglePause(paused: boolean) {
    try {
      await setPaused.mutateAsync({ id: a.id, data: { paused } });
      invalidateListingQueries();
      toast({
        title: paused ? "Listing paused" : "Listing resumed",
        description: paused
          ? `${a.fullName} is hidden from the public directory. Resume any time.`
          : `${a.fullName} is live in the public directory again.`,
      });
    } catch (error) {
      const message =
        (error as { data?: { error?: string } })?.data?.error ||
        "Please try again in a moment.";
      toast({
        title: paused ? "Could not pause listing" : "Could not resume listing",
        description: message,
        variant: "destructive",
      });
    }
  }

  async function handleRemove() {
    try {
      await deleteAttorney.mutateAsync({ id: a.id });
      queryClient.invalidateQueries({ queryKey: getListMyAttorneysQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListAttorneysQueryKey() });
      queryClient.invalidateQueries({
        queryKey: getGetDirectoryStatsQueryKey(),
      });
      setConfirmOpen(false);
      toast({
        title: "Listing removed",
        description: `${a.fullName} is no longer listed on Caseway.`,
      });
    } catch (error) {
      const message =
        (error as { data?: { error?: string } })?.data?.error ||
        "Please try again in a moment.";
      toast({
        title: "Could not remove listing",
        description: message,
        variant: "destructive",
      });
    }
  }

  return (
    <Card className="rounded-2xl border-border/60 overflow-hidden">
      <CardContent className="p-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-5 min-w-0 xl:flex-1">
          <Avatar className="h-16 w-16 border border-border/60 shrink-0">
            <AvatarImage
              src={resolvePhotoUrl(a.photoUrl)}
              className="object-cover"
            />
            <AvatarFallback>{a.fullName.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-serif text-xl font-medium truncate">
                {a.fullName}
              </h3>
              <StatusBadge a={a} />
            </div>
            <p className="text-muted-foreground mt-1">
              {a.title} · {a.firmName}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {a.officeAddress}
            </p>
            {a.status === "pending" && subscribed && (
              <p className="text-sm text-muted-foreground mt-2">
                Payment received. Awaiting admin review (typically 3-5 business
                days) — your listing goes live in the directory once approved.
              </p>
            )}
            {a.status === "pending" && !subscribed && (
              <p className="text-sm text-muted-foreground mt-2">
                Complete your payment to submit this listing for admin review.
              </p>
            )}
            {a.status === "approved" && subscribed && (
              <p className="text-sm text-muted-foreground mt-2">
                {a.billingTier
                  ? `Live on the ${TIER_LABELS[a.billingTier] ?? a.billingTier} plan`
                  : "Live in the directory"}
                {!isPro && !isFirm
                  ? " — upgrade to Pro for top placement in search."
                  : "."}
              </p>
            )}
            {a.status === "approved" && !subscribed && (
              <p className="text-sm text-muted-foreground mt-2">
                {isFirm
                  ? "Live in the directory. Your firm is on a custom plan — our team manages your billing."
                  : "Approved, but your subscription is inactive — complete payment to make your listing live in the directory."}
              </p>
            )}
            {a.status === "rejected" && (
              <p className="text-sm text-muted-foreground mt-2">
                This listing wasn't approved, so billing was canceled. Edit and
                resubmit for another review.
              </p>
            )}
            {a.status === "paused" && (
              <p className="text-sm text-muted-foreground mt-2">
                Paused — hidden from the public directory. Resume any time to
                make it live again, no re-approval needed.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {!isFirm && !subscribed && a.status !== "rejected" && (
            <Button
              className="rounded-full shadow-sm"
              disabled={createCheckout.isPending}
              onClick={handleCompletePayment}
            >
              {createCheckout.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              {autoPlan
                ? `Complete payment · ${formatPrice(
                    autoPlan.unitAmount,
                    autoPlan.currency,
                  )}/${autoPlan.interval}`
                : "Complete payment"}
            </Button>
          )}
          {!isFirm && subscribed && !isPro && a.status !== "rejected" && (
            <Button
              className="rounded-full shadow-sm bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={upgradePro.isPending}
              onClick={() => setProOpen(true)}
            >
              {upgradePro.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpCircle className="mr-2 h-4 w-4" />
              )}
              Upgrade to Pro
            </Button>
          )}
          {subscribed && (
            <Button
              variant="outline"
              className="rounded-full border-border/60"
              disabled={createPortal.isPending}
              onClick={handleManageBilling}
            >
              {createPortal.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Manage billing
            </Button>
          )}
          {a.status === "approved" && subscribed && (
            <Button
              variant="outline"
              className="rounded-full border-border/60"
              disabled={setPaused.isPending}
              onClick={() => handleTogglePause(true)}
            >
              {setPaused.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PauseCircle className="mr-2 h-4 w-4" />
              )}
              Pause
            </Button>
          )}
          {a.status === "paused" && (
            <Button
              variant="outline"
              className="rounded-full border-border/60"
              disabled={setPaused.isPending}
              onClick={() => handleTogglePause(false)}
            >
              {setPaused.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Resume
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-full border-border/60"
            onClick={() => setAnalyticsOpen((open) => !open)}
            aria-expanded={analyticsOpen}
          >
            <BarChart3 className="mr-2 h-4 w-4" /> Analytics
            <ChevronDown
              className={`ml-2 h-4 w-4 transition-transform ${
                analyticsOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-border/60"
          >
            <Link href={`/listing/edit/${a.id}`}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="rounded-full text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Remove
          </Button>
        </div>
      </CardContent>

      <ProfileCompleteness a={a} />

      {analyticsOpen && <AnalyticsPanel attorneyId={a.id} />}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              {a.fullName} will be permanently removed from Caseway and will no
              longer appear in the public directory. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-full"
              disabled={deleteAttorney.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAttorney.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleRemove();
              }}
            >
              {deleteAttorney.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removing...
                </>
              ) : (
                "Remove listing"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={proOpen} onOpenChange={setProOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Upgrade to Pro?</AlertDialogTitle>
            <AlertDialogDescription>
              {proPlan
                ? `Your subscription switches to the Pro plan (${formatPrice(
                    proPlan.unitAmount,
                    proPlan.currency,
                  )}/${proPlan.interval}), prorated for the rest of this billing period. ${a.fullName} will rank above standard listings in search.`
                : `Your subscription switches to the Pro plan, prorated for the rest of this billing period. ${a.fullName} will rank above standard listings in search.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-full"
              disabled={upgradePro.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={upgradePro.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleUpgradePro();
              }}
            >
              {upgradePro.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Upgrading...
                </>
              ) : (
                "Upgrade to Pro"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function Dashboard() {
  const { loading: authLoading, isSignedIn, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirmBilling = useConfirmBilling();
  const { data, isLoading, isError } = useListMyAttorneys({
    query: {
      enabled: isSignedIn === true,
      queryKey: getListMyAttorneysQueryKey(),
    },
  });
  const { data: billing } = useGetBillingPlans({
    query: {
      enabled: isSignedIn === true,
      queryKey: getGetBillingPlansQueryKey(),
    },
  });

  const accountType = getAccountType(user);
  const firmStatus = getFirmStatus(user);

  // Returning from Stripe Checkout: ?billing=success → confirm + refresh. The
  // Stripe-managed webhook only fires against the production domain, so in
  // development this explicit confirm is what reflects the new subscription.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingParam = params.get("billing");
    if (!billingParam) return;
    if (billingParam === "success") {
      confirmBilling
        .mutateAsync()
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: getListMyAttorneysQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getListAttorneysQueryKey(),
          });
          toast({
            title: "Payment received",
            description:
              "Your subscription is active. Your listing goes live in the directory once it's approved.",
          });
        })
        .catch(() => {
          toast({
            title: "Payment received",
            description:
              "It may take a moment to reflect. Refresh in a few seconds.",
          });
        });
    } else if (billingParam === "cancel") {
      toast({
        title: "Checkout canceled",
        description: "No charge was made. You can complete payment anytime.",
      });
    }
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authLoading) {
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  const listings = data ?? [];
  // Solo accounts may hold a single active listing (rejected ones don't count).
  // When they're at the cap, the "list another" CTA becomes an upgrade prompt.
  const activeCount = listings.filter((a) => a.status !== "rejected").length;
  const soloAtCap = accountType === "solo" && activeCount >= 1;
  // A firm can only post once an admin has approved the account. Until then the
  // "list another" CTA is replaced by a status note (the server enforces this).
  const firmApproved = accountType === "firm" && firmStatus === "approved";
  const firmPending = accountType === "firm" && firmStatus === "pending";
  const firmRejected = accountType === "firm" && firmStatus === "rejected";

  return (
    <Layout>
      <div className="flex-1 pt-28 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl sm:text-5xl font-serif font-medium tracking-tight">
                My Listings
              </h1>
              <p className="text-muted-foreground text-lg mt-3">
                Manage the practices you've listed on Caseway.
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                {accountType === "firm" ? (
                  firmPending ? (
                    <>
                      <Clock className="h-3.5 w-3.5" /> Law firm — pending
                      approval
                    </>
                  ) : firmRejected ? (
                    <>
                      <XCircle className="h-3.5 w-3.5" /> Law firm — not approved
                    </>
                  ) : (
                    <>
                      <Users className="h-3.5 w-3.5" /> Law firm account
                    </>
                  )
                ) : (
                  <>
                    <Circle className="h-3.5 w-3.5" /> Solo account
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button
                asChild
                variant="outline"
                className="rounded-full h-12 px-6 border-border/60"
              >
                <Link href="/network">
                  <Users className="mr-2 h-5 w-5" /> Attorney network
                </Link>
              </Button>
              {soloAtCap ? (
                <Button asChild className="rounded-full h-12 px-6 shadow-sm">
                  <Link href="/upgrade-firm">
                    <ArrowUpCircle className="mr-2 h-5 w-5" /> Upgrade to law firm
                  </Link>
                </Button>
              ) : firmPending ? (
                <Button
                  disabled
                  className="rounded-full h-12 px-6 shadow-sm"
                  title="Your firm is awaiting approval"
                >
                  <Clock className="mr-2 h-5 w-5" /> Awaiting approval
                </Button>
              ) : firmRejected ? (
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full h-12 px-6 border-border/60"
                >
                  <Link href="/contact">Contact us</Link>
                </Button>
              ) : (
                <Button asChild className="rounded-full h-12 px-6 shadow-sm">
                  <Link href="/signup">
                    <Plus className="mr-2 h-5 w-5" /> List another practice
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <Card className="rounded-2xl">
              <CardContent className="py-16 text-center text-muted-foreground">
                We couldn't load your listings. Please refresh and try again.
              </CardContent>
            </Card>
          ) : listings.length === 0 ? (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="py-20 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted text-muted-foreground mb-6">
                  <FileText className="h-8 w-8" />
                </div>
                <h2 className="font-serif text-2xl font-medium mb-3">
                  No listings yet
                </h2>
                <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8">
                  List your practice to start connecting with clients looking
                  for your expertise.
                </p>
                <Button asChild size="lg" className="rounded-full h-12 px-8">
                  <Link href="/signup">List Your Practice</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {listings.map((a) => (
                <div key={a.id} className="space-y-5">
                  <ListingCard
                    a={a}
                    plans={billing?.plans ?? []}
                    foundingAvailable={billing?.foundingAvailable ?? false}
                    isFirm={accountType === "firm"}
                  />
                  {/* Referral credit only counts once this listing is approved
                      (see resolveReferrer on the server), so don't offer the
                      invite link until then — a pre-approval link would never
                      credit them. */}
                  {a.status === "approved" && (
                    <ReferralInvite
                      attorneyId={a.id}
                      attorneyName={a.fullName}
                    />
                  )}
                </div>
              ))}

              <p className="pt-4 text-center text-xs text-muted-foreground/70">
                Listing payments are collected and processed by Indicium Markets
                Inc.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function ReferralInvite({
  attorneyId,
  attorneyName,
}: {
  attorneyId: number;
  attorneyName: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/sign-up?ref=${attorneyId}`;

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card className="rounded-2xl border-border/60 overflow-hidden bg-muted/20">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground">
              Invite an attorney (for {attorneyName})
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Share this link with a colleague. When they sign up and list their
              practice, you get credit on the referral leaderboard.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <div className="flex-1 min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground truncate">
                {link}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-border/60 shrink-0"
                onClick={copyLink}
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CenterLoader() {
  return (
    <div className="flex-1 flex items-center justify-center py-40">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
