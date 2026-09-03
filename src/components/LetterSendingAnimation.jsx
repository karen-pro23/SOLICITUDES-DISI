import React from 'react';
import './LetterSendingAnimation.css';

export default function LetterSendingAnimation({ ticketCode }) {
  return (
    <div className="letter-anim-shell">
      {/* Sparkles / Magic dust floating around */}
      <div className="sparkle-particle p1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.2-6.3-4.6-6.3 4.6 2.3-7.2-6-4.6h7.6z"/></svg>
      </div>
      <div className="sparkle-particle p2">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#60a5fa"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.2-6.3-4.6-6.3 4.6 2.3-7.2-6-4.6h7.6z"/></svg>
      </div>
      <div className="sparkle-particle p3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#34d399"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.2-6.3-4.6-6.3 4.6 2.3-7.2-6-4.6h7.6z"/></svg>
      </div>
      <div className="sparkle-particle p4">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#f472b6"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.2-6.3-4.6-6.3 4.6 2.3-7.2-6-4.6h7.6z"/></svg>
      </div>
      <div className="sparkle-particle p5">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.2-6.3-4.6-6.3 4.6 2.3-7.2-6-4.6h7.6z"/></svg>
      </div>

      {/* Main animation container */}
      <div className="letter-anim-box">
        {/* Curved sending flight trail */}
        <svg className="flight-trail" viewBox="0 0 240 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 15 105 Q 80 15, 160 65 T 235 15"
            stroke="url(#trail-gradient)"
            strokeWidth="3.5"
            strokeDasharray="8 6"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="trail-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
            </linearGradient>
          </defs>
        </svg>

        {/* Paper Plane Flying away */}
        <div className="paper-plane-fly">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" fill="#3b82f6" fillOpacity="0.2" />
          </svg>
        </div>

        {/* The Envelope and Letter composite */}
        <div className="envelope-wrapper">
          {/* Back of Envelope */}
          <div className="env-back"></div>

          {/* Letter Paper inside sliding down */}
          <div className="env-letter">
            <div className="letter-header-bar"></div>
            <div className="letter-line-short"></div>
            <div className="letter-line-full"></div>
            <div className="letter-line-full"></div>
            {ticketCode && (
              <div className="letter-ticket-pill">
                <span className="pill-dot">●</span> {ticketCode}
              </div>
            )}
          </div>

          {/* Front Pocket of Envelope */}
          <div className="env-front">
            <div className="env-pocket-left"></div>
            <div className="env-pocket-right"></div>
            <div className="env-pocket-bottom"></div>
          </div>

          {/* Envelope Top Flap folding shut */}
          <div className="env-top-flap"></div>

          {/* Wax Stamp Seal */}
          <div className="env-wax-seal">
            <span className="seal-check">✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}
