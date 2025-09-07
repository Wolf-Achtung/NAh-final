import React, { useState } from 'react';

/**
 * Eine einfache Login‑Komponente.  Sie zeigt ein Formular mit
 * Benutzername und Passwort und ruft das Backend an, um die
 * Anmeldeinformationen zu verifizieren.  Bei erfolgreicher Anmeldung
 * wird onLogin aufgerufen und das Token zurückgegeben.
 */
const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError('Bitte Benutzername und Passwort eingeben');
      return;
    }
    setLoading(true);
    try {
      const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.error || 'Login fehlgeschlagen');
      }
      const data = await response.json();
      const token = data.token || '';
      onLogin(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f3f4f6',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          padding: '2rem',
          background: '#fff',
          border: '1px solid #ccc',
          borderRadius: '8px',
          minWidth: '280px',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Login</h2>
        {error && (
          <div style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>{error}</div>
        )}
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="username"
            style={{ display: 'block', marginBottom: '0.3rem' }}
          >
            Benutzername
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="password"
            style={{ display: 'block', marginBottom: '0.3rem' }}
          >
            Passwort
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.6rem',
            background: '#004080',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Einloggen…' : 'Einloggen'}
        </button>
      </form>
    </div>
  );
};

export default Login;