import { Link, Redirect } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { ListingPitch } from "@/components/listing-pitch";
import { AttorneySignUpForm } from "@/components/attorney-sign-up-form";

// Two-column attorney funnel page: the auth column (with the page <h1>) comes
// first in the DOM so heading order stays h1 -> h2; lg:order flips the marketing
// pitch to the left only on wide screens. On mobile the form stays on top.
//
// Lazy-loaded from App.tsx so the marketing pitch + auth form (only ever needed
// on this attorney funnel) stay out of the landing critical path.
export default function SignUpPage() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <Redirect to="/signup" />;
  return (
    <Layout>
      <div className="flex-1 w-full px-4 py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-center min-w-0 w-full lg:order-2">
            <div className="mb-8 max-w-md text-center">
              <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground">
                List your practice
              </h1>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Create an attorney account to publish your listing and manage it
                anytime. Accounts on Caseway are for attorneys only.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Looking for a lawyer?{" "}
                <Link
                  href="/"
                  className="font-medium text-primary hover:underline"
                >
                  Search the directory
                </Link>{" "}
                — no account needed.
              </p>
            </div>
            <AttorneySignUpForm />
          </div>
          <div className="min-w-0 w-full lg:order-1 lg:self-start lg:mt-56">
            <ListingPitch />
          </div>
        </div>
      </div>
    </Layout>
  );
}
