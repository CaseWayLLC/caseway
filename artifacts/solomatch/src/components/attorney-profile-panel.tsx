import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import {
  X,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Award,
  Linkedin,
  ArrowRight,
  BadgeCheck,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetAttorney,
  useGetSimilarAttorneys,
  getGetAttorneyQueryKey,
  getGetSimilarAttorneysQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrack } from "@/lib/analytics";
import { resolvePhotoUrl } from "@/lib/photo";
import { attorneyPath } from "@/lib/seo";
import { SaveButton } from "@/components/save-button";

interface AttorneyProfilePanelProps {
  id: number | null;
  onClose: () => void;
  onSelectSimilar: (id: number) => void;
}

export function AttorneyProfilePanel({
  id,
  onClose,
  onSelectSimilar,
}: AttorneyProfilePanelProps) {
  const track = useTrack();
  const {
    data: attorney,
    isLoading,
    isError,
  } = useGetAttorney(id!, {
    query: { enabled: !!id, queryKey: getGetAttorneyQueryKey(id!) },
  });

  const { data: similarAttorneys, isLoading: isLoadingSimilar } =
    useGetSimilarAttorneys(id!, {
      query: { enabled: !!id, queryKey: getGetSimilarAttorneysQueryKey(id!) },
    });

  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const FOCUSABLE =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  useEffect(() => {
    if (!id) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const node = panelRef.current;
      if (!node) return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, onClose]);

  useEffect(() => {
    if (!id) return;
    // Move focus into the panel, then restore it to the trigger on close.
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const node = panelRef.current;
    const focusTarget = node?.querySelector<HTMLElement>(FOCUSABLE);
    (focusTarget ?? node)?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [id]);

  useEffect(() => {
    if (id) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [id]);

  // Switching to a similar attorney swaps content in place — reset scroll to top.
  useEffect(() => {
    if (!id) return;
    const vp = panelRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    vp?.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);

  return createPortal(
    <AnimatePresence>
      {id && (
        <div
          key="attorney-profile-panel"
          className="fixed inset-0 z-[60] flex justify-end"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Attorney profile"
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[600px] h-full bg-card shadow-2xl flex flex-col border-l border-border/50 z-10 focus:outline-none"
          >
            <div className="flex items-center justify-between p-6 border-b border-border/50 bg-background/80 backdrop-blur shrink-0 z-20">
              <h2 className="font-serif font-medium text-2xl text-primary">
                Attorney Profile
              </h2>
              <div className="flex items-center gap-2">
                <SaveButton
                  attorneyId={id}
                  attorneyName={attorney?.fullName}
                  variant="labeled"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close attorney profile"
                  className="rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 bg-background relative">
              {isError ? (
                <div className="flex flex-col items-center justify-center text-center h-[50vh] p-12 gap-4">
                  <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center text-destructive mb-2">
                    <X className="w-8 h-8" />
                  </div>
                  <p className="font-serif text-2xl text-foreground">
                    Unable to load profile
                  </p>
                  <p className="text-base text-muted-foreground max-w-[250px]">
                    Something went wrong fetching this attorney. Please close
                    and try again.
                  </p>
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="mt-4 px-8 rounded-full"
                  >
                    Close
                  </Button>
                </div>
              ) : isLoading || !attorney ? (
                <ProfileSkeleton />
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="p-6 sm:p-8 md:p-10 pb-32"
                >
                  <div className="flex flex-col items-center text-center mb-10 sm:mb-12 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gold/10 rounded-full blur-3xl -z-10" />

                    <Avatar className="h-32 w-32 sm:h-44 sm:w-44 mb-5 sm:mb-6 border-4 border-background shadow-xl ring-1 ring-border/50">
                      <AvatarImage
                        src={resolvePhotoUrl(attorney.photoUrl)}
                        className="object-cover"
                      />
                      <AvatarFallback className="text-5xl font-serif text-muted-foreground bg-muted">
                        {attorney.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <h1 className="font-serif text-3xl sm:text-4xl font-medium mb-3 text-foreground tracking-tight flex items-center justify-center gap-2">
                      {attorney.fullName}
                      {attorney.isVerified && (
                        <BadgeCheck
                          className="w-6 h-6 text-primary shrink-0"
                          aria-label="Verified attorney"
                        />
                      )}
                    </h1>
                    {attorney.isVerified && (
                      <Badge
                        variant="default"
                        className="mb-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 px-3 py-1 text-xs rounded-full"
                      >
                        <BadgeCheck className="w-3.5 h-3.5 mr-1" /> Verified by
                        Caseway
                      </Badge>
                    )}
                    <div className="flex flex-col items-center mb-8">
                      <p className="text-primary font-medium text-lg mb-1">
                        {attorney.title}
                      </p>
                      <p className="text-muted-foreground text-base">
                        {attorney.firmName}
                      </p>
                      {attorney.barNumber && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <ShieldCheck
                            className="h-3.5 w-3.5 text-primary/70"
                            aria-hidden="true"
                          />
                          State Bar No. {attorney.barNumber}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-center gap-3 mb-10">
                      {attorney.offersFreeConsultation && (
                        <Badge
                          variant="default"
                          className="bg-primary text-primary-foreground hover:bg-primary px-4 py-1.5 text-sm shadow-sm rounded-full"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Free
                          Consultation
                        </Badge>
                      )}
                      {attorney.videoConferencing && (
                        <Badge
                          variant="secondary"
                          className="px-4 py-1.5 text-sm shadow-sm bg-muted/80 border-border/50 rounded-full text-foreground/80"
                        >
                          <Globe className="w-4 h-4 mr-2 text-primary" /> Video
                          Available
                        </Badge>
                      )}
                    </div>

                    {attorney.calendlyUrl ? (
                      <Button
                        className="w-full sm:w-auto px-12 py-7 text-lg shadow-xl hover-elevate rounded-full font-medium bg-gold text-gold-foreground hover:bg-gold/90"
                        onClick={() => {
                          track({
                            type: "consultation_click",
                            attorneyId: attorney.id,
                          });
                          window.open(
                            attorney.calendlyUrl!,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      >
                        {attorney.offersFreeConsultation
                          ? "Book Free Consultation"
                          : "Book a Consultation"}
                      </Button>
                    ) : (
                      <Button
                        asChild
                        className="w-full sm:w-auto px-12 py-7 text-lg shadow-xl hover-elevate rounded-full font-medium bg-gold text-gold-foreground hover:bg-gold/90"
                      >
                        <a
                          href={`mailto:${attorney.email}`}
                          onClick={() =>
                            track({
                              type: "consultation_click",
                              attorneyId: attorney.id,
                            })
                          }
                        >
                          Contact for a Consultation
                        </a>
                      </Button>
                    )}

                    <Link
                      href={attorneyPath(attorney)}
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      View full profile page
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="space-y-12">
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                        <Award className="w-4 h-4 text-gold" /> About
                      </h3>
                      <p className="text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap font-serif">
                        {attorney.bio}
                      </p>
                    </section>

                    <Separator className="bg-border/60" />

                    <section className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 sm:gap-y-10 gap-x-8">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gold" /> Experience
                        </h3>
                        <p className="text-lg font-medium">
                          {attorney.yearsOfExperience} Years
                        </p>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-gold" />{" "}
                          Languages
                        </h3>
                        <p className="text-lg font-medium">
                          {attorney.languages.join(", ")}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gold" /> Jurisdictions
                        </h3>
                        <p className="text-lg font-medium">
                          {attorney.jurisdictions.join(", ")}
                        </p>
                      </div>
                    </section>

                    <Separator className="bg-border/60" />

                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5 flex items-center gap-2">
                        <Scale className="w-4 h-4 text-gold" /> Practice Areas
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {attorney.practiceAreas.map((area) => (
                          <Badge
                            key={area}
                            variant="outline"
                            className="bg-card px-4 py-2 text-sm font-medium border-border/60 text-foreground/90 shadow-sm rounded-full"
                          >
                            {area}
                          </Badge>
                        ))}
                      </div>
                    </section>

                    <Separator className="bg-border/60" />

                    <section className="bg-muted/30 rounded-3xl p-6 sm:p-8 border border-border/50">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
                        Contact Info
                      </h3>
                      <div className="space-y-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5 text-primary" />
                          </div>
                          <span className="text-lg leading-snug pt-2.5 font-medium">
                            {attorney.officeAddress}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Phone className="w-5 h-5 text-primary" />
                          </div>
                          <a
                            href={`tel:${attorney.phone}`}
                            className="text-lg font-medium text-primary hover:underline"
                          >
                            {attorney.phone}
                          </a>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Mail className="w-5 h-5 text-primary" />
                          </div>
                          <a
                            href={`mailto:${attorney.email}`}
                            className="text-lg font-medium text-primary hover:underline break-all"
                          >
                            {attorney.email}
                          </a>
                        </div>
                        {attorney.websiteUrl && (
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Globe className="w-5 h-5 text-primary" />
                            </div>
                            <a
                              href={attorney.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() =>
                                track({
                                  type: "website_click",
                                  attorneyId: attorney.id,
                                })
                              }
                              className="text-lg font-medium text-primary hover:underline"
                            >
                              Visit Website
                            </a>
                          </div>
                        )}
                        {attorney.linkedinUrl && (
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Linkedin className="w-5 h-5 text-primary" />
                            </div>
                            <a
                              href={attorney.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-lg font-medium text-primary hover:underline"
                            >
                              View LinkedIn
                            </a>
                          </div>
                        )}
                      </div>
                    </section>

                    {similarAttorneys && similarAttorneys.length > 0 && (
                      <>
                        <Separator className="bg-border/60" />
                        <section>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
                            Similar Lawyers
                          </h3>
                          <div className="space-y-4">
                            {similarAttorneys.map((similar) => (
                              <div
                                key={similar.id}
                                className="flex items-center gap-5 p-4 rounded-2xl border border-border/50 bg-card hover:bg-muted/50 hover:border-primary/40 hover:shadow-md cursor-pointer transition-all duration-300 group"
                                onClick={() => onSelectSimilar(similar.id)}
                              >
                                <Avatar className="h-14 w-14 border-2 border-background bg-muted shadow-sm shrink-0">
                                  <AvatarImage
                                    src={resolvePhotoUrl(similar.photoUrl)}
                                    className="object-cover"
                                  />
                                  <AvatarFallback className="text-sm font-serif">
                                    {similar.fullName.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-lg font-serif font-medium leading-none mb-2 group-hover:text-primary transition-colors truncate">
                                    {similar.fullName}
                                  </p>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {similar.practiceAreas[0]}
                                  </p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border border-border/50 group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </ScrollArea>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ProfileSkeleton() {
  return (
    <div className="p-6 sm:p-8 md:p-10">
      <div className="flex flex-col items-center mb-10 sm:mb-12">
        <Skeleton className="w-32 h-32 sm:w-44 sm:h-44 rounded-full mb-5 sm:mb-6" />
        <Skeleton className="h-10 w-72 mb-3" />
        <Skeleton className="h-6 w-48 mb-8" />
        <Skeleton className="h-14 w-full max-w-[300px] rounded-full" />
      </div>
      <div className="space-y-12">
        <div>
          <Skeleton className="h-4 w-24 mb-5" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Separator className="bg-border/50" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}

function Scale({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </svg>
  );
}
