import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login, register } from "../api/auth.js";
import Brand from "./Brand.jsx";

export default function AuthPage({ onAuthenticated }) {
  const isSignup = useLocation().pathname === "/signup";
  const navigate = useNavigate();
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const updateField = (event) => {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isSignup) {
        await register(values);
      } else {
        await login({ username: values.username, password: values.password });
      }
      await onAuthenticated();
      navigate("/chat", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "We couldn't sign you in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-story-glow auth-story-glow-one" />
        <div className="auth-story-glow auth-story-glow-two" />
        <div className="auth-story-content">
          <Brand />
          <div className="story-copy">
            <span className="eyebrow"><Sparkles size={14} /> A little more in sync</span>
            <h1>Good conversations<br />change everything.</h1>
            <p>A calmer space for the people, plans, and moments you want to keep close.</p>
            <div className="story-orbit" aria-hidden="true">
              <span className="orbit-ring orbit-ring-outer" />
              <span className="orbit-ring orbit-ring-inner" />
              <span className="orbit-center"><Brand compact /></span>
              <span className="orbit-dot orbit-dot-one" />
              <span className="orbit-dot orbit-dot-two" />
              <span className="orbit-dot orbit-dot-three" />
              <span className="orbit-label orbit-label-top">always connected</span>
              <span className="orbit-label orbit-label-bottom">your people, your place</span>
            </div>
          </div>
          <div className="auth-story-footer">
            <span className="footer-signal"><i /> Private by design</span>
            <span>Thoughtful chats start here</span>
          </div>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-form-wrap">
          <div className="auth-heading">
            <span className="auth-icon"><LockKeyhole size={18} /></span>
            <p className="eyebrow">{isSignup ? "Create your account" : "Welcome back"}</p>
            <h2>{isSignup ? "Make room for good chats." : "Let's pick up where you left off."}</h2>
            <p className="auth-subtitle">
              {isSignup
                ? "Set up your space. Your people are one message away."
                : "Sign in to catch up with your people."}
            </p>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {isSignup ? (
              <>
                <label className="form-field">
                  <span>Your name</span>
                  <input
                    autoComplete="username"
                    maxLength={32}
                    minLength={2}
                    name="username"
                    onChange={updateField}
                    placeholder="e.g. Alex Morgan"
                    required
                    value={values.username}
                  />
                </label>
                <label className="form-field">
                  <span>Email address</span>
                  <input
                    autoComplete="email"
                    name="email"
                    onChange={updateField}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={values.email}
                  />
                </label>
              </>
            ) : (
              <label className="form-field">
                <span>Username or email</span>
                <input
                  autoComplete="username"
                  name="username"
                  onChange={updateField}
                  placeholder="Your username or email"
                  required
                  value={values.username}
                />
              </label>
            )}

            <label className="form-field">
              <span>Password</span>
              <span className="password-input-wrap">
                <input
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={isSignup ? 8 : undefined}
                  name="password"
                  onChange={updateField}
                  placeholder="Enter your password"
                  required
                  type={passwordVisible ? "text" : "password"}
                  value={values.password}
                />
                <button
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  className="password-toggle"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  type="button"
                >
                  {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {error && <div className="form-error" role="alert">{error}</div>}

            <button className="primary-button auth-submit" disabled={submitting} type="submit">
              <span>{submitting ? "One moment..." : isSignup ? "Create account" : "Sign in"}</span>
              {!submitting && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? "Already have an account?" : "New to orbit?"}
            {" "}
            <Link to={isSignup ? "/login" : "/signup"}>
              {isSignup ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <div className="auth-privacy">
            <span className="privacy-dot" />
            Your conversations stay yours.
          </div>
        </div>
        <span className="auth-copyright">© 2026 orbit. Made for meaningful moments.</span>
      </section>
    </main>
  );
}
