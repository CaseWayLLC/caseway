import { useMemo } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { Loader2, Users, MapPin, Plus } from "lucide-react";
import {
  useListMyAttorneys,
  useListAttorneys,
  getListMyAttorneysQueryKey,
  getListAttorneysQueryKey,
  type Attorney,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AttorneyCard } from "@/components/attorney-card";
import { useAuth } from "@/lib/auth";
import { distanceMiles } from "@/lib/geo";
import { attorneyPath } from "@/lib/seo";

function hasValidCoords(a: Attorney): boolean {
  return (
    Number.isFinite(a.latitude) &&
    Number.isFinite(a.longitude) &&
    (a.latitude !== 0 || a.longitude !== 0)
  );
}

export default function Network() {
  const { loading: authLoading, isSignedIn } = useAuth();
  const [, navigate] = useLocation();

  const { data: myData, isLoading: loadingMine } = useListMyAttorneys({
    query: {
      enabled: isSignedIn === true,
      queryKey: getListMyAttorneysQueryKey(),
    },
  });

  const { data: directory, isLoading: loadingDirectory } = useListAttorneys(
    undefined,
    {
      query: {
        enabled: isSignedIn === true,
        queryKey: getListAttorneysQueryKey(),
      },
    },
  );

  const myListings = useMemo(() => myData ?? [], [myData]);
  const myIds = useMemo(
    () => new Set(myListings.map((l) => l.id)),
    [myListings],
  );

  // Sort the directory by distance from the viewer's office. Use the first of
  // the viewer's own listings that has real coordinates as the origin.
  const origin = useMemo(
    () => myListings.find(hasValidCoords) ?? null,
    [myListings],
  );

  const peers = useMemo(() => {
    const rows = (directory ?? []).filter((a) => !myIds.has(a.id));
    return rows
      .map((a) => ({
        attorney: a,
        miles:
          origin && hasValidCoords(a)
            ? distanceMiles(
                [origin.latitude, origin.longitude],
                [a.latitude, a.longitude],
              )
            : null,
      }))
      .sort((x, y) => (x.miles ?? Infinity) - (y.miles ?? Infinity));
  }, [directory, myIds, origin]);

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

  const loading = loadingMine || loadingDirectory;
  const hasListing = myListings.length > 0;
  const originLabel = origin?.officeAddress.split(",")[0] ?? null;

  return (
    <Layout>
      <div className="flex-1 pt-28 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm font-medium text-muted-foreground mb-5">
              <Users className="h-4 w-4" />
              Attorneys only
            </div>
            <h1 className="text-4xl sm:text-5xl font-serif font-medium tracking-tight">
              Attorney Network
            </h1>
            <p className="text-muted-foreground text-lg mt-3 max-w-2xl">
              Browse other attorneys on Caseway, sorted by how close their
              office is to yours.
            </p>
            {originLabel && (
              <p className="text-sm text-muted-foreground mt-3 inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                Distances from your office in {originLabel}
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !hasListing ? (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="py-20 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted text-muted-foreground mb-6">
                  <Users className="h-8 w-8" />
                </div>
                <h2 className="font-serif text-2xl font-medium mb-3">
                  List your practice to join the network
                </h2>
                <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8">
                  Once you've listed your practice, we'll show you other
                  attorneys near your office, sorted by distance.
                </p>
                <Button asChild size="lg" className="rounded-full h-12 px-8">
                  <Link href="/signup">
                    <Plus className="mr-2 h-5 w-5" /> List Your Practice
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : !origin ? (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted text-muted-foreground mb-6">
                  <MapPin className="h-8 w-8" />
                </div>
                <h2 className="font-serif text-2xl font-medium mb-3">
                  Add your office location
                </h2>
                <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8">
                  We need a valid office address on your listing before we can
                  sort attorneys by distance from you.
                </p>
                <Button asChild size="lg" className="rounded-full h-12 px-8">
                  <Link href={`/listing/edit/${myListings[0].id}`}>
                    Update your listing
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : peers.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="py-16 text-center text-muted-foreground">
                No other attorneys are listed yet. Check back soon as the
                network grows.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {peers.map(({ attorney, miles }) => (
                <AttorneyCard
                  key={attorney.id}
                  attorney={attorney}
                  distanceMiles={miles}
                  onClick={() => navigate(attorneyPath(attorney))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function CenterLoader() {
  return (
    <div className="flex-1 flex items-center justify-center py-40">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
