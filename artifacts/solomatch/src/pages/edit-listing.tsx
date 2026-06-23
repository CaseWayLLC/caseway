import { Link, Redirect, useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMyAttorneys,
  useUpdateAttorney,
  getListMyAttorneysQueryKey,
  getListAttorneysQueryKey,
  getGetDirectoryStatsQueryKey,
  getGetAttorneyQueryKey,
} from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  AttorneyListingForm,
  attorneyFormToApiBody,
  attorneyToFormValues,
  type AttorneyFormValues,
} from "@/components/attorney-form";

export default function EditListing() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { loading: authLoading, isSignedIn } = useAuth();
  const updateAttorney = useUpdateAttorney();
  const { data, isLoading, isError } = useListMyAttorneys({
    query: {
      enabled: isSignedIn === true,
      queryKey: getListMyAttorneysQueryKey(),
    },
  });

  async function onSubmit(values: AttorneyFormValues) {
    try {
      await updateAttorney.mutateAsync({
        id,
        data: attorneyFormToApiBody(values),
      });
      queryClient.invalidateQueries({ queryKey: getListMyAttorneysQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListAttorneysQueryKey() });
      queryClient.invalidateQueries({
        queryKey: getGetDirectoryStatsQueryKey(),
      });
      queryClient.invalidateQueries({ queryKey: getGetAttorneyQueryKey(id) });
      toast({
        title: "Listing updated",
        description: "Your changes were saved and sent for review.",
      });
      setLocation("/dashboard");
    } catch (error) {
      const message =
        (error as { data?: { error?: string } })?.data?.error ||
        "Please check your inputs and try again.";
      toast({
        title: "Could not save your changes",
        description: message,
        variant: "destructive",
      });
    }
  }

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

  if (isLoading) {
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );
  }

  const attorney = !isError ? data?.find((a) => a.id === id) : undefined;

  if (!attorney) {
    return (
      <Layout>
        <div className="flex-1 pt-28 pb-16 px-4">
          <div className="max-w-xl mx-auto text-center py-20">
            <h1 className="font-serif text-3xl font-medium mb-4">
              Listing not found
            </h1>
            <p className="text-muted-foreground text-lg mb-8">
              We couldn't find a listing you own with that link. It may have
              been removed, or it belongs to another account.
            </p>
            <Button asChild className="rounded-full h-12 px-8">
              <Link href="/dashboard">Back to my listings</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <AttorneyListingForm
        heading="Edit your listing"
        subheading="Update your practice details. Your changes are reviewed again before they go public."
        submitLabel="Save Changes"
        pendingLabel="Saving..."
        isSubmitting={updateAttorney.isPending}
        onSubmit={onSubmit}
        initialValues={attorneyToFormValues(attorney)}
      />
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
