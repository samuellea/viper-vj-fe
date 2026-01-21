import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_URL from './config';
import './Login.css';

export function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    // Validate username format (alphanumeric and underscores, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      setError('Username must be 3-20 characters and contain only letters, numbers, and underscores');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Signup attempt:', { username });
      
      // Call backend API to create user
      const response = await axios.post(`${API_URL}/signup`, {
        username,
        password
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Signup successful:', response.data);
      
      // Store credentials in localStorage after successful signup
      localStorage.setItem('username', username);
      localStorage.setItem('isAuthenticated', 'true');
      
      // Redirect to home page after successful signup
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Signup error:', err);
      
      if (axios.isAxiosError(err)) {
        if (err.response) {
          // Server responded with error
          const errorData = err.response.data;
          setError(errorData.error || errorData.details || 'Signup failed. Please try again.');
        } else if (err.request) {
          // Request was made but no response received
          setError('No response from server. Backend might not be running.');
        } else {
          // Something else happened
          setError(`Error: ${err.message}`);
        }
      } else {
        setError(err.message || 'Signup failed. Please try again.');
      }
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
        <h1 className="login-title">Viper Video Jockey</h1>
        <h2 className="login-subtitle">Sign Up</h2>
        
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
              placeholder="Enter your custom password"
              disabled={isSubmitting}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your custom password"
              disabled={isSubmitting}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>
        
        <div className="signup-link-container">
          <Link to="/login" className="signup-link">
            Already have an account? Login instead
          </Link>
        </div>
      </div>
    </div>
  );
}
