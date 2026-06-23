import { LegalPage } from "@/components/legal-page";

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="June 17, 2026">
      <p>
        This Privacy Policy explains how Caseway, owned and operated by CaseWay
        LLC, a Wyoming limited liability company ("we", "us"), collects, uses,
        and shares information when you use the Caseway website and services
        (the "Service"). By using the Service, you agree to the practices
        described here.
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>
          <strong>Information you provide.</strong> When attorneys create a
          listing, we collect details such as name, contact information,
          location, jurisdictions, practice areas, languages, and fees. When you
          contact us, we collect the information you choose to share.
        </li>
        <li>
          <strong>Search information.</strong> When you search the directory, we
          process the location and legal category you enter to return relevant
          results.
        </li>
        <li>
          <strong>Automatically collected information.</strong> We may collect
          standard technical data such as IP address, browser type, device
          information, and usage activity.
        </li>
      </ul>

      <h2>2. How We Use Information</h2>
      <ul>
        <li>To operate, maintain, and improve the Service;</li>
        <li>To display attorney listings and return search results;</li>
        <li>To respond to inquiries and provide support;</li>
        <li>
          To detect, prevent, and address fraud, abuse, or security issues;
        </li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2>3. How We Share Information</h2>
      <p>
        Attorney listing information is intended to be displayed publicly on the
        Service. We do not sell your personal information. We may share
        information with service providers who help us operate the Service, or
        when required by law or to protect our rights.
      </p>

      <h2>4. Third-Party Services</h2>
      <p>
        The Service uses third-party tools, including mapping and address
        autocomplete provided by Google Maps Platform. When these features are
        used, certain data (such as your search input) may be processed by the
        third party in accordance with their own privacy policies. Payments for
        paid listings are collected by Indicium Markets Inc. and processed
        through Stripe; your payment details are handled by these payment
        providers under their own privacy policies and are not stored by Caseway.
      </p>

      <h2>5. Cookies and Similar Technologies</h2>
      <p>
        We may use cookies and similar technologies to keep the Service working
        properly, remember your preferences, and understand how the Service is
        used. You can control cookies through your browser settings.
      </p>

      <h2>6. Data Security</h2>
      <p>
        We take reasonable measures to protect information from unauthorized
        access, loss, or misuse. However, no method of transmission or storage
        is completely secure, and we cannot guarantee absolute security.
      </p>

      <h2>7. Your Choices</h2>
      <p>
        You may request access to, correction of, or deletion of the personal
        information we hold about you, subject to applicable law. Attorneys may
        request changes to or removal of their listing by contacting us.
      </p>

      <h2>8. Children's Privacy</h2>
      <p>
        The Service is not directed to children under 18, and we do not
        knowingly collect personal information from children.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Changes are
        effective when posted on this page with an updated "Last updated" date.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about this Privacy Policy? Contact us at{" "}
        <a href="mailto:privacy@caseway.com">privacy@caseway.com</a>.
      </p>
    </LegalPage>
  );
}
