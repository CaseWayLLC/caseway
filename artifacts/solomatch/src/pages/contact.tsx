import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Mail, ArrowRight } from "lucide-react";
import { useSubmitContactMessage } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const contactSchema = z.object({
  name: z.string().min(1, "Your name is required").max(200),
  email: z.string().email("Enter a valid email").max(320),
  subject: z.string().min(1, "A subject is required").max(200),
  message: z.string().min(10, "Please include a few more details").max(5000),
});

type ContactValues = z.infer<typeof contactSchema>;

export default function Contact() {
  const { toast } = useToast();
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", subject: "", message: "" },
  });

  const submit = useSubmitContactMessage({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Message sent",
          description:
            "Thanks for reaching out. We'll get back to you by email as soon as we can.",
        });
        form.reset();
      },
      onError: () => {
        toast({
          title: "Something went wrong",
          description: "We couldn't send your message. Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  function onSubmit(values: ContactValues) {
    submit.mutate({ data: values });
  }

  return (
    <Layout>
      <div className="flex-1 w-full max-w-2xl mx-auto px-5 sm:px-6 md:px-8 pt-28 md:pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex items-center gap-3 text-primary">
            <Mail className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Contact &amp; Support
            </span>
          </div>
          <h1 className="mt-4 font-serif text-4xl md:text-5xl font-medium tracking-tight text-foreground">
            Get in touch
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Questions about a listing, your account, or how Caseway works? Send
            us a message and our team will reply by email. Caseway is a
            directory and does not provide legal advice.
          </p>
        </motion.div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-10 space-y-6"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="What is this about?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={6}
                      placeholder="How can we help?"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="lg"
              disabled={submit.isPending}
              className="h-14 px-8 text-base font-medium rounded-xl bg-gold text-gold-foreground hover:bg-gold/90"
            >
              {submit.isPending ? "Sending..." : "Send message"}
              {!submit.isPending && <ArrowRight className="ml-2 h-5 w-5" />}
            </Button>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
