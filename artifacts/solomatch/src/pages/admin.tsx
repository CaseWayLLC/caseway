import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAdminSession,
  useAdminLogin,
  useAdminLogout,
  useListAttorneyApplications,
  useApproveAttorney,
  useRejectAttorney,
  useGetAdminAnalytics,
  useListAnalyticsEvents,
  useAdminDeleteAttorney,
  useAdminUpdateAttorney,
  useListArchivedAttorneys,
  useRestoreAttorney,
  usePermanentlyDeleteAttorney,
  useBulkGeocodeAttorneys,
  useVerifyAttorney,
  useSetAttorneyPro,
  useListContactMessages,
  useSetContactMessageHandled,
  useListAccounts,
  useSetAccountBanned,
  useSetFirmStatus,
  useDeleteAccount,
  useListReferrals,
  getListReferralsQueryKey,
  getListAccountsQueryKey,
  getListContactMessagesQueryKey,
  getGetAdminSessionQueryKey,
  getListAttorneyApplicationsQueryKey,
  getListArchivedAttorneysQueryKey,
  getGetAdminAnalyticsQueryKey,
  getListAnalyticsEventsQueryKey,
  getListAttorneysQueryKey,
  getGetDirectoryStatsQueryKey,
  getGetAttorneyQueryKey,
  type Attorney,
  type AnalyticsEvent,
  type Account,
} from "@workspace/api-client-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Logo } from "@/components/logo";
import {
  ShieldCheck,
  LogOut,
  Search,
  Eye,
  CalendarCheck,
  Activity,
  Users,
  Clock,
  Check,
  X,
  Play,
  Loader2,
  MapPin,
  Trash2,
  Pencil,
  ArrowLeft,
  RotateCcw,
  Archive,
  Navigation,
  AlertTriangle,
  Flag,
  BadgeCheck,
  Star,
  Mail,
  Inbox,
  Ban,
  ExternalLink,
  Building2,
  Globe,
  Phone,
} from "lucide-react";
import {
  geocodeAddress,
  isGeocodingAvailable,
  loadPlacesLibrary,
} from "@/lib/geocode";
import { assessPinHealth } from "@/lib/pin-health";
import {
  AttorneyListingForm,
  attorneyFormToApiBody,
  attorneyToFormValues,
  type AttorneyFormValues,
} from "@/components/attorney-form";
import { SignupHeatmap, buildStateCounts } from "@/components/signup-heatmap";

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
        Approved
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge
        variant="outline"
        className="text-destructive border-destructive/30"
      >
        Rejected
      </Badge>
    );
  }
  if (status === "paused") {
    return (
      <Badge
        variant="secondary"
        className="bg-muted text-muted-foreground border"
      >
        Paused
      </Badge>
    );
  }
  return (
    <Badge className="bg-gold/15 text-gold-foreground border-gold/30 hover:bg-gold/15">
      Pending
    </Badge>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Search;
  label: string;
  value: number;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <div className="text-2xl font-semibold text-foreground tabular-nums">
            {value.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoginScreen() {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { mutate: login, isPending } = useAdminLogin({
    mutation: {
      onSuccess: () => {
        setError(null);
        queryClient.invalidateQueries({
          queryKey: getGetAdminSessionQueryKey(),
        });
      },
      onError: () => setError("Invalid PIN."),
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ data: { pin } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md rounded-3xl shadow-xl">
        <CardHeader className="text-center pt-10">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif font-medium">
            Admin Portal
          </CardTitle>
          <CardDescription>
            Enter your PIN to manage Caseway listings
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-10">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pin">Access PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full h-12 rounded-xl"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "paused", label: "Paused" },
  { value: "rejected", label: "Rejected" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

function ApplicationsTab({
  onDirtyChange,
  focusListingId,
  onFocusConsumed,
}: {
  onDirtyChange?: (dirty: boolean) => void;
  focusListingId?: number | null;
  onFocusConsumed?: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [confirmTarget, setConfirmTarget] = useState<Attorney | null>(null);
  const [editTarget, setEditTarget] = useState<Attorney | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      setEditDirty(dirty);
      onDirtyChange?.(dirty);
    },
    [onDirtyChange],
  );

  const closeEdit = useCallback(() => {
    setEditTarget(null);
    setLeaveConfirmOpen(false);
    setEditDirty(false);
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  const requestCloseEdit = useCallback(() => {
    if (editDirty) {
      setLeaveConfirmOpen(true);
    } else {
      closeEdit();
    }
  }, [editDirty, closeEdit]);

  useEffect(() => {
    if (!editDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editDirty]);
  const { data: applications, isLoading } = useListAttorneyApplications(
    undefined,
    { query: { queryKey: getListAttorneyApplicationsQueryKey(undefined) } },
  );

  // When the admin jumps here from the Accounts tab, switch to the "all" filter,
  // scroll the target listing into view, and briefly highlight it.
  useEffect(() => {
    if (focusListingId == null || !applications) return;
    const id = focusListingId;
    setFilter("all");
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-listing-id="${id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(id);
      onFocusConsumed?.();
    }, 60);
    return () => window.clearTimeout(t);
  }, [focusListingId, applications, onFocusConsumed]);

  useEffect(() => {
    if (highlightId == null) return;
    const t = window.setTimeout(() => setHighlightId(null), 2600);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListAttorneyApplicationsQueryKey(undefined),
    });
    queryClient.invalidateQueries({
      queryKey: getListArchivedAttorneysQueryKey(),
    });
    queryClient.invalidateQueries({ queryKey: getGetAdminAnalyticsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAttorneysQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDirectoryStatsQueryKey() });
  };

  const { mutate: approve, isPending: approving } = useApproveAttorney({
    mutation: { onSuccess: invalidate },
  });
  const { mutate: reject, isPending: rejecting } = useRejectAttorney({
    mutation: { onSuccess: invalidate },
  });
  const { mutate: verify, isPending: verifying } = useVerifyAttorney({
    mutation: { onSuccess: invalidate },
  });
  const { mutate: setPro, isPending: settingPro } = useSetAttorneyPro({
    mutation: { onSuccess: invalidate },
  });
  const { mutateAsync: deleteAttorney, isPending: deleting } =
    useAdminDeleteAttorney();
  const { mutateAsync: updateAttorney, isPending: saving } =
    useAdminUpdateAttorney();
  const busy = approving || rejecting || deleting || verifying || settingPro;

  async function handleSaveEdit(values: AttorneyFormValues) {
    if (!editTarget) return;
    try {
      await updateAttorney({
        id: editTarget.id,
        data: attorneyFormToApiBody(values),
      });
      invalidate();
      queryClient.invalidateQueries({
        queryKey: getGetAttorneyQueryKey(editTarget.id),
      });
      toast({
        title: "Listing updated",
        description: `${values.fullName}'s details were saved.`,
      });
      closeEdit();
    } catch (error) {
      const message =
        (error as { data?: { error?: string } })?.data?.error ||
        "Please check the inputs and try again.";
      toast({
        title: "Could not save changes",
        description: message,
        variant: "destructive",
      });
    }
  }

  if (editTarget) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg -ml-2"
          onClick={requestCloseEdit}
          disabled={saving}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to listings
        </Button>
        <AttorneyListingForm
          heading="Edit listing"
          subheading="Update this attorney's details. Changes go live immediately without affecting the listing's review status."
          submitLabel="Save Changes"
          pendingLabel="Saving..."
          isSubmitting={saving}
          onSubmit={handleSaveEdit}
          initialValues={attorneyToFormValues(editTarget)}
          onDirtyChange={handleDirtyChange}
        />

        <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved edits to {editTarget.fullName}'s listing. If
                you leave now, those changes will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">
                Keep editing
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  closeEdit();
                }}
              >
                Discard changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  async function handleDelete() {
    if (!confirmTarget) return;
    try {
      await deleteAttorney({ id: confirmTarget.id });
      invalidate();
      toast({
        title: "Listing archived",
        description: `${confirmTarget.fullName} was moved to Archived. You can restore it anytime.`,
      });
      setConfirmTarget(null);
    } catch (error) {
      const message =
        (error as { data?: { error?: string } })?.data?.error ||
        "Please try again in a moment.";
      toast({
        title: "Could not delete listing",
        description: message,
        variant: "destructive",
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rows = applications ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const pendingFirst = [...rows].sort((a, b) => {
    const rank = (s: string) =>
      s === "pending" ? 0 : s === "approved" ? 1 : s === "paused" ? 2 : 3;
    return rank(a.status) - rank(b.status);
  });
  const visible =
    filter === "all"
      ? pendingFirst
      : pendingFirst.filter((a) => a.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count =
            f.value === "all" ? rows.length : (counts[f.value] ?? 0);
          return (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              className="rounded-lg"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
            </Button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          {rows.length === 0
            ? "No listings yet."
            : `No ${filter === "all" ? "" : filter + " "}listings.`}
        </p>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attorney</TableHead>
                <TableHead>Firm</TableHead>
                <TableHead>Practice areas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((a: Attorney) => (
                <TableRow
                  key={a.id}
                  data-listing-id={a.id}
                  className={
                    highlightId === a.id
                      ? "bg-primary/10 transition-colors duration-500"
                      : "transition-colors duration-500"
                  }
                >
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {a.fullName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {a.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.firmName}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[220px]">
                    <span className="line-clamp-2">
                      {a.practiceAreas.join(", ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      {a.isVerified ? (
                        <Badge className="w-fit bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                          <BadgeCheck className="w-3.5 h-3.5 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="w-fit text-muted-foreground"
                        >
                          Unverified
                        </Badge>
                      )}
                      {a.barNumber ? (
                        <span className="text-xs text-muted-foreground">
                          Bar #{a.barNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">
                          No bar number
                        </span>
                      )}
                      {a.termsAcceptedAt && (
                        <span className="text-xs text-muted-foreground/60">
                          Terms:{" "}
                          {new Date(a.termsAcceptedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || saving}
                        onClick={() => setEditTarget(a)}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          verify({
                            id: a.id,
                            data: { verified: !a.isVerified },
                          })
                        }
                      >
                        <BadgeCheck className="w-4 h-4 mr-1" />
                        {a.isVerified ? "Unverify" : "Verify"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          setPro({ id: a.id, data: { pro: !a.isPro } })
                        }
                      >
                        <Star className="w-4 h-4 mr-1" />
                        {a.isPro ? "Remove Pro" : "Make Pro"}
                      </Button>
                      {a.status === "paused" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => approve({ id: a.id })}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Resume
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || a.status === "approved"}
                          onClick={() => approve({ id: a.id })}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={busy || a.status === "rejected"}
                        onClick={() => reject({ id: a.id })}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={busy}
                        onClick={() => setConfirmTarget(a)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.fullName} will be moved to Archived and will no
              longer appear in the directory. You can restore it from the
              Archived tab at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                "Delete listing"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ListCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; count: number }[];
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((it, i) => (
              <li
                key={`${it.label}-${i}`}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-sm text-foreground truncate">
                  {it.label}
                </span>
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  {it.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function HeatmapTab() {
  const { data: applications, isLoading } = useListAttorneyApplications(
    undefined,
    { query: { queryKey: getListAttorneyApplicationsQueryKey(undefined) } },
  );

  const rows = applications ?? [];
  const { counts, max, ranked, placed, unknown } = useMemo(
    () => buildStateCounts(rows),
    [rows],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total listings" value={rows.length} />
        <StatCard icon={MapPin} label="States covered" value={ranked.length} />
        <StatCard
          icon={Activity}
          label={ranked.length ? `Top state — ${ranked[0].name}` : "Top state"}
          value={ranked.length ? ranked[0].count : 0}
        />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Where attorneys are signing up
          </CardTitle>
          <CardDescription>
            Listings by state — darker green means more sign-ups. Hover a state
            for its count.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {placed === 0 ? (
            <div className="flex h-[480px] items-center justify-center rounded-2xl border border-dashed bg-muted/40 text-sm text-muted-foreground">
              No listings with a known location yet.
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <SignupHeatmap counts={counts} max={max} />
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Top states
                </h3>
                <div className="space-y-2.5">
                  {ranked.slice(0, 10).map((entry) => (
                    <div key={entry.name} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-sm text-foreground">
                        {entry.name}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${max ? (entry.count / max) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
                        {entry.count}
                      </span>
                    </div>
                  ))}
                </div>
                {unknown > 0 && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    {unknown} {unknown === 1 ? "listing" : "listings"} without a
                    resolved location are not shown on the map.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsTab() {
  const { data, isLoading } = useGetAdminAnalytics({
    query: { queryKey: getGetAdminAnalyticsQueryKey() },
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Activity}
          label="Total events"
          value={data.totalEvents}
        />
        <StatCard icon={Search} label="Searches" value={data.totalSearches} />
        <StatCard
          icon={Eye}
          label="Profile views"
          value={data.totalProfileViews}
        />
        <StatCard
          icon={CalendarCheck}
          label="Consultation clicks"
          value={data.totalConsultationClicks}
        />
        <StatCard
          icon={Users}
          label="Approved attorneys"
          value={data.approvedAttorneys}
        />
        <StatCard
          icon={Clock}
          label="Pending applications"
          value={data.pendingApplications}
        />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Activity over time
          </CardTitle>
          <CardDescription>Events per day</CardDescription>
        </CardHeader>
        <CardContent>
          {data.eventsByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.eventsByDay}>
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
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ListCard title="Top searches" items={data.topSearches} />
        <ListCard title="Top categories" items={data.topCategories} />
        <ListCard
          title="Most viewed attorneys"
          items={data.topViewedAttorneys.map((a) => ({
            label: a.attorneyName,
            count: a.count,
          }))}
        />
      </div>
    </div>
  );
}

function formatEventType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function eventDetail(e: AnalyticsEvent): string {
  if (e.attorneyName) return e.attorneyName;
  if (e.category) return e.category;
  if (e.query) return e.query;
  return "—";
}

function ActivityTab() {
  const { data, isLoading } = useListAnalyticsEvents(
    { limit: 100 },
    { query: { queryKey: getListAnalyticsEventsQueryKey({ limit: 100 }) } },
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const events = data ?? [];
  if (events.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-16">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <Card className="rounded-2xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead>Path</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {new Date(e.createdAt).toLocaleString()}
              </TableCell>
              <TableCell className="font-medium text-foreground">
                {formatEventType(e.type)}
              </TableCell>
              <TableCell className="text-muted-foreground max-w-[260px] truncate">
                {eventDetail(e)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {e.path ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function ContactMessagesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListContactMessages({
    query: { queryKey: getListContactMessagesQueryKey() },
  });

  const { mutate: setHandled, isPending } = useSetContactMessageHandled({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListContactMessagesQueryKey(),
        });
      },
      onError: () => {
        toast({
          title: "Could not update message",
          description: "Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const messages = data ?? [];
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Inbox className="w-8 h-8" />
        <p>No contact messages yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((m) => (
        <Card
          key={m.id}
          className={`rounded-2xl ${m.handled ? "opacity-60" : ""}`}
        >
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {m.subject}
                </CardTitle>
                <CardDescription className="mt-1">
                  {m.name} ·{" "}
                  <a
                    href={`mailto:${m.email}`}
                    className="text-primary hover:underline"
                  >
                    {m.email}
                  </a>{" "}
                  · {new Date(m.createdAt).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {m.handled && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Handled
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    setHandled({ id: m.id, data: { handled: !m.handled } })
                  }
                >
                  {m.handled ? "Mark unhandled" : "Mark handled"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
              {m.message}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Top referrers leaderboard. The server returns attorneys ranked by how many
// approved, live listings they've referred (highest first), each with the list
// of referees. This is the admin's view of "who refers the most" — the same
// referral count also boosts a referrer's ranking in client search results.
function ReferralsTab() {
  const { data, isLoading } = useListReferrals({
    query: { queryKey: getListReferralsQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const referrers = data ?? [];
  if (referrers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <Users className="w-8 h-8" />
        <p>No referrals yet.</p>
        <p className="max-w-md text-sm">
          When an attorney signs up after being referred by another attorney,
          the referrer appears here, ranked by how many live listings they've
          brought in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {referrers.map((r, i) => (
        <Card key={r.id} className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </div>
                <div>
                  <CardTitle className="text-lg">{r.fullName}</CardTitle>
                  <CardDescription className="mt-0.5">
                    {r.firmName}
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                {r.referralCount}{" "}
                {r.referralCount === 1 ? "referral" : "referrals"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referred attorney</TableHead>
                  <TableHead>Firm</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.referees.map((ref) => (
                  <TableRow key={ref.id}>
                    <TableCell className="font-medium">
                      {ref.fullName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ref.firmName}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(ref.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type PinResult =
  | { kind: "resolved"; lat: number; lng: number; distanceMeters: number }
  | { kind: "failed" };

// Great-circle distance in meters between two coordinates (Haversine).
function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

function MapPinsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const geocodingAvailable = isGeocodingAvailable();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Per-listing geocode results, keyed by attorney id. Present only after a run.
  const [results, setResults] = useState<Map<number, PinResult>>(new Map());
  // Which resolved rows the admin has confirmed to save (defaults to all resolved).
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // When on, only listings with a suspicious pin are shown.
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const { data: applications, isLoading } = useListAttorneyApplications(
    undefined,
    { query: { queryKey: getListAttorneyApplicationsQueryKey(undefined) } },
  );

  const { mutateAsync: bulkGeocode, isPending: saving } =
    useBulkGeocodeAttorneys();

  const allRows = applications ?? [];
  // Pre-compute pin health once per render, keyed by id, and surface flagged
  // listings first so admins can target the ones most likely to be wrong.
  const health = new Map(allRows.map((r) => [r.id, assessPinHealth(r)]));
  const flaggedCount = allRows.filter((r) => health.get(r.id)?.flagged).length;
  const rows = [
    ...(onlyFlagged
      ? allRows.filter((r) => health.get(r.id)?.flagged)
      : allRows),
  ].sort((a, b) => {
    const af = health.get(a.id)?.flagged ? 1 : 0;
    const bf = health.get(b.id)?.flagged ? 1 : 0;
    return bf - af;
  });

  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
    );
  };

  async function handleGeocode() {
    if (selected.size === 0) return;
    setGeocoding(true);
    setResults(new Map());
    setConfirmed(new Set());
    const targets = rows.filter((r) => selected.has(r.id));
    setProgress({ done: 0, total: targets.length });

    // Warm the Places library once so per-row calls reuse it.
    await loadPlacesLibrary();

    const nextResults = new Map<number, PinResult>();
    const nextConfirmed = new Set<number>();
    let done = 0;
    for (const a of targets) {
      const coords = await geocodeAddress(a.officeAddress);
      if (coords) {
        const [lat, lng] = coords;
        nextResults.set(a.id, {
          kind: "resolved",
          lat,
          lng,
          distanceMeters: distanceMeters(a.latitude, a.longitude, lat, lng),
        });
        nextConfirmed.add(a.id);
      } else {
        nextResults.set(a.id, { kind: "failed" });
      }
      done += 1;
      setProgress({ done, total: targets.length });
    }
    setResults(nextResults);
    setConfirmed(nextConfirmed);
    setGeocoding(false);

    const resolved = nextConfirmed.size;
    const failed = targets.length - resolved;
    toast({
      title: "Geocoding complete",
      description: `${resolved} address${resolved === 1 ? "" : "es"} resolved${
        failed > 0 ? `, ${failed} could not be matched` : ""
      }. Review the results below before saving.`,
    });
  }

  const toggleConfirm = (id: number) => {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function handleSave() {
    const updates: { id: number; latitude: number; longitude: number }[] = [];
    for (const id of confirmed) {
      const r = results.get(id);
      if (r && r.kind === "resolved") {
        updates.push({ id, latitude: r.lat, longitude: r.lng });
      }
    }
    if (updates.length === 0) return;
    try {
      const result = await bulkGeocode({ data: { updates } });
      queryClient.invalidateQueries({
        queryKey: getListAttorneyApplicationsQueryKey(undefined),
      });
      queryClient.invalidateQueries({ queryKey: getListAttorneysQueryKey() });
      queryClient.invalidateQueries({
        queryKey: getGetDirectoryStatsQueryKey(),
      });
      for (const u of updates) {
        queryClient.invalidateQueries({
          queryKey: getGetAttorneyQueryKey(u.id),
        });
      }
      toast({
        title: "Map pins updated",
        description: `${result.updated} listing${
          result.updated === 1 ? "" : "s"
        } now point to the corrected location.`,
      });
      setResults(new Map());
      setConfirmed(new Set());
      setSelected(new Set());
    } catch (error) {
      const message =
        (error as { data?: { error?: string } })?.data?.error ||
        "Please try again in a moment.";
      toast({
        title: "Could not save pins",
        description: message,
        variant: "destructive",
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasResults = results.size > 0;
  const confirmedCount = [...confirmed].filter(
    (id) => results.get(id)?.kind === "resolved",
  ).length;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Navigation className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">
                Bulk-correct map pins
              </CardTitle>
              <CardDescription>
                Select listings and re-geocode their office addresses to fix
                placeholder or jittered map pins. Listings whose stored pin
                looks wrong are flagged below. Review every result before
                saving.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!geocodingAvailable && (
            <div className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-gold-foreground" />
              <p className="text-muted-foreground">
                Address geocoding needs a Google Maps API key
                (VITE_GOOGLE_MAPS_API_KEY). Without it, pins can only be set
                manually from each listing's edit form.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              className="rounded-lg"
              disabled={
                !geocodingAvailable ||
                geocoding ||
                saving ||
                selected.size === 0
              }
              onClick={handleGeocode}
            >
              {geocoding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Geocoding {progress.done}/{progress.total}
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 mr-1.5" />
                  Re-geocode selected ({selected.size})
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant={onlyFlagged ? "default" : "outline"}
              className="rounded-lg"
              disabled={geocoding || saving || flaggedCount === 0}
              onClick={() => setOnlyFlagged((v) => !v)}
            >
              <Flag className="w-4 h-4 mr-1.5" />
              {onlyFlagged ? "Showing flagged" : "Show only flagged"} (
              {flaggedCount})
            </Button>
            {hasResults && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={saving || geocoding || confirmedCount === 0}
                onClick={handleSave}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Save confirmed pins ({confirmedCount})
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          {onlyFlagged
            ? "No listings are flagged. Every pin looks fine."
            : "No listings to correct."}
        </p>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary align-middle"
                    aria-label="Select all listings"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={toggleAll}
                    disabled={geocoding || saving}
                  />
                </TableHead>
                <TableHead>Attorney</TableHead>
                <TableHead>Office address</TableHead>
                <TableHead>Current pin</TableHead>
                <TableHead>New pin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a: Attorney) => {
                const result = results.get(a.id);
                const isConfirmed = confirmed.has(a.id);
                const pin = health.get(a.id);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-primary align-middle"
                        aria-label={`Select ${a.fullName}`}
                        checked={selected.has(a.id)}
                        onChange={() => toggleRow(a.id)}
                        disabled={geocoding || saving}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        {pin?.flagged && (
                          <Flag
                            className="w-3.5 h-3.5 shrink-0 text-destructive"
                            aria-label="Pin needs review"
                          />
                        )}
                        {a.fullName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {a.firmName}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[260px]">
                      <span className="line-clamp-2">{a.officeAddress}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-xs">
                      <span className="text-muted-foreground">
                        {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
                      </span>
                      {pin?.flagged && (
                        <div className="mt-1 flex items-start gap-1 text-destructive">
                          <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
                          <span className="max-w-[180px] whitespace-normal leading-tight">
                            {pin.reasons.join("; ")}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {!result ? (
                        <span className="text-muted-foreground">—</span>
                      ) : result.kind === "failed" ? (
                        <span className="inline-flex items-center gap-1.5 text-destructive">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          No match
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input accent-primary align-middle"
                            aria-label={`Confirm new pin for ${a.fullName}`}
                            checked={isConfirmed}
                            onChange={() => toggleConfirm(a.id)}
                            disabled={saving}
                          />
                          <span className="tabular-nums text-foreground">
                            {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                          </span>
                          <Badge
                            variant="outline"
                            className="font-normal text-muted-foreground"
                          >
                            {formatDistance(result.distanceMeters)} moved
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function ArchivedTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [purgeTarget, setPurgeTarget] = useState<Attorney | null>(null);
  const { data: archived, isLoading } = useListArchivedAttorneys({
    query: { queryKey: getListArchivedAttorneysQueryKey() },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListArchivedAttorneysQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getListAttorneyApplicationsQueryKey(undefined),
    });
    queryClient.invalidateQueries({ queryKey: getGetAdminAnalyticsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAttorneysQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDirectoryStatsQueryKey() });
  };

  const { mutate: restore, isPending: restoring } = useRestoreAttorney({
    mutation: {
      onSuccess: (attorney) => {
        invalidate();
        toast({
          title: "Listing restored",
          description: `${attorney.fullName} is back in the listings.`,
        });
      },
      onError: () => {
        toast({
          title: "Could not restore listing",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      },
    },
  });

  const { mutateAsync: purge, isPending: purging } =
    usePermanentlyDeleteAttorney();
  const busy = restoring || purging;

  async function handlePurge() {
    if (!purgeTarget) return;
    try {
      await purge({ id: purgeTarget.id });
      invalidate();
      toast({
        title: "Listing permanently deleted",
        description: `${purgeTarget.fullName} has been removed for good.`,
      });
      setPurgeTarget(null);
    } catch (error) {
      const message =
        (error as { data?: { error?: string } })?.data?.error ||
        "Please try again in a moment.";
      toast({
        title: "Could not delete listing",
        description: message,
        variant: "destructive",
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rows = archived ?? [];

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Archive className="w-8 h-8 text-muted-foreground" />
        <p className="text-muted-foreground">
          No archived listings. Deleted listings will appear here so you can
          restore them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        These listings were deleted and are hidden from the directory. Restore a
        listing to bring it back, or permanently delete it to remove it for
        good.
      </p>
      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Attorney</TableHead>
              <TableHead>Firm</TableHead>
              <TableHead>Archived</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a: Attorney) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {a.fullName}
                  </div>
                  <div className="text-sm text-muted-foreground">{a.email}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {a.firmName}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {a.archivedAt
                    ? new Date(a.archivedAt).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => restore({ id: a.id })}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => setPurgeTarget(a)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete forever
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !purging) setPurgeTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently delete this listing?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {purgeTarget?.fullName} will be permanently removed from Caseway.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={purging}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={purging}
              onClick={(e) => {
                e.preventDefault();
                handlePurge();
              }}
            >
              {purging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                "Delete forever"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const ACCOUNTS_PAGE_SIZE = 50;

function accountName(a: Account): string {
  const name = [a.firstName, a.lastName].filter(Boolean).join(" ").trim();
  return name || a.email || "Unnamed account";
}

function AccountsTab({
  onJumpToListing,
}: {
  onJumpToListing: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [offset, setOffset] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const params = { limit: ACCOUNTS_PAGE_SIZE, offset };
  const { data, isLoading, isFetching } = useListAccounts(params, {
    query: { queryKey: getListAccountsQueryKey(params) },
  });

  const invalidateAccounts = () =>
    queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });

  const { mutate: setBanned, isPending: banning } = useSetAccountBanned({
    mutation: {
      onSuccess: (_res, vars) => {
        invalidateAccounts();
        toast({
          title: vars.data.banned ? "Account suspended" : "Account reinstated",
          description: vars.data.banned
            ? "This person can no longer sign in. Their listings stay live until archived."
            : "This person can sign in again.",
        });
      },
      onError: () =>
        toast({
          title: "Could not update account",
          description: "Please try again.",
          variant: "destructive",
        }),
    },
  });

  const { mutate: deleteAccount, isPending: deleting } = useDeleteAccount({
    mutation: {
      onSuccess: (res) => {
        invalidateAccounts();
        queryClient.invalidateQueries({
          queryKey: getListAttorneyApplicationsQueryKey(undefined),
        });
        queryClient.invalidateQueries({ queryKey: getListAttorneysQueryKey() });
        setDeleteTarget(null);
        toast({
          title: "Account deleted",
          description:
            res.unlinkedListings > 0
              ? `Account removed. ${res.unlinkedListings} listing(s) were kept and unlinked from the owner.`
              : "Account removed. It had no linked listings.",
        });
      },
      onError: () =>
        toast({
          title: "Could not delete account",
          description: "Please try again.",
          variant: "destructive",
        }),
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const accounts = data?.accounts ?? [];
  const totalCount = data?.totalCount ?? 0;
  const busy = banning || deleting;

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Users className="w-8 h-8" />
        <p>No attorney accounts yet.</p>
      </div>
    );
  }

  const rangeStart = offset + 1;
  const rangeEnd = offset + accounts.length;
  const canPrev = offset > 0;
  const canNext = offset + ACCOUNTS_PAGE_SIZE < totalCount;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Signed up</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead>Listings</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {accountName(a)}
                  </div>
                  {a.email && (
                    <div className="text-sm text-muted-foreground">
                      <a href={`mailto:${a.email}`} className="hover:underline">
                        {a.email}
                      </a>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {new Date(a.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {a.lastSignInAt
                    ? new Date(a.lastSignInAt).toLocaleDateString()
                    : "Never"}
                </TableCell>
                <TableCell className="max-w-[260px]">
                  {a.listings.length === 0 ? (
                    <span className="text-sm text-muted-foreground/60">
                      None
                    </span>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {a.listings.map((l) =>
                        l.archived ? (
                          // Archived listings live in the Archived tab, not
                          // Applications, so don't offer a jump that would fail.
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/70"
                          >
                            <span className="truncate">{l.fullName}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] text-muted-foreground"
                            >
                              Archived
                            </Badge>
                          </span>
                        ) : (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => onJumpToListing(l.id)}
                            className="group inline-flex items-center gap-1.5 text-left text-sm text-primary hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                            <span className="truncate">{l.fullName}</span>
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {a.banned ? (
                    <Badge
                      variant="outline"
                      className="w-fit border-destructive/30 text-destructive"
                    >
                      <Ban className="w-3.5 h-3.5 mr-1" />
                      Suspended
                    </Badge>
                  ) : (
                    <Badge className="w-fit bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                      Active
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        setBanned({ id: a.id, data: { banned: !a.banned } })
                      }
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      {a.banned ? "Reinstate" : "Suspend"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => setDeleteTarget(a)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {rangeStart}&ndash;{rangeEnd} of {totalCount}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!canPrev || isFetching}
            onClick={() =>
              setOffset((o) => Math.max(0, o - ACCOUNTS_PAGE_SIZE))
            }
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canNext || isFetching}
            onClick={() => setOffset((o) => o + ACCOUNTS_PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently delete this account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  This permanently deletes the account for{" "}
                  <span className="font-medium text-foreground">
                    {accountName(deleteTarget)}
                  </span>
                  . This cannot be undone.
                  {deleteTarget.listings.length > 0
                    ? ` Their ${deleteTarget.listings.length} listing(s) will be kept but unlinked from any owner.`
                    : ""}{" "}
                  To only block sign-in, use Suspend instead.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteAccount({ id: deleteTarget.id });
              }}
            >
              {deleting ? "Deleting..." : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Firm accounts must be approved before they can post any listings. This queue
// surfaces firm accounts awaiting review (app_metadata.firmStatus === "pending")
// and lets an admin approve or reject them. Approving unlocks unlimited listings
// that go live after payment with no per-listing review.
const FIRM_QUEUE_PARAMS = { limit: 200, offset: 0 } as const;

function FirmApplicationsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading } = useListAccounts(FIRM_QUEUE_PARAMS, {
    query: { queryKey: getListAccountsQueryKey(FIRM_QUEUE_PARAMS) },
  });

  const { mutate: setFirmStatus, isPending } = useSetFirmStatus({
    mutation: {
      onSuccess: (_res, vars) => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        toast({
          title:
            vars.data.status === "approved"
              ? "Firm approved"
              : "Firm rejected",
          description:
            vars.data.status === "approved"
              ? "This firm can now post unlimited attorney listings."
              : "This firm cannot post listings.",
        });
        setPendingId(null);
      },
      onError: () => {
        toast({
          title: "Could not update firm",
          description: "Please try again.",
          variant: "destructive",
        });
        setPendingId(null);
      },
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingFirms = (data?.accounts ?? []).filter(
    (a) => a.accountType === "firm" && a.firmStatus === "pending",
  );

  if (pendingFirms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Building2 className="w-8 h-8" />
        <p>No law firm applications awaiting review.</p>
      </div>
    );
  }

  const act = (id: string, status: "approved" | "rejected") => {
    setPendingId(id);
    setFirmStatus({ id, data: { status } });
  };

  return (
    <div className="space-y-4">
      {pendingFirms.map((a) => {
        const busy = isPending && pendingId === a.id;
        return (
          <Card key={a.id} className="rounded-2xl">
            <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-lg font-medium text-foreground">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    {a.firmName || "Unnamed firm"}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Applied {new Date(a.createdAt).toLocaleDateString()} by{" "}
                    {accountName(a)}
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  {a.email && (
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0 opacity-70" />
                      <a
                        href={`mailto:${a.email}`}
                        className="hover:underline"
                      >
                        {a.email}
                      </a>
                    </span>
                  )}
                  {a.firmPhone && (
                    <span className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 opacity-70" />
                      <a href={`tel:${a.firmPhone}`} className="hover:underline">
                        {a.firmPhone}
                      </a>
                    </span>
                  )}
                  {a.firmWebsite && (
                    <span className="inline-flex items-center gap-2">
                      <Globe className="h-4 w-4 shrink-0 opacity-70" />
                      <a
                        href={a.firmWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <span className="truncate">{a.firmWebsite}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      </a>
                    </span>
                  )}
                  {a.firmAddress && (
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 opacity-70" />
                      <span>{a.firmAddress}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => act(a.id, "approved")}
                >
                  {busy ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-4 w-4" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => act(a.id, "rejected")}
                >
                  <X className="mr-1 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Dashboard({ username }: { username: string | null | undefined }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("applications");
  const [editDirty, setEditDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [focusListingId, setFocusListingId] = useState<number | null>(null);
  const { mutate: logout } = useAdminLogout({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getGetAdminSessionQueryKey(),
        }),
    },
  });

  const handleTabChange = (value: string) => {
    if (value === tab) return;
    if (editDirty) {
      setPendingTab(value);
    } else {
      setTab(value);
    }
  };

  // Jump from an account's listing chip straight to that row in Applications.
  const jumpToListing = useCallback((id: number) => {
    setFocusListingId(id);
    setTab("applications");
  }, []);

  const handleFocusConsumed = useCallback(() => setFocusListingId(null), []);

  const confirmTabChange = () => {
    if (pendingTab) {
      setEditDirty(false);
      setTab(pendingTab);
    }
    setPendingTab(null);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-auto object-contain" />
            <span className="text-sm font-medium text-muted-foreground border-l pl-3">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            {username && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {username}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="rounded-lg"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="firms">Firm Applications</TabsTrigger>
            <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
            <TabsTrigger value="pins">Map Pins</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
          </TabsList>
          <TabsContent value="applications">
            <ApplicationsTab
              onDirtyChange={setEditDirty}
              focusListingId={focusListingId}
              onFocusConsumed={handleFocusConsumed}
            />
          </TabsContent>
          <TabsContent value="firms">
            <FirmApplicationsTab />
          </TabsContent>
          <TabsContent value="heatmap">
            <HeatmapTab />
          </TabsContent>
          <TabsContent value="pins">
            <MapPinsTab />
          </TabsContent>
          <TabsContent value="archived">
            <ArchivedTab />
          </TabsContent>
          <TabsContent value="analytics">
            <AnalyticsTab />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab />
          </TabsContent>
          <TabsContent value="messages">
            <ContactMessagesTab />
          </TabsContent>
          <TabsContent value="accounts">
            <AccountsTab onJumpToListing={jumpToListing} />
          </TabsContent>
          <TabsContent value="referrals">
            <ReferralsTab />
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog
        open={pendingTab !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTab(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits to this listing. If you switch tabs now,
              those changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmTabChange();
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Admin() {
  const { data: session, isLoading } = useGetAdminSession({
    query: { queryKey: getGetAdminSessionQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.authenticated) {
    return <LoginScreen />;
  }

  return <Dashboard username={session.username} />;
}
