export default function PrivacyPage() {
  return (
    <div className="page-shell legal-page">
      <article className="container legal-content">
        <span className="eyebrow">Privacy</span>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: October 2026</p>
        <h2>Information you provide</h2>
        <p>
          ProjectSphere processes the account details you submit, including your name, email address, profile information,
          project content, reviews, and messages sent through the contact form.
        </p>
        <h2>How information is used</h2>
        <p>
          Account and project information is used to provide sign-in, project discovery, profile, publishing, and community
          review features. Contact details are used to handle the message you submit.
        </p>
        <h2>Authentication and storage</h2>
        <p>
          Passwords are stored as salted password hashes. An HttpOnly session cookie is used to authenticate requests.
          Project and account data is stored by the configured application database.
        </p>
        <h2>Cookies and analytics</h2>
        <p>
          The application uses an essential session cookie for sign-in and a browser preference to remember that this
          notice was dismissed. No advertising or analytics service is configured in this application.
        </p>
        <h2>Your choices</h2>
        <p>
          You can stop using the service at any time. For a privacy request, use the contact form on the
          <a href="/#contact"> Contact section</a>.
        </p>
        <h2>Policy changes</h2>
        <p>Material updates will be reflected on this page with a revised update date.</p>
      </article>
    </div>
  );
}
