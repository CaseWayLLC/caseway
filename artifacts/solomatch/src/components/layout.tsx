import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { UserMenu } from "@/components/user-menu";
import { ArrowLeft, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { useSavedAttorneys } from "@/lib/saved-attorneys";

export function Layout({
  children,
  hideFooter = false,
  hideAuthNav = false,
  hideSignIn = false,
  solidHeader = false,
  fullWidthHeader = false,
  onBack,
  onLogoClick,
}: {
  children: React.ReactNode;
  hideFooter?: boolean;
  hideAuthNav?: boolean;
  hideSignIn?: boolean;
  solidHeader?: boolean;
  fullWidthHeader?: boolean;
  onBack?: () => void;
  onLogoClick?: () => void;
}) {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();
  const { count: savedCount } = useSavedAttorneys();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 relative">
      <div className="noise-overlay" />
      <header
        className={`fixed top-0 left-0 right-0 z-50 w-full border-b transition-colors duration-300 ${
          scrolled || solidHeader
            ? "bg-background/80 backdrop-blur-md border-border/60 shadow-sm"
            : "border-transparent"
        }`}
      >
        <div
          className={`${
            fullWidthHeader ? "w-full px-4 sm:px-6" : "container mx-auto px-4"
          } h-20 flex items-center justify-between`}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            {onBack && (
              <Button
                variant="outline"
                size="icon"
                onClick={onBack}
                aria-label="Back to legal categories"
                className="shrink-0 h-11 w-11 rounded-full hover:bg-muted shadow-sm"
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
              </Button>
            )}
            <Link
              href="/"
              onClick={onLogoClick}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <Logo className="w-10 h-10 object-contain group-hover:scale-105 transition-transform duration-300" />
              <span className="font-serif font-medium text-2xl tracking-tight text-foreground">
                Caseway
              </span>
            </Link>
          </div>

          <nav className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              asChild
              className="gap-1.5 px-2 text-base font-medium sm:px-3"
            >
              <Link
                href="/saved"
                aria-label={
                  savedCount > 0
                    ? `Saved lawyers (${savedCount})`
                    : "Saved lawyers"
                }
              >
                <Bookmark className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">Saved</span>
                {savedCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                    {savedCount}
                  </span>
                )}
              </Link>
            </Button>

            {location !== "/" && (
              <Button
                variant="ghost"
                asChild
                className="hidden sm:flex text-base font-medium"
              >
                <Link href="/">Find a Lawyer</Link>
              </Button>
            )}

            {!isSignedIn && !hideAuthNav && (
              <>
                {!hideSignIn && (
                  <Button
                    variant="ghost"
                    asChild
                    className="text-base font-medium"
                  >
                    <Link href="/sign-in">Attorney Sign In</Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  asChild
                  className="hidden sm:flex hover-elevate border-primary/20 text-primary hover:bg-primary/5 text-base h-11 px-6 shadow-sm font-medium rounded-full"
                >
                  <Link href="/signup">List Your Practice</Link>
                </Button>
              </>
            )}

            {isSignedIn && (
              <>
                <Button
                  variant="ghost"
                  asChild
                  className="hidden sm:flex text-base font-medium"
                >
                  <Link href="/network">Network</Link>
                </Button>
                <Button
                  variant="ghost"
                  asChild
                  className="text-base font-medium"
                >
                  <Link href="/dashboard">My Listing</Link>
                </Button>
                <UserMenu />
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative z-10">{children}</main>

      {!hideFooter && <Footer />}
    </div>
  );
}
