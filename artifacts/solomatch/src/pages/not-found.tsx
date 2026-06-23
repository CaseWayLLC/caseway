import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center relative z-10 max-w-xl mx-auto"
        >
          <div className="w-28 h-28 bg-muted rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-inner">
            <AlertCircle className="h-14 w-14 text-muted-foreground/60" />
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-medium text-foreground mb-6 tracking-tight">
            Page Not Found
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Button
            size="lg"
            className="h-16 px-10 text-lg font-medium shadow-lg hover-elevate rounded-xl"
            asChild
          >
            <Link href="/">
              <ArrowLeft className="mr-2 w-5 h-5" /> Return to Homepage
            </Link>
          </Button>
        </motion.div>
      </div>
    </Layout>
  );
}
