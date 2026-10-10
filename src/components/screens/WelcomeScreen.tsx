import React, { useState, useEffect } from 'react';
import { useMissionStore } from '../../store/missionStore';
import { MISSION_PROFILES } from '../../types/missionProfiles';
import EarthScene from '../earth/EarthScene';

export function WelcomeScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const startMission = useMissionStore((s) => s.startMission);
  const setMissionConfig = useMissionStore((s) => s.setMissionConfig);
  const status = useMissionStore((s) => s.status);
  const config = useMissionStore((s) => s.config);
  const telemetry = useMissionStore((s) => s.telemetry);

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Monitor scroll for subtle frosted navbar background without scroll-jacking
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLaunchMissionControl = () => {
    if (status !== 'active') {
      if (!config) {
        setMissionConfig(MISSION_PROFILES.orbital.defaultConfig);
      }
      startMission();
    }
    setScreen('mission-control');
  };

  const scrollToCapabilities = () => {
    const el = document.getElementById('capabilities');
    if (el) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };

  // Safe fallback metrics
  const altitude = telemetry?.orbit?.altitudeKm != null && !isNaN(telemetry.orbit.altitudeKm)
    ? `${telemetry.orbit.altitudeKm.toFixed(1)} km`
    : '650.0 km';
  const signal = telemetry?.comm?.signalDbm != null && !isNaN(telemetry.comm.signalDbm)
    ? `${telemetry.comm.signalDbm.toFixed(0)} dBm`
    : '-72 dBm';
  const healthStatus = telemetry?.healthStatus ?? 'nominal';

  return (
    <div
      className="vyom-landing-root"
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#020409',
        color: '#f0f4fc',
        fontFamily: 'var(--font-body, "Inter", sans-serif)',
        overflowX: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Scoped Minimal Design Styles ── */}
      <style>{`
        .vyom-nav-link {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          transition: color 0.2s ease;
          padding: 6px 10px;
        }
        .vyom-nav-link:hover, .vyom-nav-link:focus-visible {
          color: #00d4ff;
          outline: none;
        }

        .vyom-btn-primary {
          background: #00d4ff;
          color: #020409;
          border: 1px solid #00d4ff;
          border-radius: 4px;
          padding: 12px 24px;
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.25);
        }
        .vyom-btn-primary:hover, .vyom-btn-primary:focus-visible {
          background: #38e1ff;
          border-color: #38e1ff;
          box-shadow: 0 0 28px rgba(0, 212, 255, 0.45);
          transform: translateY(-1px);
          outline: none;
        }

        .vyom-btn-secondary {
          background: rgba(5, 18, 36, 0.6);
          color: #f0f4fc;
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: 4px;
          padding: 12px 22px;
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          backdrop-filter: blur(8px);
        }
        .vyom-btn-secondary:hover, .vyom-btn-secondary:focus-visible {
          background: rgba(0, 212, 255, 0.12);
          border-color: rgba(0, 212, 255, 0.6);
          color: #00d4ff;
          transform: translateY(-1px);
          outline: none;
        }

        .capability-card {
          background: linear-gradient(180deg, rgba(8, 20, 42, 0.6) 0%, rgba(3, 9, 20, 0.8) 100%);
          border: 1px solid rgba(0, 212, 255, 0.14);
          border-radius: 8px;
          padding: 28px 24px;
          transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        .capability-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.4), transparent);
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .capability-card:hover {
          transform: translateY(-3px);
          border-color: rgba(0, 212, 255, 0.35);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 0 24px rgba(0, 212, 255, 0.1);
        }
        .capability-card:hover::before {
          opacity: 1;
        }

        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        .status-dot-pulse {
          animation: pulseDot 2.4s ease-in-out infinite;
        }

        @media (max-width: 900px) {
          .vyom-hero-grid {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
            padding-top: 100px !important;
            gap: 36px !important;
          }
          .vyom-globe-container {
            height: 380px !important;
            max-width: 100% !important;
          }
          .vyom-capabilities-grid {
            grid-template-columns: 1fr !important;
          }
          .vyom-nav-desktop-links {
            display: none !important;
          }
          .vyom-mobile-menu-btn {
            display: block !important;
          }
        }
      `}</style>

      {/* ── Fixed Clean Navigation Bar ── */}
      <header
        role="banner"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px clamp(20px, 4vw, 56px)',
          background: isScrolled ? 'rgba(2, 4, 9, 0.92)' : 'rgba(2, 4, 9, 0.5)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: isScrolled ? '1px solid rgba(0, 212, 255, 0.18)' : '1px solid rgba(255, 255, 255, 0.05)',
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}
      >
        {/* Left: VYOM Brand Logo */}
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(2, 4, 9, 0.8) 100%)',
              border: '1px solid rgba(0, 212, 255, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00d4ff',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            ◈
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: '0.18em',
                color: '#ffffff',
                lineHeight: 1,
              }}
            >
              VYOM
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8.5,
                letterSpacing: '0.16em',
                color: 'rgba(0, 212, 255, 0.75)',
                textTransform: 'uppercase',
                marginTop: 3,
              }}
            >
              SATELLITE INTELLIGENCE
            </span>
          </div>
        </div>

        {/* Center: Navigation Links (No About tab) */}
        <nav
          className="vyom-nav-desktop-links"
          role="navigation"
          aria-label="Main Navigation"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
          }}
        >
          <button
            onClick={handleLaunchMissionControl}
            className="vyom-nav-link"
          >
            Mission Control
          </button>
          <button
            onClick={scrollToCapabilities}
            className="vyom-nav-link"
          >
            Capabilities
          </button>
          <button
            onClick={() => setScreen('academy')}
            className="vyom-nav-link"
            style={{ color: '#00ff88' }}
          >
            3D Lab
          </button>
        </nav>

        {/* Right: Prominent Launch Mission Control Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleLaunchMissionControl}
            className="vyom-btn-primary"
            style={{ padding: '9px 18px', fontSize: 10 }}
          >
            <span>⬡</span>
            <span>Launch Mission Control</span>
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="vyom-mobile-menu-btn"
            style={{
              display: 'none',
              background: 'none',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 4,
              color: '#ffffff',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 16,
            }}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 64,
            left: 0,
            right: 0,
            background: 'rgba(2, 4, 9, 0.98)',
            borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
            zIndex: 999,
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLaunchMissionControl();
            }}
            className="vyom-nav-link"
            style={{ textAlign: 'left', fontSize: 13 }}
          >
            Mission Control
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              scrollToCapabilities();
            }}
            className="vyom-nav-link"
            style={{ textAlign: 'left', fontSize: 13 }}
          >
            Capabilities
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              setScreen('academy');
            }}
            className="vyom-nav-link"
            style={{ textAlign: 'left', fontSize: 13, color: '#00ff88' }}
          >
            3D Lab / Academy
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* ==============================================================
            HERO SECTION: 2-Column Composition (Content Left, 3D Globe Right)
            ============================================================== */}
        <section
          id="hero"
          style={{
            minHeight: 'calc(100vh - 40px)',
            display: 'flex',
            alignItems: 'center',
            padding: '120px clamp(20px, 4.5vw, 64px) 48px',
            position: 'relative',
          }}
        >
          <div
            className="vyom-hero-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 1.05fr) minmax(320px, 0.95fr)',
              gap: 48,
              alignItems: 'center',
              width: '100%',
              maxWidth: 1380,
              margin: '0 auto',
            }}
          >
            {/* Left Content Column */}
            <div style={{ display: 'flex', flexDirection: 'column', zIndex: 10 }}>
              {/* Telemetry Status Pill */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(5, 18, 36, 0.75)',
                  border: '1px solid rgba(0, 212, 255, 0.28)',
                  borderRadius: 20,
                  padding: '5px 14px',
                  width: 'fit-content',
                  marginBottom: 24,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span
                  className="status-dot-pulse"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: healthStatus === 'nominal' ? '#00ff88' : '#ff9f0a',
                    boxShadow: healthStatus === 'nominal' ? '0 0 8px #00ff88' : '0 0 8px #ff9f0a',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 10,
                    letterSpacing: '0.16em',
                    color: 'rgba(255, 255, 255, 0.85)',
                    textTransform: 'uppercase',
                  }}
                >
                  SYSTEM STATUS: {healthStatus.toUpperCase()} • ORBITAL SENSORS ONLINE
                </span>
              </div>

              {/* Exact Requested Title */}
              <h1
                style={{
                  margin: '0 0 8px 0',
                  fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                  fontSize: 'clamp(44px, 5.2vw, 82px)',
                  fontWeight: 800,
                  lineHeight: 1.0,
                  letterSpacing: '-0.02em',
                  color: '#ffffff',
                }}
              >
                VYOM
              </h1>

              {/* Exact Requested Subtitle */}
              <h2
                style={{
                  margin: '0 0 20px 0',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 'clamp(14px, 1.45vw, 20px)',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  color: '#00d4ff',
                  lineHeight: 1.35,
                }}
              >
                Satellite Health Monitor and Anomaly Detection
              </h2>

              {/* Exact Requested Description */}
              <p
                style={{
                  margin: '0 0 32px 0',
                  fontFamily: 'var(--font-body, "Inter", sans-serif)',
                  fontSize: 'clamp(14px, 1.1vw, 16px)',
                  lineHeight: 1.65,
                  color: 'rgba(225, 235, 250, 0.75)',
                  maxWidth: 580,
                  fontWeight: 300,
                }}
              >
                Monitor satellite health, analyze telemetry, detect anomalies, and investigate spacecraft subsystem behavior through an integrated satellite intelligence platform.
              </p>

              {/* Two Primary Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                  marginBottom: 36,
                }}
              >
                <button
                  onClick={handleLaunchMissionControl}
                  className="vyom-btn-primary"
                >
                  <span>⬡</span>
                  <span>Launch Mission Control</span>
                </button>

                <button
                  onClick={scrollToCapabilities}
                  className="vyom-btn-secondary"
                >
                  <span>Explore Capabilities</span>
                  <span>↓</span>
                </button>
              </div>

              {/* Compact Supported Status Indicators */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 12,
                  padding: '16px 20px',
                  background: 'rgba(4, 12, 26, 0.65)',
                  border: '1px solid rgba(0, 212, 255, 0.16)',
                  borderRadius: 6,
                  backdropFilter: 'blur(10px)',
                  maxWidth: 580,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      color: 'rgba(255, 255, 255, 0.45)',
                      textTransform: 'uppercase',
                      marginBottom: 3,
                    }}
                  >
                    ORBIT ALTITUDE
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#00d4ff',
                    }}
                  >
                    {altitude}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      color: 'rgba(255, 255, 255, 0.45)',
                      textTransform: 'uppercase',
                      marginBottom: 3,
                    }}
                  >
                    RF DOWNLINK
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#00ff88',
                    }}
                  >
                    {signal}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      color: 'rgba(255, 255, 255, 0.45)',
                      textTransform: 'uppercase',
                      marginBottom: 3,
                    }}
                  >
                    ANOMALY SENSORS
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#f0f4fc',
                    }}
                  >
                    ACTIVE (0 CRIT)
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Interactive 3D Earth Globe */}
            <div
              className="vyom-globe-container"
              style={{
                position: 'relative',
                width: '100%',
                height: 'min(580px, 68vh)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#020409',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid rgba(0, 212, 255, 0.12)',
              }}
            >
              {/* Subtle aerospace viewport corner reticles */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              >
                {/* Top Left */}
                <div style={{ position: 'absolute', top: 12, left: 12, width: 14, height: 14, borderTop: '1px solid rgba(0, 212, 255, 0.4)', borderLeft: '1px solid rgba(0, 212, 255, 0.4)' }} />
                {/* Top Right */}
                <div style={{ position: 'absolute', top: 12, right: 12, width: 14, height: 14, borderTop: '1px solid rgba(0, 212, 255, 0.4)', borderRight: '1px solid rgba(0, 212, 255, 0.4)' }} />
                {/* Bottom Left */}
                <div style={{ position: 'absolute', bottom: 12, left: 12, width: 14, height: 14, borderBottom: '1px solid rgba(0, 212, 255, 0.4)', borderLeft: '1px solid rgba(0, 212, 255, 0.4)' }} />
                {/* Bottom Right */}
                <div style={{ position: 'absolute', bottom: 12, right: 12, width: 14, height: 14, borderBottom: '1px solid rgba(0, 212, 255, 0.4)', borderRight: '1px solid rgba(0, 212, 255, 0.4)' }} />

                {/* Aerospace telemetry badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    right: 20,
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    color: 'rgba(0, 212, 255, 0.7)',
                    textTransform: 'uppercase',
                  }}
                >
                  LIVE ORBITAL VIEW • LEO TRACK
                </div>

                {/* Subtle rotation hint */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 9,
                    letterSpacing: '0.16em',
                    color: 'rgba(255, 255, 255, 0.45)',
                    textTransform: 'uppercase',
                    background: 'rgba(2, 4, 9, 0.75)',
                    padding: '3px 10px',
                    borderRadius: 3,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  DRAG TO ROTATE • PINCH / SCROLL TO ZOOM
                </div>
              </div>

              {/* 3D Earth Component */}
              <EarthScene />
            </div>
          </div>
        </section>

        {/* ==============================================================
            CAPABILITIES SECTION: Compact 3-Card Technical Layout
            ============================================================== */}
        <section
          id="capabilities"
          style={{
            padding: '64px clamp(20px, 4.5vw, 64px) 80px',
            background: 'linear-gradient(180deg, #020409 0%, #050d18 50%, #020409 100%)',
            borderTop: '1px solid rgba(0, 212, 255, 0.12)',
            position: 'relative',
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
            }}
          >
            {/* Capabilities Header */}
            <div style={{ marginBottom: 40, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  color: '#00d4ff',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                <span>◈</span>
                <span>CORE CAPABILITIES</span>
              </div>
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                  fontSize: 'clamp(26px, 2.8vw, 38px)',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '-0.01em',
                }}
              >
                Integrated Spacecraft Intelligence
              </h2>
            </div>

            {/* Three Compact Feature Cards */}
            <div
              className="vyom-capabilities-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 24,
              }}
            >
              {/* Card 1: Satellite Health Monitoring */}
              <div className="capability-card">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    background: 'rgba(0, 212, 255, 0.1)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#00d4ff',
                    fontSize: 18,
                    marginBottom: 20,
                  }}
                >
                  ≋
                </div>
                <h3
                  style={{
                    margin: '0 0 10px 0',
                    fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#ffffff',
                  }}
                >
                  Satellite Health Monitoring
                </h3>
                <p
                  style={{
                    margin: '0 0 20px 0',
                    fontFamily: 'var(--font-body, "Inter", sans-serif)',
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: 'rgba(255, 255, 255, 0.65)',
                    flex: 1,
                  }}
                >
                  Monitor spacecraft telemetry and subsystem conditions. Track real-time power bus states, thermal margins, orbital parameters, and RF link budgets.
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 16,
                  }}
                >
                  {['EPS Power', 'TCS Thermal', 'ADCS Guidance', 'Comm Bus'].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        color: 'rgba(0, 212, 255, 0.85)',
                        background: 'rgba(0, 212, 255, 0.08)',
                        padding: '3px 8px',
                        borderRadius: 3,
                        border: '1px solid rgba(0, 212, 255, 0.15)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={handleLaunchMissionControl}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#00d4ff',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    textAlign: 'left',
                  }}
                >
                  <span>OPEN TELEMETRY MONITOR</span>
                  <span>→</span>
                </button>
              </div>

              {/* Card 2: Anomaly Detection */}
              <div className="capability-card">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    background: 'rgba(255, 140, 0, 0.1)',
                    border: '1px solid rgba(255, 140, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ff8c00',
                    fontSize: 18,
                    marginBottom: 20,
                  }}
                >
                  ⚡
                </div>
                <h3
                  style={{
                    margin: '0 0 10px 0',
                    fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#ffffff',
                  }}
                >
                  Anomaly Detection
                </h3>
                <p
                  style={{
                    margin: '0 0 20px 0',
                    fontFamily: 'var(--font-body, "Inter", sans-serif)',
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: 'rgba(255, 255, 255, 0.65)',
                    flex: 1,
                  }}
                >
                  Identify abnormal telemetry and investigate threshold violations. Detect sensor drift, solar flare radiation events, battery decay, and orbital perturbations.
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 16,
                  }}
                >
                  {['Threshold Scoring', 'Sensor Faults', 'Radiation Events', 'Danger Sim'].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        color: 'rgba(255, 140, 0, 0.9)',
                        background: 'rgba(255, 140, 0, 0.08)',
                        padding: '3px 8px',
                        borderRadius: 3,
                        border: '1px solid rgba(255, 140, 0, 0.18)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => {
                    handleLaunchMissionControl();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#ff8c00',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    textAlign: 'left',
                  }}
                >
                  <span>INVESTIGATE ANOMALIES</span>
                  <span>→</span>
                </button>
              </div>

              {/* Card 3: Mission Intelligence */}
              <div className="capability-card">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    background: 'rgba(155, 93, 229, 0.1)',
                    border: '1px solid rgba(155, 93, 229, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9b5de5',
                    fontSize: 18,
                    marginBottom: 20,
                  }}
                >
                  ◈
                </div>
                <h3
                  style={{
                    margin: '0 0 10px 0',
                    fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#ffffff',
                  }}
                >
                  Mission Intelligence
                </h3>
                <p
                  style={{
                    margin: '0 0 20px 0',
                    fontFamily: 'var(--font-body, "Inter", sans-serif)',
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: 'rgba(255, 255, 255, 0.65)',
                    flex: 1,
                  }}
                >
                  Review telemetry evidence, diagnostics, and mission events. Analyze root causes with black box audit records, AI-driven failure prediction, and digital twin state sync.
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 16,
                  }}
                >
                  {['Black Box Log', 'Digital Twin', 'AI Diagnostics', 'Event Timeline'].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        color: 'rgba(155, 93, 229, 0.9)',
                        background: 'rgba(155, 93, 229, 0.08)',
                        padding: '3px 8px',
                        borderRadius: 3,
                        border: '1px solid rgba(155, 93, 229, 0.18)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={handleLaunchMissionControl}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#9b5de5',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    textAlign: 'left',
                  }}
                >
                  <span>VIEW INTELLIGENCE SUITE</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Minimal Aerospace Footer ── */}
      <footer
        role="contentinfo"
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '24px clamp(20px, 4.5vw, 64px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          background: '#010307',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: '#ffffff',
            }}
          >
            VYOM
          </span>
          <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              color: 'rgba(255, 255, 255, 0.45)',
              letterSpacing: '0.08em',
            }}
          >
            SATELLITE HEALTH MONITOR & ANOMALY DETECTION
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            onClick={handleLaunchMissionControl}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(0, 212, 255, 0.8)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              cursor: 'pointer',
              letterSpacing: '0.1em',
            }}
          >
            LAUNCH MISSION CONTROL
          </button>
          <button
            onClick={scrollToCapabilities}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              cursor: 'pointer',
              letterSpacing: '0.1em',
            }}
          >
            CAPABILITIES
          </button>
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 9.5,
              color: 'rgba(255, 255, 255, 0.3)',
            }}
          >
            v2.4 AEROSPACE SPEC
          </span>
        </div>
      </footer>
    </div>
  );
}
