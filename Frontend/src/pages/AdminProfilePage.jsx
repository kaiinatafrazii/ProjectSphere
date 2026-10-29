import { useEffect, useState } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordField from '../components/PasswordField.jsx';

export default function AdminProfilePage() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', bio: '', location: '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    apiRequest('/admin/profile')
      .then(({ user }) => {
        setProfile(user);
        setForm({ name: user.name || '', bio: user.bio || '', location: user.location || '' });
      })
      .catch((loadError) => setError(loadError.message || 'Unable to load administrator profile.'))
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest('/users/me', {
        method: 'PUT',
        body: JSON.stringify({ ...form, skills: profile?.skills || [] }),
      });
      setProfile((current) => ({ ...current, ...result.user }));
      updateUser(result.user);
      setNotice('Profile updated.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to update your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest('/admin/password', {
        method: 'PUT',
        body: JSON.stringify(password),
      });
      setPassword({ currentPassword: '', newPassword: '' });
      setNotice(result.message || 'Password changed.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to change your password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="admin-profile-grid">
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {notice ? <p className="success-text" role="status">{notice}</p> : null}
      {loading ? <div className="empty-state" role="status">Loading administrator profile…</div> : null}
      {!loading && profile ? (
        <>
          <section className="dashboard-section">
            <h2>Profile details</h2>
            <p>{profile.email} · Administrator</p>
            <form className="stacked-form" onSubmit={saveProfile}>
              <label>Full name<input value={form.name} maxLength={100} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
              <label>Location<input value={form.location} maxLength={100} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} /></label>
              <label>Bio<textarea value={form.bio} maxLength={1000} rows={4} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} /></label>
              <button className="primary-button" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
            </form>
          </section>
          <section className="dashboard-section">
            <h2>Change password</h2>
            <p>Changing your password signs out other active sessions.</p>
            <form className="stacked-form" onSubmit={changePassword}>
              <PasswordField label="Current password" name="currentPassword" value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" />
              <PasswordField label="New password" name="newPassword" value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} autoComplete="new-password" minLength={12} />
              <p className="field-help">Use at least 12 characters.</p>
              <button className="primary-button" type="submit" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Update password'}</button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}
