import { Layout } from "@/components/layout";

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <Layout>
      <div className="flex-1 w-full max-w-2xl mx-auto px-5 sm:px-6 md:px-8 pt-28 md:pt-32 pb-20">
        <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Last updated: {lastUpdated}
        </p>
        <div className="legal-prose mt-10 space-y-6 text-base leading-relaxed text-foreground/85">
          {children}
        </div>
      </div>
    </Layout>
  );
}
