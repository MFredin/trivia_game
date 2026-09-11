import { useState } from 'react';
import Plate from './Plate.jsx';
import { login, register } from '../api/client.js';

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data =
        mode === 'login' ? await login({ email, password }) : await register({ email, username, password });
      onAuthenticated(data.token, data.user);
    } catch (err) {
      if (err.code === 'invalid_credentials') setError('Wrong email or password.');
      else if (err.code === 'email_or_username_taken') setError('That email or username is already in use.');
      else if (err.code === 'password_too_short') setError('Password needs to be at least 8 characters.');
      else if (err.code === 'invalid_email') setError('Enter a valid email address.');
      else setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Archive Access</p>
          <h2 className="screen-title">{mode === 'login' ? 'Log In' : 'Register'}</h2>
        </div>
      </div>
      <Plate>
        <form className="start-form" onSubmit={handleSubmit}>
          {error && <div className="error-banner">{error}</div>}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {mode === 'register' && (
            <label>
              Player name
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={40}
              />
            </label>
          )}
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" className="primary-button" disabled={submitting}>
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
          >
            {mode === 'login' ? "Need an account? Register" : 'Already have an account? Log in'}
          </button>
        </form>
      </Plate>
    </div>
  );
}
