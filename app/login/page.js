"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: process.env.NODE_ENV === "development"
            ? "http://localhost:3000"
            : "https://journal.pondering.life",
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <main style={{
      minHeight: "100vh", background: "#0c0c14",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "monospace", padding: "20px",
    }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{
        width: "100%", maxWidth: "360px",
        animation: "fadeUp 0.5s ease",
      }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🌿</div>
          <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "3px", marginBottom: "8px" }}>
            FOCUS JOURNAL
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: "normal", color: "#6ee7c7" }}>
            Welcome back.
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#7870a8", lineHeight: 1.6 }}>
            Enter your email and we'll send you a magic link — no password needed.
          </p>
        </div>

        {!sent ? (
          <div>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${email ? "rgba(110,231,199,0.3)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "12px", padding: "16px 20px",
              marginBottom: "14px",
              transition: "border-color 0.2s ease",
            }}>
              <div style={{ fontSize: "10px", color: "#6860a0", letterSpacing: "2px", marginBottom: "8px" }}>
                YOUR EMAIL
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="you@example.com"
                autoFocus
                style={{
                  width: "100%", background: "transparent",
                  border: "none", outline: "none",
                  color: "#ede8ff", fontSize: "15px",
                  fontFamily: "monospace", caretColor: "#6ee7c7",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <div style={{
                background: "rgba(245,122,106,0.1)",
                border: "1px solid rgba(245,122,106,0.3)",
                borderRadius: "8px", padding: "12px 16px",
                color: "#f57a6a", fontSize: "12px",
                marginBottom: "14px",
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={!email.trim() || loading}
              style={{
                width: "100%",
                background: email.trim() && !loading
                  ? "linear-gradient(135deg, #6ee7c7, #4ab880)"
                  : "rgba(255,255,255,0.04)",
                border: "none", borderRadius: "12px", padding: "16px",
                fontSize: "13px", fontFamily: "monospace",
                color: email.trim() && !loading ? "#0c0c14" : "#3a3858",
                cursor: email.trim() && !loading ? "pointer" : "default",
                fontWeight: "bold", letterSpacing: "1px",
                transition: "all 0.2s ease",
              }}>
              {loading ? "Sending..." : "Send magic link →"}
            </button>

            <p style={{
              textAlign: "center", margin: "16px 0 0",
              fontSize: "11px", color: "#3a3858", lineHeight: 1.6,
            }}>
              New here? Just enter your email — we'll create your account automatically.
            </p>
          </div>
        ) : (
          <div style={{
            background: "rgba(110,231,199,0.06)",
            border: "1px solid rgba(110,231,199,0.2)",
            borderRadius: "16px", padding: "32px 24px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>📬</div>
            <h2 style={{ margin: "0 0 10px", fontSize: "18px", fontWeight: "normal", color: "#6ee7c7" }}>
              Check your email!
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#a098c8", lineHeight: 1.7 }}>
              We sent a magic link to{" "}
              <strong style={{ color: "#ede8ff" }}>{email}</strong>.
              Tap it to sign in — no password needed.
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "#3a3858", lineHeight: 1.6 }}>
              Didn't get it? Check your spam folder or{" "}
              <button
                onClick={() => setSent(false)}
                style={{
                  background: "none", border: "none",
                  color: "#6860a0", cursor: "pointer",
                  fontFamily: "monospace", fontSize: "11px",
                  textDecoration: "underline", padding: 0,
                }}>
                try again
              </button>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}