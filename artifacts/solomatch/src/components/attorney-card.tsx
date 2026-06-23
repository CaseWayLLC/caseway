import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Clock, ArrowRight, Navigation } from "lucide-react";
import type { Attorney } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { resolvePhotoUrl } from "@/lib/photo";
import { attorneyPath } from "@/lib/seo";
import { SaveButton } from "@/components/save-button";

interface AttorneyCardProps {
  attorney: Attorney;
  onClick: (id: number) => void;
  selected?: boolean;
  // When provided (e.g. on the attorney network page), shows how far this
  // attorney's office is from the viewer.
  distanceMiles?: number | null;
}

export function AttorneyCard({
  attorney,
  onClick,
  selected,
  distanceMiles,
}: AttorneyCardProps) {
  const initials = attorney.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        role="button"
        tabIndex={0}
        aria-label={`View profile for ${attorney.fullName}`}
        className={`relative cursor-pointer overflow-hidden transition-all duration-300 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          selected
            ? "ring-2 ring-primary border-transparent shadow-lg bg-card/80"
            : "border-border/60 hover:border-primary/40 hover:shadow-xl bg-card"
        } rounded-2xl`}
        onClick={() => onClick(attorney.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(attorney.id);
          }
        }}
      >
        <SaveButton
          attorneyId={attorney.id}
          attorneyName={attorney.fullName}
          className="absolute right-4 top-4 z-10"
        />
        <CardContent className="p-5 md:p-8">
          <div className="flex gap-4 sm:gap-5 md:gap-8">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 md:h-28 md:w-28 border-4 border-background shadow-md bg-muted shrink-0 transition-transform duration-300 group-hover:scale-[1.02]">
              <AvatarImage
                src={resolvePhotoUrl(attorney.photoUrl)}
                alt={attorney.fullName}
                loading="lazy"
                decoding="async"
                className="object-cover"
              />
              <AvatarFallback className="text-2xl font-serif text-muted-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex flex-col mb-2 pr-10">
                {attorney.isPro && (
                  <Badge className="mb-1.5 w-fit rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold hover:bg-gold/10">
                    Pro
                  </Badge>
                )}
                <h3 className="font-serif font-medium text-xl md:text-2xl text-foreground leading-tight group-hover:text-primary transition-colors">
                  {attorney.fullName}
                </h3>
                <p className="text-sm font-medium text-muted-foreground mt-1 line-clamp-1">
                  {attorney.title}{" "}
                  <span className="font-normal text-muted-foreground/70">
                    at
                  </span>{" "}
                  {attorney.firmName}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-sm text-foreground/80">
                <div className="flex items-center gap-1.5 font-medium">
                  <Clock className="h-4 w-4 text-gold" />
                  <span>{attorney.yearsOfExperience} yrs exp.</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="line-clamp-1 max-w-[200px]">
                    {attorney.officeAddress.split(",")[0]}
                  </span>
                </div>
                {typeof distanceMiles === "number" && (
                  <div className="flex items-center gap-1.5 font-medium text-primary">
                    <Navigation className="h-4 w-4" />
                    <span>
                      {distanceMiles < 1
                        ? "Under 1 mi away"
                        : `${Math.round(distanceMiles)} mi away`}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-4 md:mt-5">
                {attorney.practiceAreas.slice(0, 3).map((area) => (
                  <Badge
                    key={area}
                    variant="secondary"
                    className="font-medium text-xs px-3 py-1 bg-muted/60 text-foreground/80 border-border/50 rounded-full"
                  >
                    {area}
                  </Badge>
                ))}
                {attorney.practiceAreas.length > 3 && (
                  <Badge
                    variant="outline"
                    className="font-medium text-xs px-3 py-1 text-muted-foreground border-border/50 rounded-full"
                  >
                    +{attorney.practiceAreas.length - 3} more
                  </Badge>
                )}
              </div>

              <div className="mt-4 md:mt-5">
                <Link
                  href={attorneyPath(attorney)}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  View full profile
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
