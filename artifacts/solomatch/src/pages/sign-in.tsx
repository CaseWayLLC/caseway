import { Link, Redirect } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { AttorneySignInForm } from "@/components/attorney-sign-in-form";

// Single-column attorney sign-in page: just the page <h1> and the auth form,
// centered. (The marketing pitch was removed from this page.)
//
// Lazy-loaded from App.tsx so the auth form (only ever needed on this attorney
// funnel) stays out of the landing critical path.
export default function SignInPage() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return (
    <Layout>
      <div className="flex-1 w-full px-4 py-28">
        <div className="mx-auto flex w-full max-w-md flex-col items-center">
          <div className="mb-8 max-w-md text-center">
            <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground">
              Attorney Sign In
            </h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Accounts on Caseway are for attorneys only — sign in to list and
              manage your practice.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Looking for a lawyer?{" "}
              <Link href="/" className="font-medium text-primary hover:underline">
                Search the directory
              </Link>{" "}
              — no account needed.
            </p>
          </div>
          <AttorneySignInForm />
        </div>
      </div>
    </Layout>
  );
}
