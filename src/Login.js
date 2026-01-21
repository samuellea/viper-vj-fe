import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API_URL from './config';
import './Login.css';

export function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false); // Track if we should show red borders

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setHasError(false);
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Login attempt:', { username });
      
      // Call backend API to authenticate user
      const response = await axios.post(`${API_URL}/login`, {
        username,
        password
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Login successful:', response.data);
      
      // Store credentials in localStorage after successful login
      localStorage.setItem('username', username);
      localStorage.setItem('isAuthenticated', 'true');
      
      // Call the onLogin callback to update parent state
      if (onLogin) {
        onLogin({ username });
      }
    } catch (err) {
      console.error('Login error:', err);
      
      if (axios.isAxiosError(err) && err.response) {
        // Server responded with error
        const errorData = err.response.data;
        const errorMessage = errorData.error || 'Login failed. Please try again.';
        setError(errorMessage);
        
        // Show red borders if user doesn't exist
        if (errorData.type === 'USER_NOT_FOUND') {
          setHasError(true);
        }
      } else if (err.request) {
        // Request was made but no response received
        setError('No response from server. Backend might not be running.');
      } else {
        // Something else happened
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove error styling when user focuses on inputs
  const handleInputFocus = () => {
    setHasError(false);
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
              className={`form-input ${hasError ? 'form-input-error' : ''}`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={handleInputFocus}
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
              className={`form-input ${hasError ? 'form-input-error' : ''}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={handleInputFocus}
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
