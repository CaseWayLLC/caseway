import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { PRACTICE_AREAS, LANGUAGES } from "@/lib/constants";
import { resolvePhotoUrl } from "@/lib/photo";
import { supabase } from "@/lib/supabase";
import {
  AddressAutocomplete,
  type AddressAutocompleteHandle,
} from "@/components/address-autocomplete";
import { PinMap } from "@/components/pin-map";
import type { Attorney, AttorneyInput } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Upload,
  Loader2,
  Image as ImageIcon,
  MapPin,
  AlertTriangle,
} from "lucide-react";

const MAPS_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

// Distance in kilometers between two [lat, lng] points (haversine).
function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// How far the pin may sit from the geocoded address before we warn (km).
const PIN_DRIFT_THRESHOLD_KM = 1;

export const attorneyFormSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  firmName: z.string().min(2, "Firm name is required"),
  title: z.string().min(2, "Title is required"),
  photoUrl: z.string().min(1, "A profile photo is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email("Valid email required"),
  bio: z.string().min(50, "Bio should be at least 50 characters"),
  yearsOfExperience: z.coerce.number().min(0, "Must be 0 or greater"),
  practiceAreas: z
    .array(z.string())
    .min(1, "Select at least one practice area"),
  jurisdictions: z.string().min(2, "Enter at least one jurisdiction"),
  barNumber: z.string().min(2, "Bar number is required"),
  officeAddress: z
    .string()
    .min(5, "Office address required")
    .refine((v) => /^\d/.test(v.trim()), {
      message:
        "Enter a specific street address starting with a building number (e.g. 123 Legal Way) — not just a town, county, or state.",
    }),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  calendlyUrl: z.string().url("Must be a valid Calendly URL").or(z.literal("")),
  offersFreeConsultation: z.boolean().default(false),
  videoConferencing: z.boolean().default(false),
  languages: z.array(z.string()).min(1, "Select at least one language"),
  websiteUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  linkedinUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  agreeToTerms: z.boolean().refine((v) => v === true, {
    message:
      "You must confirm your information is accurate and agree to the Terms of Use",
  }),
});

export type AttorneyFormValues = z.infer<typeof attorneyFormSchema>;

const BASE_DEFAULTS: AttorneyFormValues = {
  fullName: "",
  firmName: "",
  title: "Solo Attorney",
  photoUrl: "",
  phone: "",
  email: "",
  bio: "",
  yearsOfExperience: 0,
  practiceAreas: [],
  jurisdictions: "",
  barNumber: "",
  officeAddress: "",
  latitude: 40.7128,
  longitude: -74.006,
  calendlyUrl: "",
  offersFreeConsultation: true,
  videoConferencing: true,
  languages: ["English"],
  websiteUrl: "",
  linkedinUrl: "",
  agreeToTerms: false,
};

// Map validated form values to the API request body shape (AttorneyInput).
export function attorneyFormToApiBody(
  values: AttorneyFormValues,
): AttorneyInput {
  const { agreeToTerms, ...rest } = values;
  void agreeToTerms;
  return {
    ...rest,
    // "Fee Structure" was removed from the product because attorneys use varied
    // fee arrangements; send a constant to satisfy the required API/DB field.
    feeType: "Varies",
    calendlyUrl: rest.calendlyUrl || null,
    websiteUrl: rest.websiteUrl || null,
    linkedinUrl: rest.linkedinUrl || null,
    jurisdictions: rest.jurisdictions
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

// Map a persisted attorney row to editable form values.
export function attorneyToFormValues(a: Attorney): AttorneyFormValues {
  return {
    fullName: a.fullName,
    firmName: a.firmName,
    title: a.title,
    photoUrl: a.photoUrl,
    phone: a.phone,
    email: a.email,
    bio: a.bio,
    yearsOfExperience: a.yearsOfExperience,
    practiceAreas: a.practiceAreas,
    jurisdictions: a.jurisdictions.join(", "),
    barNumber: a.barNumber ?? "",
    officeAddress: a.officeAddress,
    latitude: a.latitude,
    longitude: a.longitude,
    calendlyUrl: a.calendlyUrl ?? "",
    offersFreeConsultation: a.offersFreeConsultation,
    videoConferencing: a.videoConferencing,
    languages: a.languages,
    websiteUrl: a.websiteUrl ?? "",
    linkedinUrl: a.linkedinUrl ?? "",
    agreeToTerms: true,
  };
}

interface AttorneyListingFormProps {
  heading: string;
  subheading: string;
  submitLabel: string;
  pendingLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: AttorneyFormValues) => Promise<void> | void;
  initialValues?: Partial<AttorneyFormValues>;
  /** Create mode: prefill the contact email from the signed-in account if empty. */
  prefillEmail?: string;
  /** Reports whether the form has unsaved changes (react-hook-form dirty state). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Optional content rendered above the form header (e.g. a marketing banner). */
  topSlot?: ReactNode;
}

export function AttorneyListingForm({
  heading,
  subheading,
  submitLabel,
  pendingLabel,
  isSubmitting,
  onSubmit,
  initialValues,
  prefillEmail,
  onDirtyChange,
  topSlot,
}: AttorneyListingFormProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  // Geocoded coordinates of the typed address, used to detect when the map
  // pin has drifted far from where the address actually resolves.
  const [addressCoords, setAddressCoords] = useState<[number, number] | null>(
    null,
  );
  const addressRef = useRef<AddressAutocompleteHandle>(null);

  const form = useForm<AttorneyFormValues>({
    resolver: zodResolver(attorneyFormSchema),
    defaultValues: { ...BASE_DEFAULTS, ...initialValues },
  });

  function applyCoords(lat: number, lng: number) {
    form.setValue("latitude", lat, { shouldValidate: true, shouldDirty: true });
    form.setValue("longitude", lng, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  async function geocodeTypedAddress() {
    const query = form.getValues("officeAddress").trim();
    if (query.length < 5) {
      toast({
        title: "Enter an address first",
        description: "Type the full office address, then locate it on the map.",
        variant: "destructive",
      });
      return;
    }
    setIsGeocoding(true);
    try {
      const coords = await addressRef.current?.resolveCoords(query);
      if (coords) {
        applyCoords(coords[0], coords[1]);
        setAddressCoords(coords);
        toast({
          title: "Map pin updated",
          description: "The map pin was set from your address.",
        });
      } else {
        toast({
          title: "Couldn't locate that address",
          description:
            "Try a more specific address, or drag the pin on the map.",
          variant: "destructive",
        });
      }
    } finally {
      setIsGeocoding(false);
    }
  }

  useEffect(() => {
    if (prefillEmail && !form.getValues("email")) {
      form.setValue("email", prefillEmail);
    }
  }, [prefillEmail, form]);

  const officeAddress = form.watch("officeAddress");
  const pinLat = Number(form.watch("latitude"));
  const pinLng = Number(form.watch("longitude"));

  // Debounced background geocode of the typed address so we can compare it
  // against the current pin. Only runs when Maps is available; otherwise we
  // never have address coordinates and the warning stays hidden.
  useEffect(() => {
    if (!MAPS_ENABLED) return;
    const query = officeAddress.trim();
    if (query.length < 5) {
      setAddressCoords(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      const coords = await addressRef.current?.resolveCoords(query);
      if (!cancelled && coords) setAddressCoords(coords);
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [officeAddress]);

  // The pin has drifted too far from where the typed address resolves.
  const pinDrift = useMemo(() => {
    if (!MAPS_ENABLED || !addressCoords) return false;
    if (!Number.isFinite(pinLat) || !Number.isFinite(pinLng)) return false;
    return distanceKm(addressCoords, [pinLat, pinLng]) > PIN_DRIFT_THRESHOLD_KM;
  }, [addressCoords, pinLat, pinLng]);

  const isDirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  async function handlePhotoUpload(file: File) {
    setIsUploadingPhoto(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          data?.error || "We couldn't start the upload. Please try again.",
        );
      }
      const { uploadURL, objectPath } = await res.json();
      const put = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!put.ok)
        throw new Error("The upload didn't complete. Please try again.");
      form.setValue("photoUrl", objectPath, { shouldValidate: true });
    } catch (err) {
      toast({
        title: "Photo upload failed",
        description:
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  const nextStep = async () => {
    const fields =
      step === 1
        ? ["fullName", "firmName", "title", "email", "phone", "photoUrl"]
        : step === 2
          ? [
              "officeAddress",
              "latitude",
              "longitude",
              "jurisdictions",
              "barNumber",
              "yearsOfExperience",
              "bio",
            ]
          : ["practiceAreas", "agreeToTerms"];

    const isValid = await form.trigger(fields as (keyof AttorneyFormValues)[]);
    if (isValid) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setStep((s) => s + 1);
    }
  };

  const steps = [
    { title: "Profile", desc: "Who you are" },
    { title: "Experience", desc: "Your background" },
    { title: "Services", desc: "What you offer" },
  ];

  return (
    <div className="flex-1 pt-28 pb-16 px-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-50">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gold/10 blur-[100px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {topSlot}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-card border border-white/20 shadow-xl text-primary mb-8">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-medium text-foreground mb-6 tracking-tight drop-shadow-sm">
            {heading}
          </h1>
          <p className="text-muted-foreground text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
            {subheading}
          </p>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
          <div className="hidden lg:block space-y-8">
            <div className="sticky top-28 bg-card border border-border/60 rounded-3xl p-8 shadow-sm">
              <h3 className="font-serif text-xl font-medium mb-8">
                Listing Setup
              </h3>
              <div className="space-y-8 relative before:absolute before:inset-0 before:mx-auto before:translate-x-0 before:h-full before:w-px before:bg-gradient-to-b before:from-border before:via-border/50 before:to-transparent">
                {steps.map((s, i) => {
                  const stepNum = i + 1;
                  const isActive = step === stepNum;
                  const isPassed = step > stepNum;

                  return (
                    <div
                      key={s.title}
                      className="relative flex items-center gap-5 bg-card"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 z-10 transition-colors ${
                          isActive
                            ? "bg-primary border-primary text-primary-foreground shadow-md scale-110"
                            : isPassed
                              ? "bg-primary border-primary text-primary-foreground"
                              : "bg-muted border-border/50 text-muted-foreground"
                        }`}
                      >
                        {isPassed ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <span className="text-sm font-medium">{stepNum}</span>
                        )}
                      </div>
                      <div>
                        <p
                          className={`text-base font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {s.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <Card className="shadow-2xl border-white/10 bg-card/95 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-8 pt-10 px-8 md:px-12">
              <div className="flex lg:hidden items-center gap-3 mb-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full ${step >= i ? "bg-primary" : "bg-muted"}`}
                  />
                ))}
              </div>
              <CardTitle className="text-3xl font-serif text-foreground tracking-tight">
                {step === 1 && "Your Profile"}
                {step === 2 && "Experience & Location"}
                {step === 3 && "Services & Practice"}
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                {step === 1 && "Tell us who you are and where you work."}
                {step === 2 &&
                  "Detail your experience, location, and practice areas."}
                {step === 3 &&
                  "Set your services, fees, and how clients reach you."}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-8 md:p-12">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-10"
                >
                  {/* STEP 1: Basic Info */}
                  <div
                    className={
                      step === 1
                        ? "block animate-in fade-in slide-in-from-right-4 duration-500 space-y-10"
                        : "hidden"
                    }
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">
                              Full Name
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Jane Doe, Esq."
                                autoComplete="name"
                                className="h-14 text-lg bg-background/50 rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">
                              Title
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Founding Partner"
                                className="h-14 text-lg bg-background/50 rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="firmName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">
                            Firm Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Law Office of Jane Doe"
                              autoComplete="organization"
                              className="h-14 text-lg bg-background/50 rounded-xl"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">
                              Email Address
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="jane@example.com"
                                autoComplete="email"
                                className="h-14 text-lg bg-background/50 rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">
                              Phone Number
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="(555) 123-4567"
                                autoComplete="tel"
                                className="h-14 text-lg bg-background/50 rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="photoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">
                            Profile Photo
                          </FormLabel>
                          <div className="flex items-center gap-6">
                            <Avatar className="h-24 w-24 border-2 border-border/60 shadow-sm bg-muted shrink-0">
                              <AvatarImage
                                src={resolvePhotoUrl(field.value)}
                                className="object-cover"
                              />
                              <AvatarFallback className="text-muted-foreground">
                                <ImageIcon className="h-8 w-8" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-2">
                              <input
                                id="photo-upload"
                                type="file"
                                accept="image/*"
                                className="peer sr-only"
                                disabled={isUploadingPhoto}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handlePhotoUpload(f);
                                  e.target.value = "";
                                }}
                              />
                              <FormControl>
                                <label
                                  htmlFor="photo-upload"
                                  className={`inline-flex items-center gap-2 h-12 px-6 rounded-xl border border-border/60 bg-background/50 text-base font-medium cursor-pointer hover:border-primary/40 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background ${isUploadingPhoto ? "opacity-60 pointer-events-none" : ""}`}
                                >
                                  {isUploadingPhoto ? (
                                    <>
                                      <Loader2 className="h-5 w-5 animate-spin" />{" "}
                                      Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-5 w-5" />{" "}
                                      {field.value
                                        ? "Replace photo"
                                        : "Upload photo"}
                                    </>
                                  )}
                                </label>
                              </FormControl>
                              <FormDescription className="text-sm">
                                Upload a professional headshot (JPG or PNG).
                              </FormDescription>
                              <FormMessage />
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end pt-8 border-t border-border/60">
                      <Button
                        type="button"
                        size="lg"
                        className="px-10 h-14 text-lg shadow-lg hover-elevate rounded-xl"
                        onClick={nextStep}
                      >
                        Continue <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                    </div>
                  </div>

                  {/* STEP 2: Professional Details */}
                  <div
                    className={
                      step === 2
                        ? "block animate-in fade-in slide-in-from-right-4 duration-500 space-y-10"
                        : "hidden"
                    }
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <FormField
                        control={form.control}
                        name="yearsOfExperience"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">
                              Years of Experience
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                className="h-14 text-lg bg-background/50 rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="jurisdictions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">
                              Jurisdictions (comma separated)
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="NY, NJ, CA"
                                className="h-14 text-lg bg-background/50 rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="barNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">
                            State Bar Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. 1234567"
                              className="h-14 text-lg bg-background/50 rounded-xl"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Your bar number lets our team verify your standing.
                            It is not shown publicly.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="officeAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">
                            Full Office Address
                          </FormLabel>
                          <FormControl>
                            <AddressAutocomplete
                              ref={addressRef}
                              placeholder="123 Legal Way, Suite 100, New York, NY 10001"
                              className="pl-12 h-14 text-lg bg-background/50 rounded-xl"
                              value={field.value}
                              name={field.name}
                              onChange={field.onChange}
                              onAddressChange={(value) =>
                                form.setValue("officeAddress", value, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                })
                              }
                              onSelectPlace={(place) => {
                                const loc = place.location;
                                if (loc) {
                                  applyCoords(loc.lat(), loc.lng());
                                  setAddressCoords([loc.lat(), loc.lng()]);
                                }
                              }}
                              onSelectCoords={(coords) => {
                                applyCoords(coords[0], coords[1]);
                                setAddressCoords(coords);
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-sm">
                            {MAPS_ENABLED
                              ? "Type your full street address including the building number, then pick a suggestion to set the map pin automatically, or use “Locate on map” below."
                              : "Type your full street address including the building number, then pick the closest suggestion to drop the map pin (your number is kept). Drag the pin to fine-tune."}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-base font-medium">Map Pin</p>
                        {MAPS_ENABLED && (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 px-5 border-border/60 bg-background rounded-xl"
                            disabled={isGeocoding}
                            onClick={geocodeTypedAddress}
                          >
                            {isGeocoding ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                                Locating...
                              </>
                            ) : (
                              <>
                                <MapPin className="mr-2 h-4 w-4" /> Locate on
                                map
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <PinMap
                          latitude={Number(form.watch("latitude")) || 0}
                          longitude={Number(form.watch("longitude")) || 0}
                          onChange={(lat, lng) => applyCoords(lat, lng)}
                        />
                        {pinDrift && (
                          <div
                            role="alert"
                            className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
                          >
                            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <span>
                              The map pin looks far from the address you typed.
                              Confirm it&rsquo;s in the right spot, or use{" "}
                              <span className="font-medium">
                                “Locate on map”
                              </span>{" "}
                              to reset it to the address.
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Drag the marker or click the map to fine-tune the
                          exact spot.
                        </p>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">
                            Professional Bio
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="h-48 text-lg resize-none bg-background/50 rounded-xl"
                              placeholder="Tell clients about your background, approach, and why they should choose you..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-between pt-8 border-t border-border/60">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="px-8 h-14 text-lg border-border/60 bg-background rounded-xl"
                        onClick={() => setStep(1)}
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        className="px-10 h-14 text-lg shadow-lg hover-elevate rounded-xl"
                        onClick={nextStep}
                      >
                        Continue <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                    </div>
                  </div>

                  {/* STEP 3: Services & Practice */}
                  <div
                    className={
                      step === 3
                        ? "block animate-in fade-in slide-in-from-right-4 duration-500 space-y-10"
                        : "hidden"
                    }
                  >
                    {/* Practice Areas */}
                    <FormField
                      control={form.control}
                      name="practiceAreas"
                      render={() => (
                        <FormItem>
                          <div className="mb-6">
                            <FormLabel className="text-xl font-medium">
                              Practice Areas
                            </FormLabel>
                            <FormDescription className="text-base mt-2">
                              Choose all areas where you represent clients.
                            </FormDescription>
                          </div>
                          <FormMessage className="mb-6 block" />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                            {Object.entries(PRACTICE_AREAS).map(
                              ([category, areas]) => (
                                <div key={category} className="space-y-4">
                                  <h4 className="font-serif font-medium text-lg text-primary border-b border-border/60 pb-2">
                                    {category}
                                  </h4>
                                  <div className="space-y-2">
                                    {areas.map((area) => (
                                      <FormField
                                        key={area}
                                        control={form.control}
                                        name="practiceAreas"
                                        render={({ field }) => {
                                          return (
                                            <FormItem
                                              key={area}
                                              className="flex flex-row items-start space-x-3 space-y-0 bg-background/40 p-2.5 rounded-xl hover:bg-background/80 transition-colors border border-transparent hover:border-border/50"
                                            >
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(
                                                    area,
                                                  )}
                                                  className="mt-0.5 h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                  onCheckedChange={(
                                                    checked,
                                                  ) => {
                                                    return checked
                                                      ? field.onChange([
                                                          ...field.value,
                                                          area,
                                                        ])
                                                      : field.onChange(
                                                          field.value?.filter(
                                                            (value) =>
                                                              value !== area,
                                                          ),
                                                        );
                                                  }}
                                                />
                                              </FormControl>
                                              <FormLabel className="font-normal text-base cursor-pointer leading-snug">
                                                {area}
                                              </FormLabel>
                                            </FormItem>
                                          );
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </FormItem>
                      )}
                    />

                    {/* Client Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <FormField
                        control={form.control}
                        name="calendlyUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">
                              Calendly Booking URL
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://calendly.com/yourname/30min"
                                className="h-14 text-lg bg-background/50 rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-sm mt-1">
                              Optional — let clients book directly.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="websiteUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">
                              Website
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://janedoe.law"
                                className="h-14 text-lg bg-background/50 rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-sm mt-1">
                              Optional — your firm or personal site.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Services */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <FormField
                        control={form.control}
                        name="offersFreeConsultation"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
                            <div className="space-y-1">
                              <FormLabel className="text-base font-medium">
                                Free Consultation
                              </FormLabel>
                              <FormDescription className="text-sm">
                                Initial consult at no cost?
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="h-6 w-6 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="videoConferencing"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
                            <div className="space-y-1">
                              <FormLabel className="text-base font-medium">
                                Video Meetings
                              </FormLabel>
                              <FormDescription className="text-sm">
                                Available for virtual consultations?
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="h-6 w-6 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="languages"
                      render={() => (
                        <FormItem className="bg-muted/30 p-6 rounded-2xl border border-border/50 shadow-sm">
                          <div className="mb-4">
                            <FormLabel className="text-lg font-medium text-foreground">
                              Languages
                            </FormLabel>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {LANGUAGES.map((lang) => (
                              <FormField
                                key={lang}
                                control={form.control}
                                name="languages"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={lang}
                                      className="flex flex-row items-center space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(lang)}
                                          className="h-5 w-5 data-[state=checked]:bg-primary"
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([
                                                  ...field.value,
                                                  lang,
                                                ])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== lang,
                                                  ),
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal text-base cursor-pointer">
                                        {lang}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage className="mt-4 block" />
                        </FormItem>
                      )}
                    />

                    <div className="rounded-2xl border border-gold/40 bg-gold/10 p-5 sm:p-6 space-y-3">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                        What happens next
                      </h4>
                      <ul className="text-sm leading-relaxed text-foreground/90 space-y-2">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                          <span>
                            <strong>Submit & pay</strong> — you'll be taken to
                            secure checkout to start your subscription.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                          <span>
                            <strong>Review</strong> — our team reviews every
                            listing before it goes live, typically within 3–5
                            business days.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                          <span>
                            <strong>Go live</strong> — once approved, your
                            listing appears in the directory for clients in your
                            area.
                          </span>
                        </li>
                      </ul>
                      <p className="text-xs text-muted-foreground">
                        If not approved, billing is canceled automatically. You
                        can cancel anytime from your dashboard.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="agreeToTerms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-2xl border border-border/60 bg-muted/30 p-6 shadow-sm">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-1 h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                          </FormControl>
                          <div className="space-y-1.5 leading-relaxed">
                            <FormLabel className="text-base font-medium cursor-pointer">
                              I confirm the information in this listing is
                              accurate
                            </FormLabel>
                            <FormDescription className="text-sm">
                              I certify that all information I have provided is
                              true and accurate, and I understand that I am
                              solely responsible for any false or misleading
                              representation I make. I agree to the{" "}
                              <Link
                                href="/terms"
                                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                              >
                                Terms of Use
                              </Link>
                              .
                            </FormDescription>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-between pt-10 border-t border-border/60">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="px-8 h-14 text-lg border-border/60 bg-background rounded-xl"
                        onClick={() => setStep(2)}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        size="lg"
                        className="px-12 h-14 text-lg font-medium shadow-xl hover-elevate rounded-xl bg-gold text-gold-foreground hover:bg-gold/90 transition-all duration-300"
                        disabled={isSubmitting || isUploadingPhoto}
                      >
                        {isSubmitting ? pendingLabel : submitLabel}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
