import { useEffect } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useConfirmBilling,
  getListMyAttorneysQueryKey,
  getListAttorneysQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { getAccountType, getFirmStatus } from "@/lib/account";

export default function ListingSuccess() {
  const confirmBilling = useConfirmBilling();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // An approved law firm's listings go live as soon as they're published —
  // there's no per-listing review, and firms don't self-serve checkout (their
  // pricing is custom, arranged with the sales team). Solo listings (and any
  // not-yet-approved firm) still wait on admin review before they appear.
  const firmLiveAfterPayment =
    getAccountType(user) === "firm" && getFirmStatus(user) === "approved";

  // Returning from signup Stripe Checkout (?billing=success). The Stripe-managed
  // webhook only reaches the published deployment, so in development this
  // explicit confirm is what records the new subscription. The listing still
  // waits on admin approval before it goes public.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") !== "success") return;
    confirmBilling
      .mutateAsync()
      .then(() => {
        queryClient.invalidateQueries({
          queryKey: getListMyAttorneysQueryKey(),
        });
        queryClient.invalidateQueries({ queryKey: getListAttorneysQueryKey() });
      })
      .catch(() => {
        // Non-fatal: the dashboard re-confirms billing on load too.
      });
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-gold/10 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-xl relative z-10"
        >
          <Card className="shadow-2xl border-white/10 bg-card/95 backdrop-blur-xl pt-10 pb-6 rounded-3xl overflow-hidden text-center">
            <CardHeader className="px-10">
              <div className="animate-in fade-in zoom-in duration-700 delay-100 flex flex-col items-center">
                <div className="w-28 h-28 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-8 ring-[12px] ring-primary/5">
                  <ShieldCheck className="h-14 w-14 text-primary" />
                </div>
                <CardTitle className="text-4xl font-serif font-medium mb-4 text-foreground tracking-tight">
                  {firmLiveAfterPayment
                    ? "Your listing is live"
                    : "Payment received"}
                </CardTitle>
                <CardDescription className="text-xl text-muted-foreground leading-relaxed">
                  {firmLiveAfterPayment ? (
                    <>
                      Thanks for joining Caseway. Your attorney listing is now
                      live in the directory for clients in your area. You can
                      list more attorneys anytime — each goes live as soon as you
                      publish it. Your firm is on a custom plan; our team will be
                      in touch about billing.
                    </>
                  ) : (
                    <>
                      Thanks for joining Caseway. Your payment is confirmed and
                      your listing is now pending review. Our team reviews every
                      listing before it goes live — typically within 3-5 business
                      days. Once approved, it will appear in the directory for
                      clients in your area.
                    </>
                  )}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row justify-center gap-4 mt-6 px-10 pb-10">
              <Button
                size="lg"
                className="w-full h-16 text-lg font-medium shadow-xl hover-elevate rounded-xl bg-gold text-gold-foreground hover:bg-gold/90"
                asChild
              >
                <Link href="/dashboard">
                  Go to my dashboard <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full h-16 text-lg font-medium rounded-xl border-border/60"
                asChild
              >
                <Link href="/">Browse the Directory</Link>
              </Button>
            </CardContent>
            {!firmLiveAfterPayment && (
              <p className="px-10 pb-8 text-center text-xs text-muted-foreground/70">
                Your payment was collected and processed by Indicium Markets Inc.
              </p>
            )}
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
