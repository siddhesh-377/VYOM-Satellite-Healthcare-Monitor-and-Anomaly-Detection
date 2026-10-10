import { useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { DynamicSpacecraftModel, resolveSpacecraftModelType } from '../three/DynamicSpacecraftModel';
import { StarField } from '../three/SpaceScene';
import { threatEngine } from '../../engines/ThreatEngine';
import { backendWS, injectFaultViaBackend } from '../../services/BackendWebSocketService';
import { WhatIfComparison } from '../three/WhatIfComparison';
import { stopAndResetSimulation } from '../../engines/SimulationEngine';
import { anomalyPipeline, ExplainableAnomaly } from '../../engines/AnomalyPipelineEngine';
import { TelemetryAnomalyGraph } from '../danger/TelemetryAnomalyGraph';
import { AnomalyEvidencePanel } from '../danger/AnomalyEvidencePanel';
import { AnomalyTimelineLog } from '../danger/AnomalyTimelineLog';
import { VyomAIAnomalyExplainer } from '../danger/VyomAIAnomalyExplainer';

const THREATS = [
  {
    id: 'thermal-failure',
    name: 'THERMAL EVENT',
    icon: '🌡',
    description: 'Extreme thermal excursion — payload cooling failure, temperature thresholds exceeded.',
    severity: 'critical' as const,
    affectedSubsystem: 'Cryogenic Radiators & Heat Shield (TCS)',
    effects: { thermal: 8 },
    color: '#ff8c00',
    primaryParamId: 'cpuTempC',
  },
  {
    id: 'power-failure',
    name: 'POWER FAILURE',
    icon: '⚡',
    description: 'Solar panel degradation — battery drain, emergency load shedding required.',
    severity: 'critical' as const,
    affectedSubsystem: 'Electrical Power (EPS / Solar Arrays)',
    effects: { power: 7 },
    color: '#ff2d55',
    primaryParamId: 'busVoltageV',
  },
  {
    id: 'communication-failure',
    name: 'COMM FAILURE',
    icon: '📡',
    description: 'Communication blackout — antenna fault or severe signal interference.',
    severity: 'warning' as const,
    affectedSubsystem: 'High-Gain Antenna (HGA/RF Transponder)',
    effects: { comms: 9 },
    color: '#9b5de5',
    primaryParamId: 'rfDownlinkDb',
  },
  {
    id: 'attitude-failure',
    name: 'ATTITUDE ERROR',
    icon: '🎯',
    description: 'Attitude control system anomaly — spacecraft tumbling, solar panel misalignment.',
    severity: 'warning' as const,
    affectedSubsystem: 'Reaction Wheels & Star Trackers (ADCS)',
    effects: { attitude: 8 },
    color: '#ff8c00',
    primaryParamId: 'reactionWheelRpm',
  },
  {
    id: 'solar-storm',
    name: 'SOLAR STORM',
    icon: '☀',
    description: 'Intense solar particle event — radiation spike, communication interference, thermal increase.',
    severity: 'critical' as const,
    affectedSubsystem: 'Thermal & Power (TCS/EPS)',
    effects: { radiation: 8, solar: 6, thermal: 5 },
    color: '#ff8c00',
    primaryParamId: 'solarArrayCurrentA',
  },
  {
    id: 'asteroid',
    name: 'ASTEROID IMPACT',
    icon: '☄',
    description: 'Near-miss asteroid debris — microimpact damage to outer panels, attitude disturbance.',
    severity: 'critical' as const,
    affectedSubsystem: 'Structural & ADCS Gyros',
    effects: { asteroid: 4 },
    color: '#ff2d55',
    primaryParamId: 'slewRateDegS',
  },
  {
    id: 'debris',
    name: 'SPACE DEBRIS',
    icon: '⚙',
    description: 'High-density debris field — evasive maneuvers required, fuel consumption elevated.',
    severity: 'warning' as const,
    affectedSubsystem: 'Propulsion (OMS) & Shielding',
    effects: { debris: 5 },
    color: '#ff8c00',
    primaryParamId: 'payloadTempC',
  },
];

export function ScenariosScreen() {
  const activeThreats = useMissionStore((s) => s.activeThreats);
  const satellite = useMissionStore((s) => s.satellite);
  const blackBox = useMissionStore((s) => s.blackBox);
  const setScreen = useMissionStore((s) => s.setScreen);
  const incidents = useMissionStore((s) => s.incidents);

  const [triggered, setTriggered] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'anomaly_detection' | 'what_if_blackbox'>('anomaly_detection');

  // Anomaly Pipeline State
  const [anomalies, setAnomalies] = useState<ExplainableAnomaly[]>([]);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const [selectedParamId, setSelectedParamId] = useState<string>('cpuTempC');

  // Subscribe to AnomalyPipeline updates
  useEffect(() => {
    const unsub = anomalyPipeline.subscribe((list) => {
      setAnomalies([...list]);
      // If no anomaly selected or previous anomaly resolved, pick latest active
      if (list.length > 0) {
        setSelectedAnomalyId((prev) => {
          if (!prev) return list[list.length - 1].id;
          const stillExists = list.find((a) => a.id === prev);
          return stillExists ? prev : list[list.length - 1].id;
        });
      }
    });
    return unsub;
  }, []);

  const selectedAnomaly = useMemo(() => {
    if (!selectedAnomalyId && anomalies.length > 0) return anomalies[anomalies.length - 1];
    return anomalies.find((a) => a.id === selectedAnomalyId) || anomalies[anomalies.length - 1] || null;
  }, [selectedAnomalyId, anomalies]);

  // Keep selectedParamId aligned with selected anomaly if changed
  useEffect(() => {
    if (selectedAnomaly) {
      setSelectedParamId(selectedAnomaly.parameterId);
    }
  }, [selectedAnomaly?.id]);

  const handleTrigger = async (threat: typeof THREATS[0]) => {
    if (activeThreats.length > 0) return;
    setTriggered(threat.id);
    setSelectedParamId(threat.primaryParamId);

    const store = useMissionStore.getState();
    let injected = false;
    if (backendWS.isConnected && store.config?.id) {
      injected = await injectFaultViaBackend(store.config.id, threat.id);
    }
    if (!injected) {
      threatEngine.triggerThreat(
        threat.id,
        threat.name,
        threat.description,
        threat.effects
      );
    }
    setTimeout(() => setTriggered(null), 3000);
  };

  const handleStopReset = useCallback(() => {
    stopAndResetSimulation();
    anomalyPipeline.reset();
  }, []);

  const handleInitiateRecovery = useCallback(() => {
    if (activeThreats.length > 0) {
      activeThreats.forEach((t) => threatEngine.mitigateThreat(t.id));
    }
    anomalyPipeline.initiateRecovery();
  }, [activeThreats]);

  const activeThreatData = activeThreats[0]
    ? THREATS.find((t) => t.id === activeThreats[0].type || t.id === activeThreats[0].id)
    : null;

  const recentEvents = blackBox.slice(-6).reverse();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#020409',
        paddingBottom: 56,
        overflow: 'hidden',
        color: '#fff',
      }}
    >
      {/* ─── LEFT: Interactive 3D Spacecraft Scenario Twin (28%) ─── */}
      <div
        style={{
          flex: '0 0 28%',
          position: 'relative',
          borderRight: '1px solid rgba(0, 212, 255, 0.15)',
          background: '#020409',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <Canvas gl={{ antialias: true }} dpr={[1, 1.5]}>
            <PerspectiveCamera makeDefault position={[0, 0.5, 3.8]} fov={45} />
            <ambientLight intensity={activeThreats.length > 0 ? 0.15 : 0.3} />
            <directionalLight
              position={[3, 3, 3]}
              intensity={activeThreats.length > 0 ? 0.7 : 1.2}
              color={
                activeThreats.some((t) => t.type === 'solar-storm' || t.id === 'solar-storm')
                  ? '#ff8c00'
                  : '#fff5e8'
              }
            />
            <directionalLight position={[-3, -2, -3]} intensity={0.4} color="#00e5ff" />
            <StarField />
            <DynamicSpacecraftModel
              modelType={resolveSpacecraftModelType(satellite?.type, useMissionStore.getState().config?.type)}
              scale={1.25}
              interactive={true}
              activeThreatOverride={hoveredId || (activeThreats[0]?.type || activeThreats[0]?.id)}
            />
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              autoRotate
              autoRotateSpeed={activeThreats.length > 0 ? 1.5 : 0.4}
            />
          </Canvas>

          {/* Threat / Status Top Banner */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              right: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(5, 14, 30, 0.88)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${activeThreats.length > 0 ? '#ff2d55' : 'rgba(0, 212, 255, 0.25)'}`,
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 8,
                  color: activeThreats.length > 0 ? '#ff2d55' : '#00d4ff',
                  letterSpacing: '0.15em',
                  fontWeight: 700,
                }}
              >
                {activeThreats.length > 0 ? '⚠ DIGITAL TWIN UNDER STRESS' : 'DIGITAL TWIN NOMINAL'}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body, sans-serif)',
                  fontSize: 10.5,
                  color: '#fff',
                  marginTop: 2,
                }}
              >
                {activeThreatData
                  ? `Target: ${activeThreatData.affectedSubsystem}`
                  : 'All Subsystems Within Flight Bounds'}
              </div>
            </div>
            {activeThreats.length > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleInitiateRecovery}
                  style={{
                    background: 'rgba(0, 255, 136, 0.2)',
                    border: '1px solid #00ff88',
                    borderRadius: 4,
                    padding: '4px 8px',
                    color: '#00ff88',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 8.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Engage autonomous recovery and stabilization verification"
                >
                  ⚡ RECOVER
                </button>
                <button
                  onClick={handleStopReset}
                  style={{
                    background: 'rgba(255, 45, 85, 0.2)',
                    border: '1px solid #ff2d55',
                    borderRadius: 4,
                    padding: '4px 8px',
                    color: '#ff2d55',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 8.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Stop scenario and restore baseline"
                >
                  ⏹ STOP SIM
                </button>
              </div>
            )}
          </div>

          {/* Subsystem Health Guide Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: 14,
              right: 14,
              background: 'rgba(2, 6, 14, 0.88)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: 'rgba(255,255,255,0.45)' }}>
                3D TELEMETRY MAPPING:
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 8.5,
                  color: activeThreats.length > 0 ? '#ff3b30' : '#00ff88',
                  fontWeight: 700,
                }}
              >
                {activeThreats.length > 0 ? 'ANOMALOUS SUBSYSTEM ACTIVATED' : 'SATELLITE HEALTH OK'}
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body, sans-serif)',
                fontSize: 9.5,
                color: 'rgba(255,255,255,0.65)',
                margin: 0,
                lineHeight: 1.35,
              }}
            >
              Visual highlights: <span style={{ color: '#ff3b30' }}>Thermal (Red)</span>,{' '}
              <span style={{ color: '#ff9f0a' }}>Power (Amber)</span>,{' '}
              <span style={{ color: '#bf5af2' }}>RF Comms (Purple)</span>,{' '}
              <span style={{ color: '#00d4ff' }}>ADCS (Cyan)</span>.
            </p>
          </div>
        </div>
      </div>

      {/* ─── RIGHT / CENTER: EXPLAINABLE ANOMALY INVESTIGATION WORKSPACE ─── */}
      <div
        style={{
          flex: '1 1 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Workspace Top Header & Navigation Tabs */}
        <div
          style={{
            padding: '10px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(5, 14, 30, 0.6)',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8.5,
                color: 'rgba(0, 212, 255, 0.7)',
                letterSpacing: '0.2em',
                marginBottom: 2,
              }}
            >
              MISSION SIMULATOR &amp; INVESTIGATION WORKFLOW
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display, sans-serif)',
                fontSize: 17,
                fontWeight: 700,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span>DANGER SIMULATOR · EXPLAINABLE ANOMALY DETECTION</span>
              {anomalies.filter((a) => a.status !== 'resolved').length > 0 && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 9,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(255, 45, 85, 0.2)',
                    border: '1px solid #ff2d55',
                    color: '#ff2d55',
                    fontWeight: 700,
                  }}
                >
                  ⚠ {anomalies.filter((a) => a.status !== 'resolved').length} ACTIVE ANOMALIES
                </span>
              )}
            </div>
          </div>

          {/* Navigation Mode Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setActiveTab('anomaly_detection')}
              style={{
                background:
                  activeTab === 'anomaly_detection' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${activeTab === 'anomaly_detection' ? '#00d4ff' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: 6,
                padding: '6px 12px',
                color: activeTab === 'anomaly_detection' ? '#00d4ff' : 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ANOMALY PIPELINE &amp; TELEMETRY
            </button>
            <button
              onClick={() => setActiveTab('what_if_blackbox')}
              style={{
                background:
                  activeTab === 'what_if_blackbox' ? 'rgba(155, 93, 229, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${activeTab === 'what_if_blackbox' ? '#9b5de5' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: 6,
                padding: '6px 12px',
                color: activeTab === 'what_if_blackbox' ? '#9b5de5' : 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              MISSION WHAT-IF &amp; METRICS
            </button>
            {activeThreats.length > 0 && (
              <button
                onClick={handleStopReset}
                style={{
                  background: 'rgba(255, 45, 85, 0.15)',
                  border: '1px solid #ff2d55',
                  borderRadius: 6,
                  padding: '6px 12px',
                  color: '#ff2d55',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 9,
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginLeft: 8,
                }}
              >
                ⏹ STOP SIM
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Explainable Anomaly Detection, Live Graphs, and Root Cause */}
        {activeTab === 'anomaly_detection' ? (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* ── Top Row: Scenario Trigger Cards ── */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 8.5,
                    letterSpacing: '0.15em',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  INJECT SIMULATED FAULT SCENARIO (MULTI-SUBSYSTEM DANGER SIMULATOR):
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 8,
                    color: 'rgba(0, 212, 255, 0.7)',
                  }}
                >
                  Independent evaluation: Detector evaluates telemetry thresholds and trends automatically
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 8,
                }}
              >
                {THREATS.map((threat) => {
                  const isActive = activeThreats.some((t) => t.type === threat.id || t.id === threat.id);
                  const isTriggering = triggered === threat.id;
                  const disabled = activeThreats.length > 0 && !isActive;

                  return (
                    <motion.div
                      key={threat.id}
                      whileHover={!disabled && !isActive ? { scale: 1.02, y: -2 } : {}}
                      onClick={() => !disabled && !isActive && handleTrigger(threat)}
                      onMouseEnter={() => setHoveredId(threat.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        padding: '10px 8px',
                        background: isActive
                          ? `rgba(${
                              threat.color === '#ff2d55'
                                ? '255,45,85'
                                : threat.color === '#ff8c00'
                                ? '255,140,0'
                                : '155,93,229'
                            }, 0.15)`
                          : 'rgba(5, 14, 30, 0.65)',
                        border: `1px solid ${isActive ? threat.color : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 6,
                        cursor: disabled ? 'not-allowed' : isActive ? 'default' : 'pointer',
                        opacity: disabled ? 0.35 : 1,
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 16, marginBottom: 4 }}>{threat.icon}</div>
                        <div
                          style={{
                            fontFamily: 'var(--font-display, sans-serif)',
                            fontSize: 10,
                            fontWeight: 700,
                            color: isActive ? threat.color : '#fff',
                            letterSpacing: '0.04em',
                            marginBottom: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {threat.name}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: 7.5,
                            color: 'rgba(255,255,255,0.4)',
                            lineHeight: 1.25,
                            marginBottom: 6,
                            height: 26,
                            overflow: 'hidden',
                          }}
                        >
                          {threat.description}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '3px 0',
                          background: isActive
                            ? threat.color
                            : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${isActive ? threat.color : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: 4,
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: 7.5,
                          color: isActive ? '#000' : threat.color,
                          textAlign: 'center',
                          fontWeight: 700,
                        }}
                      >
                        {isActive ? 'ACTIVE' : isTriggering ? 'ARMING...' : 'TRIGGER'}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* ── Middle Row: Live Telemetry Graph & Evidence Panel (Split 50/50) ── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: 12,
                minHeight: 380,
              }}
            >
              {/* Telemetry Graph with threshold lines and detection markers */}
              <div style={{ minWidth: 0, height: '100%' }}>
                <TelemetryAnomalyGraph
                  selectedParamId={selectedParamId}
                  onSelectParamId={setSelectedParamId}
                  activeAnomaly={selectedAnomaly || undefined}
                />
              </div>

              {/* Anomaly Detection & Evidence Panel */}
              <div style={{ minWidth: 0, height: '100%', overflowY: 'auto' }}>
                <AnomalyEvidencePanel
                  anomaly={selectedAnomaly || undefined}
                  onInitiateRecovery={handleInitiateRecovery}
                  onAskAI={() => setActiveTab('anomaly_detection')}
                />
              </div>
            </div>

            {/* ── Bottom Row: Anomaly Timeline Log & Vyom AI Explainer (Split 50/50) ── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                minHeight: 320,
              }}
            >
              {/* 10-Stage Progression Timeline Log */}
              <div style={{ minWidth: 0, height: '100%' }}>
                <AnomalyTimelineLog
                  anomaly={selectedAnomaly || undefined}
                  allAnomalies={anomalies}
                  onSelectAnomaly={(a) => {
                    setSelectedAnomalyId(a.id);
                    setSelectedParamId(a.parameterId);
                  }}
                />
              </div>

              {/* Vyom AI Anomaly Explainer with Deterministic Fallback */}
              <div style={{ minWidth: 0, height: '100%' }}>
                <VyomAIAnomalyExplainer
                  selectedAnomaly={selectedAnomaly || undefined}
                  onSelectParam={(paramId) => setSelectedParamId(paramId)}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: Mission What-If, Comparison, and Incident Logs */
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* AI vs Manual Performance Card */}
            <div
              style={{
                padding: '14px 18px',
                background: 'rgba(5, 14, 30, 0.75)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 9,
                  color: 'rgba(0,212,255,0.7)',
                  letterSpacing: '0.1em',
                  marginBottom: 10,
                }}
              >
                📊 AI GUARDIAN VS MANUAL OPERATOR RECOVERY BENCHMARK
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(0, 255, 136, 0.05)',
                    border: '1px solid rgba(0, 255, 136, 0.2)',
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 8,
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: 4,
                    }}
                  >
                    VYOM AI GUARDIAN AVG RESOLUTION
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display, sans-serif)',
                      fontSize: 20,
                      color: '#00ff88',
                      fontWeight: 700,
                    }}
                  >
                    {incidents.filter((i) => i.recovery_mode === 'ai' && i.total_resolution_ms).length > 0
                      ? (
                          incidents
                            .filter((i) => i.recovery_mode === 'ai' && i.total_resolution_ms)
                            .reduce((a, b) => a + (b.total_resolution_ms || 0), 0) /
                          incidents.filter((i) => i.recovery_mode === 'ai' && i.total_resolution_ms).length /
                          1000
                        ).toFixed(1) + 's'
                      : '3.4s (Nominal)'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 9.5, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    Autonomous detection pipeline + closed-loop mitigation verification.
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255, 140, 0, 0.05)',
                    border: '1px solid rgba(255, 140, 0, 0.2)',
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 8,
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: 4,
                    }}
                  >
                    MANUAL GROUND CONTROL AVG RESOLUTION
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display, sans-serif)',
                      fontSize: 20,
                      color: '#ff8c00',
                      fontWeight: 700,
                    }}
                  >
                    {incidents.filter((i) => i.recovery_mode === 'manual' && i.total_resolution_ms).length > 0
                      ? (
                          incidents
                            .filter((i) => i.recovery_mode === 'manual' && i.total_resolution_ms)
                            .reduce((a, b) => a + (b.total_resolution_ms || 0), 0) /
                          incidents.filter((i) => i.recovery_mode === 'manual' && i.total_resolution_ms).length /
                          1000
                        ).toFixed(1) + 's'
                      : '48.2s (Ground Station Uplink Latency)'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 9.5, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    Ground telemetry pass evaluation, flight director verification, and manual command queuing.
                  </div>
                </div>
              </div>
            </div>

            {/* WhatIf Comparison Component */}
            <div
              style={{
                padding: '14px 18px',
                background: 'rgba(5, 14, 30, 0.75)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
              }}
            >
              <WhatIfComparison />
            </div>

            {/* Black Box Event History */}
            <div
              style={{
                padding: '14px 18px',
                background: 'rgba(5, 14, 30, 0.75)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  color: 'rgba(255,255,255,0.4)',
                  marginBottom: 8,
                }}
              >
                RECORDED BLACK BOX TELEMETRY EVENTS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                <AnimatePresence>
                  {recentEvents.map((ev, idx) => (
                    <motion.div
                      key={`${ev.id || 'ev'}-${idx}`}
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(0,0,0,0.3)',
                        borderLeft: `3px solid ${
                          ev.severity === 'critical'
                            ? '#ff2d55'
                            : ev.severity === 'warning'
                            ? '#ff9500'
                            : '#00ff88'
                        }`,
                        borderRadius: '0 6px 6px 0',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: 7.5,
                          color: 'rgba(255,255,255,0.35)',
                          marginBottom: 2,
                        }}
                      >
                        DAY {Math.floor(ev.missionDay)} · {ev.eventType.toUpperCase()} · {ev.source}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-body, sans-serif)',
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.8)',
                          lineHeight: 1.35,
                        }}
                      >
                        {ev.description}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {recentEvents.length === 0 && (
                  <div
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.25)',
                      padding: 14,
                      textAlign: 'center',
                    }}
                  >
                    No black box events logged yet — trigger a scenario to observe flight recorder logging.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
