import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Login.css';

export function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Replace with actual authentication API call
      // For now, we'll just store credentials in localStorage
      // In a real app, you'd call your backend API here
      console.log('Login attempt:', { username });
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Store credentials in localStorage
      localStorage.setItem('username', username);
      localStorage.setItem('isAuthenticated', 'true');
      
      // Call the onLogin callback to update parent state
      if (onLogin) {
        onLogin({ username });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img 
          src="/shlug.png" 
          alt="Viper Video Jockey" 
          className="login-logo"
        />
        <h1 className="login-title">🐍 Viper Video Jockey 🎬</h1>
        <h2 className="login-subtitle">Login</h2>
        
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={isSubmitting}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={isSubmitting}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="signup-link-container">
          <Link to="/signup" className="signup-link">
            No account? Sign up instead
          </Link>
        </div>
      </div>
      
      <div className="webmaster-footer">
        Webmaster: <a 
          href="https://soundcloud.com/samlea" 
          target="_blank" 
          rel="noopener noreferrer"
          className="webmaster-link"
        >
          sam_lea
        </a>
      </div>
    </div>
  );
}
