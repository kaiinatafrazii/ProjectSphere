import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    bio: '',
    location: '',
  });
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await register(form);
      navigate('/discover');
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <div className="page-shell auth-page">
      <div className="auth-card">
        <span className="eyebrow">Join the network</span>
        <h1>Create your creator profile</h1>
        <form onSubmit={handleSubmit} className="stacked-form compact-form">
          <label>
            Full name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </label>
          <label>
            Password
            <input type="password" name="password" value={form.password} onChange={handleChange} required />
          </label>
          <label>
            Bio
            <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} placeholder="Tell the community about your work and interests." />
          </label>
          <label>
            Location
            <input name="location" value={form.location} onChange={handleChange} placeholder="Your city or region" />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="primary-button full-width">Create account</button>
        </form>
        <p className="auth-switch">
          Already a member? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
