import { useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'projectsphere_cookie_notice_dismissed';

export default function CookieNotice() {
  const [visible, setVisible] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'true');

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="cookie-notice" aria-label="Cookie notice">
      <p>
        ProjectSphere uses an essential cookie to keep your sign-in secure. No advertising or analytics cookies are active.
        <Link to="/privacy"> Learn more</Link>
      </p>
      <button type="button" className="secondary-button" onClick={dismiss}>Got it</button>
    </aside>
  );
}
