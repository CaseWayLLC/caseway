import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { SavedAttorneysProvider } from "@/lib/saved-attorneys";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";

// Code-split every non-landing route so the initial download ships only the
// home page plus shared chunks. Rarely visited routes (admin, dashboard,
// edit-listing) and the legal pages load on demand instead of up front.
const AttorneyPage = lazy(() => import("@/pages/attorney"));
const CountyPage = lazy(() => import("@/pages/county"));
const CityPage = lazy(() => import("@/pages/city"));
const PracticeAreaCountyPage = lazy(
  () => import("@/pages/practice-area-county"),
);
const StatePage = lazy(() => import("@/pages/state"));
const DirectoryPage = lazy(() => import("@/pages/directory"));
const PracticeAreaPage = lazy(() => import("@/pages/practice-area"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const SignUpPage = lazy(() => import("@/pages/sign-up"));
const Signup = lazy(() => import("@/pages/signup"));
const UpgradeFirm = lazy(() => import("@/pages/upgrade-firm"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Account = lazy(() => import("@/pages/account"));
const Network = lazy(() => import("@/pages/network"));
const EditListing = lazy(() => import("@/pages/edit-listing"));
const ListingSuccess = lazy(() => import("@/pages/listing-success"));
const Terms = lazy(() => import("@/pages/terms"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Disclaimer = lazy(() => import("@/pages/disclaimer"));
const RefundPolicy = lazy(() => import("@/pages/refund-policy"));
const Contact = lazy(() => import("@/pages/contact"));
const Admin = lazy(() => import("@/pages/admin"));
const Saved = lazy(() => import("@/pages/saved"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// A protected API call returns 401 once the session is no longer valid —
// the access token expired, was revoked, or (the case we care about here) an
// admin deleted or banned the account, which kills the server-side session.
// supabase-js wouldn't notice until it next tried to refresh the token (up to
// ~1 hour later), leaving the user stranded in a broken signed-in state.
function isUnauthorizedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: unknown }).status === 401
  );
}

// The admin portal authenticates with a separate server-verified PIN cookie,
// NOT the attorney's Supabase bearer token, so a 401 from an admin endpoint
// (e.g. an expired PIN) says nothing about the attorney session. Excluding it
// keeps an admin who is also signed in as an attorney from being bounced.
function isAdminApiError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "url" in error &&
    typeof (error as { url: unknown }).url === "string" &&
    (error as { url: string }).url.includes("/api/admin")
  );
}

// Force-clear the local session on a 401 so a deleted/banned user is logged out
// on their very next interaction. Guarded so simultaneous failing requests only
// sign out once, and skipped when no local session exists (public 401s, if any,
// must not bounce a signed-out visitor). Local scope only: the server session
// may already be gone, so a global sign-out would just error — clearing local
// state fires SIGNED_OUT and lets the route guards redirect to /sign-in.
let handlingUnauthorized = false;
async function handleApiError(error: unknown): Promise<void> {
  if (
    handlingUnauthorized ||
    !isUnauthorizedError(error) ||
    isAdminApiError(error)
  ) {
    return;
  }
  handlingUnauthorized = true;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch {
    // getSession/signOut are best-effort here; this runs from a React Query
    // error callback, so swallow failures rather than leave a rejected promise.
  } finally {
    handlingUnauthorized = false;
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleApiError }),
  mutationCache: new MutationCache({ onError: handleApiError }),
  defaultOptions: {
    queries: {
      // Directory data changes infrequently within a session; a short stale
      // window plus no refetch-on-focus cuts redundant background refetches.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retrying a 401 is pointless (the session is invalid, not flaky) and
      // only delays the forced sign-out, so fail fast on auth errors.
      retry: (count, error) => !isUnauthorizedError(error) && count < 3,
    },
  },
});

// SPA navigations don't reset scroll position — force every new route to start
// at the top of the page.
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

// Fallback shown while a lazily-loaded route chunk is being fetched.
function PageLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-28">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/saved" component={Saved} />
        <Route path="/attorney/:slug" component={AttorneyPage} />
        <Route path="/directory" component={DirectoryPage} />
        <Route path="/practice-areas/:area" component={PracticeAreaPage} />
        <Route path="/attorneys/:state/:county" component={CountyPage} />
        <Route path="/attorneys/:state/:county/city/:city" component={CityPage} />
        <Route
          path="/attorneys/:state/:county/:area"
          component={PracticeAreaCountyPage}
        />
        <Route path="/attorneys/:state" component={StatePage} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
        <Route path="/signup" component={Signup} />
        <Route path="/upgrade-firm" component={UpgradeFirm} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/account" component={Account} />
        <Route path="/network" component={Network} />
        <Route path="/listing/edit/:id" component={EditListing} />
        <Route path="/listing/success" component={ListingSuccess} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/disclaimer" component={Disclaimer} />
        <Route path="/refunds" component={RefundPolicy} />
        <Route path="/contact" component={Contact} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SavedAttorneysProvider>
            <TooltipProvider>
              <ScrollToTop />
              <Router />
              <Toaster />
            </TooltipProvider>
          </SavedAttorneysProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
