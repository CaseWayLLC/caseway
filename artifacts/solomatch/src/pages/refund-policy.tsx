import { LegalPage } from "@/components/legal-page";

export default function RefundPolicy() {
  return (
    <LegalPage title="Refund & Cancellation Policy" lastUpdated="June 17, 2026">
      <p>
        This Refund &amp; Cancellation Policy explains how paid listings, fees,
        and cancellations work on Caseway, owned and operated by CaseWay LLC, a
        Wyoming limited liability company ("Caseway", "we", "us"). Payments for
        Caseway listings are collected and processed by{" "}
        <strong>Indicium Markets Inc.</strong> on behalf of CaseWay LLC.
      </p>

      <h2>1. Listing Fees and Billing</h2>
      <p>
        Searching the directory and contacting attorneys is always free for the
        public. Attorney listings are offered on a paid subscription basis. The
        price that applies to you is shown before you submit, and you are billed
        at the time you submit your listing. Subscriptions renew automatically
        each billing period until canceled. Payments are collected and processed
        by <strong>Indicium Markets Inc.</strong> on behalf of CaseWay LLC, using
        a third-party payment processor (Stripe); Indicium Markets Inc. is the
        merchant of record and may appear as such on your statements and
        receipts.
      </p>

      <h2>2. Cancelling a Listing</h2>
      <p>
        Attorneys may cancel at any time from the billing portal in your
        dashboard, or by contacting us through our{" "}
        <a href="/contact">contact page</a>. Cancellation stops future billing
        and removes your listing from the public directory going forward. It does
        not retroactively refund amounts already paid for the current billing
        period. We may retain certain records as described in our{" "}
        <a href="/privacy">Privacy Policy</a> and as required by law.
      </p>

      <h2>3. Refunds</h2>
      <p>
        Unless stated otherwise at the point of sale or required by applicable
        law:
      </p>
      <ul>
        <li>
          Fees are billed in advance for the applicable subscription period and
          are generally non-refundable.
        </li>
        <li>
          Cancelling stops future charges but does not refund the current
          period.
        </li>
        <li>
          If a listing is rejected during review, the related subscription is
          canceled going forward and no further charges are made.
        </li>
      </ul>

      <h2>4. Errors and Unauthorized Charges</h2>
      <p>
        If you believe you were charged in error or without authorization,
        contact us promptly through our <a href="/contact">contact page</a> so
        we and Indicium Markets Inc. can investigate. We will review eligible
        requests in good faith and issue corrections or refunds where
        appropriate.
      </p>

      <h2>5. Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be
        reflected by updating the "Last updated" date above. Your continued use
        of the Service after changes take effect constitutes acceptance of the
        revised policy.
      </p>

      <h2>6. Contact</h2>
      <p>
        Questions about this policy can be sent through our{" "}
        <a href="/contact">contact page</a>.
      </p>
    </LegalPage>
  );
}
