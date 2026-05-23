import { useNavigate } from "react-router-dom";

import { usePartnerAuth } from "@/context/PartnerAuth";

export function SignInPage() {
  const navigate = useNavigate();
  const { setSession } = usePartnerAuth();

  const handleFitIdSignIn = () => {
    // Set a fake session for demo purposes
    setSession({
      access_token: "demo_access_token_" + Date.now(),
      token_type: "bearer",
      scope: "body_measurements,fit_preferences,allergies,posture,skin_tone",
      profile: null,
      receivedAt: Date.now()
    });
    navigate("/", { replace: true });
  };

  const handleSocialSignIn = (provider: string) => {
    alert(`${provider} sign-in is not available in this demo. Please use FitID to continue.`);
  };

  return (
    <div className="signin-container">
      <div className="signin-card">
        <div className="signin-header">
          <div className="brand">
            <span className="brand-mark">Luma</span>
            <span className="brand-name">Atelier</span>
          </div>
          <span className="pill">Partner demo</span>
        </div>

        <div className="signin-content">
          <h1>Welcome back</h1>
          <p className="signin-subtitle">Sign in to access your personalized shopping experience</p>

          <div className="signin-options">
            <button
              className="signin-btn google-btn"
              onClick={() => handleSocialSignIn("Google")}
              type="button"
            >
              <svg className="signin-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <button
              className="signin-btn facebook-btn"
              onClick={() => handleSocialSignIn("Facebook")}
              type="button"
            >
              <svg className="signin-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#1877F2"
                  d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                />
              </svg>
              Continue with Facebook
            </button>

            <button
              className="signin-btn apple-btn"
              onClick={() => handleSocialSignIn("Apple")}
              type="button"
            >
              <svg className="signin-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#000"
                  d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                />
              </svg>
              Continue with Apple
            </button>

            <button
              className="signin-btn fitid-btn"
              onClick={handleFitIdSignIn}
              type="button"
            >
              <svg className="signin-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#1e3a32" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.80 3.97-2.1 5.39z" />
              </svg>
              Continue with FitID
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
