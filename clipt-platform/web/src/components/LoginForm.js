import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LoginForm.css'; // We'll create this styling next

const LoginForm = ({ onLoginSuccess }) => {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Validation state
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  // Auth context
  const { login, register, loading, error: authError } = useAuth();
  
  // Password strength meter
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    
    let strength = 0;
    // Length check
    if (password.length >= 8) strength += 1;
    // Contains numbers
    if (/\d/.test(password)) strength += 1;
    // Contains lowercase
    if (/[a-z]/.test(password)) strength += 1;
    // Contains uppercase
    if (/[A-Z]/.test(password)) strength += 1;
    // Contains special chars
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    setPasswordStrength(strength);
  }, [password]);
  
  // Form validation
  const validateForm = () => {
    const errors = {};
    
    // Email validation
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Email is invalid';
    }
    
    // Password validation
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    
    // Registration-specific validation
    if (isRegistering) {
      if (!username) {
        errors.username = 'Username is required';
      }
      
      if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitted(true);
    
    if (!validateForm()) {
      return;
    }
    
    try {
      if (isRegistering) {
        await register({
          username,
          email,
          password,
        });
        
        // If registration successful, switch to login form
        setIsRegistering(false);
        setFormSubmitted(false);
        // Don't clear email so they can login right away
        setPassword('');
        
      } else {
        const userData = await login({
          email,
          password,
          rememberMe,
        });
        
        // If login successful, notify parent component
        if (userData && onLoginSuccess) {
          onLoginSuccess(userData);
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      // Error handling is managed by the AuthContext
    }
  };
  
  // Toggle between login and register forms
  const toggleForm = () => {
    setIsRegistering(!isRegistering);
    setFormSubmitted(false);
    setFormErrors({});
  };
  
  return (
    <div className="login-form-container">
      <div className="login-form-card">
        <div className="login-form-header">
          <h2>{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
          <p>{isRegistering 
              ? 'Sign up to start earning tokens and unlock exclusive content!' 
              : 'Sign in to access your token wallet and boosts!'}</p>
        </div>
        
        {authError && (
          <div className="login-form-error-message">
            <span className="error-icon">⚠️</span>
            <span>{authError}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="login-form">
          {isRegistering && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={formSubmitted && formErrors.username ? 'error' : ''}
                placeholder="Choose a username"
                disabled={loading}
              />
              {formSubmitted && formErrors.username && (
                <span className="error-text">{formErrors.username}</span>
              )}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={formSubmitted && formErrors.email ? 'error' : ''}
              placeholder="Enter your email"
              disabled={loading}
            />
            {formSubmitted && formErrors.email && (
              <span className="error-text">{formErrors.email}</span>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={formSubmitted && formErrors.password ? 'error' : ''}
              placeholder="Enter your password"
              disabled={loading}
            />
            {formSubmitted && formErrors.password && (
              <span className="error-text">{formErrors.password}</span>
            )}
            
            {isRegistering && password && (
              <div className="password-strength-meter">
                <div className="strength-bars">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div 
                      key={level}
                      className={`strength-bar ${level <= passwordStrength ? 'active' : ''} ${
                        passwordStrength === 5 ? 'high' : 
                        passwordStrength >= 3 ? 'medium' : 'low'
                      }`}
                    />
                  ))}
                </div>
                <span className="strength-text">
                  {passwordStrength === 0 && 'Password strength'}
                  {passwordStrength === 1 && 'Very weak'}
                  {passwordStrength === 2 && 'Weak'}
                  {passwordStrength === 3 && 'Medium'}
                  {passwordStrength === 4 && 'Strong'}
                  {passwordStrength === 5 && 'Very strong'}
                </span>
              </div>
            )}
          </div>
          
          {isRegistering && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={formSubmitted && formErrors.confirmPassword ? 'error' : ''}
                placeholder="Confirm your password"
                disabled={loading}
              />
              {formSubmitted && formErrors.confirmPassword && (
                <span className="error-text">{formErrors.confirmPassword}</span>
              )}
            </div>
          )}
          
          {!isRegistering && (
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <span className="checkbox-text">Remember me</span>
              </label>
              <a href="#" className="forgot-password">Forgot password?</a>
            </div>
          )}
          
          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <span className="loading-spinner"></span>
            ) : (
              isRegistering ? 'Sign Up' : 'Sign In'
            )}
          </button>
        </form>
        
        <div className="login-form-footer">
          <p>
            {isRegistering 
              ? 'Already have an account?' 
              : "Don't have an account?"
            }
            <button 
              type="button"
              className="toggle-form-button"
              onClick={toggleForm}
              disabled={loading}
            >
              {isRegistering ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
