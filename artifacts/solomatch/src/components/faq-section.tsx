import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSectionProps {
  items: FaqItem[];
  title?: string;
  className?: string;
}

// Visible FAQ block. Pair it with faqPageLd(items) in the page's JSON-LD so the
// rendered questions match the structured data: Google requires FAQ markup to
// reflect on-page content, and answer engines (ChatGPT, Perplexity) parse the
// same Q&A to cite the page.
export function FaqSection({
  items,
  title = "Frequently asked questions",
  className,
}: FaqSectionProps) {
  if (items.length === 0) return null;
  return (
    <section
      className={cn("mt-16 pt-12 border-t border-border/60", className)}
      aria-label={title}
    >
      <h2 className="font-serif text-2xl md:text-3xl font-medium text-foreground mb-6">
        {title}
      </h2>
      <Accordion type="single" collapsible className="w-full max-w-3xl">
        {items.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-base md:text-lg font-medium text-foreground">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground leading-relaxed">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
