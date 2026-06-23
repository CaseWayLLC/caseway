import { LegalPage } from "@/components/legal-page";

export default function Disclaimer() {
  return (
    <LegalPage title="Legal Disclaimer" lastUpdated="June 17, 2026">
      <p>
        Please read this disclaimer carefully before using Caseway, owned and
        operated by CaseWay LLC, a Wyoming limited liability company (the
        "Service"). By using the Service, you acknowledge and agree to the
        following.
      </p>

      <h2>Not a Law Firm; No Legal Advice</h2>
      <p>
        Caseway is not a law firm and does not provide legal advice, legal
        opinions, or legal representation. Nothing on the Service should be
        construed as legal advice. For advice about your specific situation,
        consult a licensed attorney directly.
      </p>

      <h2>No Attorney-Client Relationship</h2>
      <p>
        Using the Service, browsing listings, or contacting an attorney through
        information found on the Service does not create an attorney-client
        relationship with Caseway. Such a relationship is formed only by a
        separate, express agreement between you and an attorney.
      </p>

      <h2>Not a Referral Service or Endorsement</h2>
      <p>
        Caseway is a directory and discovery platform. We do not refer,
        recommend, endorse, or vouch for any attorney listed on the Service. The
        appearance of an attorney on the Service is not a guarantee or warranty
        of their qualifications, competence, or quality of service.
      </p>

      <h2>Accuracy of Listings</h2>
      <p>
        Listing information is provided by attorneys or third parties and may be
        incomplete, outdated, or inaccurate. Caseway does not independently
        verify this information. You are solely responsible for confirming an
        attorney's identity, licensing, credentials, disciplinary history, and
        good standing with the appropriate state bar before retaining them.
      </p>

      <h2>No Guarantee of Outcomes</h2>
      <p>
        Nothing on the Service is a promise or guarantee regarding the results
        of any legal matter. Prior results do not guarantee a similar outcome.
      </p>

      <h2>Your Own Due Diligence</h2>
      <p>
        Any decision to hire an attorney is an important one and should not be
        based solely on information found on the Service. We encourage you to
        conduct your own research and due diligence.
      </p>

      <h2>Third-Party Content</h2>
      <p>
        The Service may include links to or content from third parties. Caseway
        is not responsible for the accuracy or reliability of any third-party
        content or services.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this disclaimer? Contact us at{" "}
        <a href="mailto:legal@caseway.com">legal@caseway.com</a>.
      </p>
    </LegalPage>
  );
}
