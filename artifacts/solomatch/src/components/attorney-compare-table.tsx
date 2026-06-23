import { Link } from "wouter";
import { Check, Minus, X, BadgeCheck, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Attorney } from "@workspace/api-client-react";
import { resolvePhotoUrl } from "@/lib/photo";
import { attorneyPath } from "@/lib/seo";

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1 font-medium text-primary">
      <Check className="h-4 w-4" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Minus className="h-4 w-4" /> No
    </span>
  );
}

function locationText(a: Attorney): string {
  const parts = [a.city, a.stateCode].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return a.officeAddress?.split(",")[0] ?? "—";
}

interface CompareRow {
  label: string;
  render: (a: Attorney) => React.ReactNode;
}

const ROWS: CompareRow[] = [
  { label: "Experience", render: (a) => `${a.yearsOfExperience} yrs` },
  { label: "Location", render: (a) => locationText(a) },
  {
    label: "Practice areas",
    render: (a) => (
      <div className="flex flex-wrap gap-1.5">
        {a.practiceAreas.map((area) => (
          <Badge
            key={area}
            variant="secondary"
            className="rounded-full border-border/50 bg-muted/60 text-xs font-medium text-foreground/80"
          >
            {area}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    label: "Free consultation",
    render: (a) => <YesNo value={a.offersFreeConsultation} />,
  },
  {
    label: "Video available",
    render: (a) => <YesNo value={a.videoConferencing} />,
  },
  { label: "Languages", render: (a) => a.languages.join(", ") },
  {
    label: "Verified",
    render: (a) =>
      a.isVerified ? (
        <span className="inline-flex items-center gap-1 font-medium text-primary">
          <BadgeCheck className="h-4 w-4" /> Verified
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    label: "Contact",
    render: (a) => (
      <div className="flex flex-col gap-1">
        <a href={`tel:${a.phone}`} className="text-primary hover:underline">
          {a.phone}
        </a>
        <a
          href={`mailto:${a.email}`}
          className="break-all text-primary hover:underline"
        >
          {a.email}
        </a>
      </div>
    ),
  },
];

interface AttorneyCompareTableProps {
  attorneys: Attorney[];
  onRemove: (id: number) => void;
  onView: (id: number) => void;
}

export function AttorneyCompareTable({
  attorneys,
  onRemove,
  onView,
}: AttorneyCompareTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60">
            <th className="sticky left-0 z-10 w-40 min-w-40 bg-card p-4" />
            {attorneys.map((a) => (
              <th
                key={a.id}
                className="min-w-[220px] border-l border-border/40 p-4 text-left align-top"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <Avatar className="h-14 w-14 border-2 border-background bg-muted shadow-sm">
                      <AvatarImage
                        src={resolvePhotoUrl(a.photoUrl)}
                        alt={a.fullName}
                        className="object-cover"
                      />
                      <AvatarFallback className="font-serif">
                        {a.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      onClick={() => onRemove(a.id)}
                      aria-label={`Remove ${a.fullName} from comparison`}
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => onView(a.id)}
                      className="text-left font-serif text-lg font-medium leading-tight text-foreground transition-colors hover:text-primary"
                    >
                      {a.fullName}
                    </button>
                    <p className="mt-1 line-clamp-2 text-xs font-normal text-muted-foreground">
                      {a.title} at {a.firmName}
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-fit rounded-full font-medium"
                  >
                    <Link href={attorneyPath(a)}>
                      View profile <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr
              key={row.label}
              className="border-b border-border/40 last:border-0"
            >
              <th
                scope="row"
                className="sticky left-0 z-10 w-40 min-w-40 bg-card p-4 text-left align-top text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {row.label}
              </th>
              {attorneys.map((a) => (
                <td
                  key={a.id}
                  className="border-l border-border/40 p-4 align-top text-foreground/90"
                >
                  {row.render(a)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
