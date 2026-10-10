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
    description: 'Extreme thermal excursion — payload cooling failure, radiator temperature thresholds exceeded.',
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
    description: 'Solar panel degradation — battery DoD threshold crossed, bus voltage drop.',
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
    description: 'Communication blackout — high-gain antenna pointing loss or RF transponder attenuation.',
    severity: 'warning' as const,
    affectedSubsystem: 'High-Gain Antenna (HGA / RF Transponder)',
    effects: { comms: 9 },
    color: '#9b5de5',
    primaryParamId: 'rfDownlinkDb',
  },
  {
    id: 'attitude-failure',
    name: 'ATTITUDE ERROR',
    icon: '🎯',
    description: 'Attitude control anomaly — reaction wheel saturation, body tumbling, solar panel misalignment.',
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
    description: 'Intense coronal mass ejection — radiation dose surge, solar array current spike.',
    severity: 'critical' as const,
    affectedSubsystem: 'Thermal & Power (TCS / EPS)',
    effects: { radiation: 8, solar: 6, thermal: 5 },
    color: '#ff8c00',
    primaryParamId: 'solarArrayCurrentA',
  },
  {
    id: 'asteroid',
    name: 'ASTEROID IMPACT',
    icon: '☄',
    description: 'Micrometeoroid debris strike — structural shock, gyro slew rate excursion, panel puncture.',
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
    description: 'High-density orbital debris threat — collision avoidance maneuver, elevated fuel and thermal loop.',
    severity: 'warning' as const,
    affectedSubsystem: 'Propulsion (OMS) & Whipple Shielding',
    effects: { debris: 5 },
    color: '#ff8c00',
    primaryParamId: 'payloadTempC',
  },
];

type DrawerTab = 'overview' | 'evidence' | 'detection' | 'timeline' | 'ai' | 'what_if';

export function ScenariosScreen() {
  const activeThreats = useMissionStore((s) => s.activeThreats);
  const satellite = useMissionStore((s) => s.satellite);
  const blackBox = useMissionStore((s) => s.blackBox);

  const [triggered, setTriggered] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Anomaly Pipeline State
  const [anomalies, setAnomalies] = useState<ExplainableAnomaly[]>([]);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const [selectedParamId, setSelectedParamId] = useState<string>('cpuTempC');

  // Detail Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');
  const [inspectedThreat, setInspectedThreat] = useState<typeof THREATS[0] | null>(null);

  // Subscribe to AnomalyPipeline updates
  useEffect(() => {
    const unsub = anomalyPipeline.subscribe((list) => {
      setAnomalies([...list]);
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

  const handleTrigger = async (threat: typeof THREATS[0], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (activeThreats.length > 0) return;
    setTriggered(threat.id);
    setSelectedParamId(threat.primaryParamId);
    setInspectedThreat(threat);

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

  const handleOpenThreatDetails = (threat: typeof THREATS[0], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInspectedThreat(threat);
    setSelectedParamId(threat.primaryParamId);
    setDrawerTab('overview');
    setDrawerOpen(true);
  };

  const handleOpenDrawerTab = (tab: DrawerTab) => {
    setDrawerTab(tab);
    setDrawerOpen(true);
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

  const recentEvents = blackBox.slice(-3).reverse();
  const activeAnomalyCount = anomalies.filter((a) => a.status !== 'resolved').length;
  const isHealthy = activeThreats.length === 0 && activeAnomalyCount === 0;

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
        position: 'relative',
      }}
    >
      {/* ─── LEFT: Interactive 3D Spacecraft Scenario Twin (27%) ─── */}
      <div
        style={{
          flex: '0 0 27%',
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

          {/* Digital Twin Status Header */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              right: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(5, 14, 30, 0.9)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${activeThreats.length > 0 ? '#ff2d55' : 'rgba(0, 212, 255, 0.25)'}`,
              borderRadius: 6,
              padding: '6px 10px',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 7.5,
                  color: activeThreats.length > 0 ? '#ff2d55' : '#00d4ff',
                  letterSpacing: '0.12em',
                  fontWeight: 700,
                }}
              >
                {activeThreats.length > 0 ? '⚠ TWIN UNDER STRESS' : 'TWIN NOMINAL'}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body, sans-serif)',
                  fontSize: 9.5,
                  color: '#fff',
                  marginTop: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 150,
                }}
              >
                {activeThreatData ? activeThreatData.name : 'All Subsystems OK'}
              </div>
            </div>
            {activeThreats.length > 0 && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={handleInitiateRecovery}
                  style={{
                    background: 'rgba(0, 255, 136, 0.2)',
                    border: '1px solid #00ff88',
                    borderRadius: 4,
                    padding: '3px 6px',
                    color: '#00ff88',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 8,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Initiate autonomous recovery"
                >
                  RECOVER
                </button>
                <button
                  onClick={handleStopReset}
                  style={{
                    background: 'rgba(255, 45, 85, 0.2)',
                    border: '1px solid #ff2d55',
                    borderRadius: 4,
                    padding: '3px 6px',
                    color: '#ff2d55',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 8,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Reset simulation"
                >
                  RESET
                </button>
              </div>
            )}
          </div>

          {/* Subsystem Color Legend */}
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              right: 10,
              background: 'rgba(2, 6, 14, 0.88)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 8.5,
              fontFamily: 'var(--font-mono, monospace)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: '#ff3b30' }}>● Thermal</span>
            <span style={{ color: '#ff9f0a' }}>● Power</span>
            <span style={{ color: '#bf5af2' }}>● Comms</span>
            <span style={{ color: '#00d4ff' }}>● ADCS</span>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: COMPACT WORKSPACE WITH ALL 7 DANGER CARDS ─── */}
      <div
        style={{
          flex: '1 1 0',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          minWidth: 0,
          padding: '10px 14px',
          gap: 10,
        }}
      >
        {/* ─── A. COMPACT PAGE HEADER ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(5, 14, 30, 0.75)',
            border: '1px solid rgba(0, 212, 255, 0.15)',
            borderRadius: 6,
            padding: '6px 12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontFamily: 'var(--font-display, sans-serif)',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '0.04em',
              }}
            >
              DANGER SIMULATOR · ANOMALY DETECTION
            </span>

            {/* Active Anomaly Count Badge */}
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8.5,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 4,
                background:
                  activeAnomalyCount > 0 ? 'rgba(255, 45, 85, 0.2)' : 'rgba(0, 255, 136, 0.15)',
                border: `1px solid ${activeAnomalyCount > 0 ? '#ff2d55' : '#00ff88'}`,
                color: activeAnomalyCount > 0 ? '#ff2d55' : '#00ff88',
              }}
            >
              {activeAnomalyCount > 0 ? `⚠ ${activeAnomalyCount} ACTIVE ANOMALY` : '0 ACTIVE ANOMALIES'}
            </span>

            {/* Overall Mission Health Indicator */}
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8.5,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 4,
                background: isHealthy ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 140, 0, 0.2)',
                border: `1px solid ${isHealthy ? '#00d4ff' : '#ff8c00'}`,
                color: isHealthy ? '#00d4ff' : '#ff8c00',
              }}
            >
              {isHealthy ? 'HEALTH: 100% NOMINAL' : 'HEALTH: DEGRADED'}
            </span>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {activeThreats.length > 0 && (
              <button
                onClick={handleInitiateRecovery}
                style={{
                  background: 'rgba(0, 255, 136, 0.2)',
                  border: '1px solid #00ff88',
                  borderRadius: 4,
                  padding: '3px 8px',
                  color: '#00ff88',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 8,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ⚡ RECOVER
              </button>
            )}
            <button
              onClick={handleStopReset}
              style={{
                background: 'rgba(255, 45, 85, 0.15)',
                border: '1px solid rgba(255, 45, 85, 0.4)',
                borderRadius: 4,
                padding: '3px 8px',
                color: '#ff2d55',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Stop simulation & restore nominal baseline"
            >
              ⏹ RESET
            </button>
          </div>
        </div>

        {/* ─── B. ALL SEVEN DANGER CARDS (HIGHEST PRIORITY) ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {THREATS.map((threat) => {
            const isActive = activeThreats.some((t) => t.type === threat.id || t.id === threat.id);
            const isTriggering = triggered === threat.id;
            const disabled = activeThreats.length > 0 && !isActive;

            return (
              <div
                key={threat.id}
                onClick={() => handleOpenThreatDetails(threat)}
                onMouseEnter={() => setHoveredId(threat.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  padding: '7px 8px',
                  background: isActive
                    ? 'rgba(255, 45, 85, 0.18)'
                    : 'rgba(5, 14, 30, 0.8)',
                  border: `1px solid ${isActive ? threat.color : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  opacity: disabled ? 0.45 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 74,
                  boxShadow: isActive ? `0 0 12px ${threat.color}44` : 'none',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                {/* Card Top: Icon, Name, and Info Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>{threat.icon}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 8.5,
                        fontWeight: 700,
                        color: isActive ? threat.color : '#fff',
                        letterSpacing: '0.03em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={`${threat.name} — Click to view details`}
                    >
                      {threat.name}
                    </span>
                  </div>
                  <span
                    onClick={(e) => handleOpenThreatDetails(threat, e)}
                    style={{
                      fontSize: 9,
                      color: 'rgba(0, 212, 255, 0.65)',
                      cursor: 'pointer',
                      padding: '0 2px',
                    }}
                    title="View technical scenario details"
                  >
                    ⓘ
                  </span>
                </div>

                {/* Status Indicator */}
                <div
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 7.5,
                    color: isActive ? threat.color : 'rgba(0, 212, 255, 0.6)',
                    fontWeight: isActive ? 700 : 400,
                    margin: '2px 0',
                  }}
                >
                  {isActive ? '● ACTIVE' : isTriggering ? 'ARMING...' : 'Ready'}
                </div>

                {/* Compact Trigger Button */}
                <button
                  disabled={disabled || isActive}
                  onClick={(e) => handleTrigger(threat, e)}
                  style={{
                    width: '100%',
                    padding: '3px 0',
                    background: isActive
                      ? threat.color
                      : isTriggering
                      ? 'rgba(255, 140, 0, 0.3)'
                      : 'rgba(0, 212, 255, 0.12)',
                    border: `1px solid ${isActive ? threat.color : 'rgba(0, 212, 255, 0.3)'}`,
                    borderRadius: 3,
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 7.5,
                    fontWeight: 700,
                    color: isActive ? '#000' : '#00d4ff',
                    cursor: disabled || isActive ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.05em',
                    transition: 'background 0.15s',
                  }}
                >
                  {isActive ? 'ACTIVE' : isTriggering ? 'ARMING' : 'TRIGGER'}
                </button>
              </div>
            );
          })}
        </div>

        {/* ─── C & D. MIDDLE ROW: COMPACT TELEMETRY GRAPH + MINIMAL ANOMALY SUMMARY ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 310px',
            gap: 10,
            flex: '1 0 auto',
            minHeight: 280,
          }}
        >
          {/* C. Compact Telemetry Graph */}
          <div
            style={{
              minWidth: 0,
              background: 'rgba(5, 14, 30, 0.65)',
              border: '1px solid rgba(0, 212, 255, 0.18)',
              borderRadius: 6,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <TelemetryAnomalyGraph
              selectedParamId={selectedParamId}
              onSelectParamId={setSelectedParamId}
              activeAnomaly={selectedAnomaly || undefined}
              onInspectCrossing={() => handleOpenDrawerTab('evidence')}
            />
          </div>

          {/* D. Minimal Anomaly Summary Panel */}
          <div
            style={{
              background: 'rgba(5, 14, 30, 0.75)',
              border: `1px solid ${selectedAnomaly ? '#ff2d55' : 'rgba(0, 212, 255, 0.2)'}`,
              borderRadius: 6,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minWidth: 0,
            }}
          >
            {selectedAnomaly ? (
              <>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 8,
                        color: 'rgba(255, 45, 85, 0.8)',
                        letterSpacing: '0.1em',
                        fontWeight: 700,
                      }}
                    >
                      ACTIVE ANOMALY SUMMARY
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 8,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background:
                          selectedAnomaly.severity === 'critical'
                            ? 'rgba(255, 45, 85, 0.2)'
                            : 'rgba(255, 149, 0, 0.2)',
                        border: `1px solid ${
                          selectedAnomaly.severity === 'critical' ? '#ff2d55' : '#ff9500'
                        }`,
                        color: selectedAnomaly.severity === 'critical' ? '#ff2d55' : '#ff9500',
                        fontWeight: 700,
                      }}
                    >
                      {selectedAnomaly.severity.toUpperCase()}
                    </span>
                  </div>

                  <div
                    style={{
                      fontFamily: 'var(--font-display, sans-serif)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#fff',
                      marginBottom: 8,
                      wordBreak: 'break-word',
                    }}
                  >
                    {selectedAnomaly.parameterName} Anomaly
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono, monospace)' }}>
                        Affected Subsystem:
                      </span>
                      <span style={{ color: '#00d4ff', fontWeight: 600 }}>
                        {selectedAnomaly.affectedSubsystem}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono, monospace)' }}>
                        Primary Signal:
                      </span>
                      <span style={{ color: '#fff', fontFamily: 'var(--font-mono, monospace)' }}>
                        {selectedAnomaly.parameterId}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono, monospace)' }}>
                        Current Value:
                      </span>
                      <span style={{ color: '#ff2d55', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
                        {selectedAnomaly.currentValue} {selectedAnomaly.unit}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono, monospace)' }}>
                        Baseline / Deviation:
                      </span>
                      <span style={{ color: '#ff9500', fontFamily: 'var(--font-mono, monospace)' }}>
                        {selectedAnomaly.baseline} ({selectedAnomaly.deviationPercent > 0 ? '+' : ''}
                        {selectedAnomaly.deviationPercent.toFixed(1)}%)
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono, monospace)' }}>
                        Detection Rule:
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-mono, monospace)', fontSize: 8 }}>
                        {selectedAnomaly.detectionMethod.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    onClick={() => handleOpenDrawerTab('evidence')}
                    style={{
                      width: '100%',
                      padding: '6px 0',
                      background: 'rgba(0, 212, 255, 0.15)',
                      border: '1px solid #00d4ff',
                      borderRadius: 4,
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 8.5,
                      fontWeight: 700,
                      color: '#00d4ff',
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                    }}
                  >
                    VIEW TECHNICAL DETAILS ➔
                  </button>
                  <button
                    onClick={handleInitiateRecovery}
                    style={{
                      width: '100%',
                      padding: '5px 0',
                      background: 'rgba(0, 255, 136, 0.15)',
                      border: '1px solid #00ff88',
                      borderRadius: 4,
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 8,
                      fontWeight: 700,
                      color: '#00ff88',
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ INITIATE AUTONOMOUS RECOVERY
                  </button>
                </div>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 24, opacity: 0.6 }}>🛡️</span>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9.5, color: '#00ff88', fontWeight: 700 }}>
                  ALL SYSTEMS NOMINAL
                </div>
                <p style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 9, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.4 }}>
                  Zero active threshold violations across 12 telemetry channels. Click TRIGGER on any danger scenario above to evaluate real-time anomaly detection.
                </p>
                <button
                  onClick={() => handleOpenDrawerTab('ai')}
                  style={{
                    marginTop: 6,
                    padding: '5px 12px',
                    background: 'rgba(0, 212, 255, 0.1)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: 4,
                    color: '#00d4ff',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 8,
                    cursor: 'pointer',
                  }}
                >
                  PRE-FLIGHT DIAGNOSTICS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── E. BOTTOM ROW: COMPACT EVENT LOG & VYOM AI ACTION BAR ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 10,
            flexShrink: 0,
            minHeight: 88,
          }}
        >
          {/* Compact Event Log */}
          <div
            style={{
              background: 'rgba(5, 14, 30, 0.75)',
              border: '1px solid rgba(0, 212, 255, 0.15)',
              borderRadius: 6,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                RECENT INCIDENT TIMELINE
              </span>
              <button
                onClick={() => handleOpenDrawerTab('timeline')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00d4ff',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 8,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                VIEW ALL EVENTS ({blackBox.length}) ➔
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {recentEvents.length > 0 ? (
                recentEvents.map((evt, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleOpenDrawerTab('timeline')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 8.5,
                      fontFamily: 'var(--font-mono, monospace)',
                      padding: '2px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour12: false })}
                      </span>
                      <span
                        style={{
                          color: evt.severity === 'critical' ? '#ff2d55' : evt.severity === 'warning' ? '#ff9500' : '#00d4ff',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 180,
                        }}
                      >
                        {evt.description}
                      </span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 7.5 }}>
                      {evt.source || evt.eventType.toUpperCase()}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8, fontFamily: 'var(--font-mono, monospace)' }}>
                  No telemetry anomalies recorded. System nominal.
                </div>
              )}
            </div>
          </div>

          {/* Compact Vyom AI Action Bar */}
          <div
            style={{
              background: 'rgba(5, 14, 30, 0.75)',
              border: '1px solid rgba(155, 93, 229, 0.3)',
              borderRadius: 6,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <div>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: '#9b5de5', fontWeight: 700 }}>
                  VYOM AI DIAGNOSTIC ENGINE
                </div>
                <div style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
                  Explainable root-cause &amp; mitigation reasoning ready.
                </div>
              </div>
            </div>

            <button
              onClick={() => handleOpenDrawerTab('ai')}
              style={{
                background: 'rgba(155, 93, 229, 0.2)',
                border: '1px solid #9b5de5',
                borderRadius: 4,
                padding: '6px 10px',
                color: '#fff',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8.5,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              ASK VYOM AI ➔
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. RIGHT-SIDE TECHNICAL DETAILS DRAWER ─── */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 56,
              width: 'min(560px, 92vw)',
              background: 'rgba(2, 6, 16, 0.96)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(0, 212, 255, 0.3)',
              boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 100,
              color: '#fff',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(5, 14, 30, 0.9)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: '#00d4ff', letterSpacing: '0.15em' }}>
                  TECHNICAL INVESTIGATION DOSSIER
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display, sans-serif)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {inspectedThreat ? inspectedThreat.name : selectedAnomaly ? `${selectedAnomaly.parameterName} Anomaly` : 'Telemetry Diagnostics'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {inspectedThreat && (
                  <button
                    onClick={() => handleTrigger(inspectedThreat)}
                    style={{
                      background: 'rgba(255, 45, 85, 0.2)',
                      border: '1px solid #ff2d55',
                      borderRadius: 4,
                      padding: '4px 8px',
                      color: '#ff2d55',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 8,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    TRIGGER FAULT
                  </button>
                )}
                <button
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 4,
                    color: '#fff',
                    padding: '4px 8px',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 9,
                    cursor: 'pointer',
                  }}
                >
                  ✕ CLOSE
                </button>
              </div>
            </div>

            {/* Drawer Tab Navigation */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(5, 14, 30, 0.7)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0 8px',
                overflowX: 'auto',
              }}
            >
              {(
                [
                  { id: 'overview', label: 'OVERVIEW' },
                  { id: 'evidence', label: 'EVIDENCE' },
                  { id: 'detection', label: 'DETECTION' },
                  { id: 'timeline', label: 'TIMELINE' },
                  { id: 'ai', label: 'VYOM AI' },
                  { id: 'what_if', label: 'WHAT-IF' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDrawerTab(tab.id)}
                  style={{
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    borderBottom: drawerTab === tab.id ? '2px solid #00d4ff' : '2px solid transparent',
                    color: drawerTab === tab.id ? '#00d4ff' : 'rgba(255, 255, 255, 0.6)',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 8.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Drawer Body (Scrollable independently) */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {/* TAB 1: OVERVIEW */}
              {drawerTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {inspectedThreat && (
                    <div
                      style={{
                        padding: '12px',
                        background: 'rgba(5, 14, 30, 0.8)',
                        border: `1px solid ${inspectedThreat.color}`,
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 20 }}>{inspectedThreat.icon}</span>
                        <div>
                          <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                            {inspectedThreat.name}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: inspectedThreat.color }}>
                            SEVERITY: {inspectedThreat.severity.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <p style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 10, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.45 }}>
                        {inspectedThreat.description}
                      </p>
                    </div>
                  )}

                  <div
                    style={{
                      padding: '12px',
                      background: 'rgba(5, 14, 30, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: '#00d4ff', marginBottom: 8 }}>
                      SUBSYSTEM SPECIFICATIONS
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 9 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(255,255,255,0.45)' }}>Target Hardware:</span>
                        <span style={{ color: '#fff' }}>
                          {inspectedThreat ? inspectedThreat.affectedSubsystem : selectedAnomaly?.affectedSubsystem || 'General Bus'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(255,255,255,0.45)' }}>Monitored Parameter:</span>
                        <span style={{ color: '#00d4ff', fontFamily: 'var(--font-mono, monospace)' }}>
                          {inspectedThreat ? inspectedThreat.primaryParamId : selectedAnomaly?.parameterId || selectedParamId}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(255,255,255,0.45)' }}>Failure Propagation:</span>
                        <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                          Cascading bus degradation modeled via 10Hz physics loop.
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedAnomaly && (
                    <div
                      style={{
                        padding: '12px',
                        background: 'rgba(5, 14, 30, 0.6)',
                        border: '1px solid rgba(0, 255, 136, 0.2)',
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: '#00ff88', marginBottom: 6 }}>
                        RECOMMENDED MITIGATION PLAYBOOK
                      </div>
                      <p style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 9.5, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.4 }}>
                        {selectedAnomaly.recommendedAction}
                      </p>
                      <button
                        onClick={handleInitiateRecovery}
                        style={{
                          marginTop: 10,
                          padding: '6px 12px',
                          background: 'rgba(0, 255, 136, 0.2)',
                          border: '1px solid #00ff88',
                          borderRadius: 4,
                          color: '#00ff88',
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: 8.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ⚡ EXECUTE MITIGATION SEQUENCE
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: EVIDENCE */}
              {drawerTab === 'evidence' && (
                <AnomalyEvidencePanel
                  anomaly={selectedAnomaly || undefined}
                  onInitiateRecovery={handleInitiateRecovery}
                  onAskAI={() => setDrawerTab('ai')}
                />
              )}

              {/* TAB 3: DETECTION */}
              {drawerTab === 'detection' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div
                    style={{
                      padding: '12px',
                      background: 'rgba(5, 14, 30, 0.8)',
                      border: '1px solid rgba(0, 212, 255, 0.2)',
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: '#00d4ff', marginBottom: 6 }}>
                      DETECTION PIPELINE RULES &amp; CRITERIA
                    </div>
                    <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                      Telemetry signals are evaluated continuously through a 3-tier detection stack:
                      <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                        <li>1. <strong>Deterministic Thresholds:</strong> Hard warning and critical boundaries defined by space mission flight rules.</li>
                        <li>2. <strong>Z-Score Statistical Isolation:</strong> Moving variance window detection for rate-of-change spikes.</li>
                        <li>3. <strong>Kalman Residual Testing:</strong> Divergence from expected orbital state dynamics.</li>
                      </ul>
                    </div>
                  </div>

                  {selectedAnomaly && (
                    <div
                      style={{
                        padding: '12px',
                        background: 'rgba(5, 14, 30, 0.6)',
                        border: '1px solid rgba(255, 45, 85, 0.2)',
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: '#ff2d55', marginBottom: 8 }}>
                        ACTIVE ANOMALY DETECTION ARTIFACTS
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 9 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'rgba(255,255,255,0.45)' }}>Detection Method:</span>
                          <span style={{ color: '#00d4ff', fontFamily: 'var(--font-mono, monospace)' }}>
                            {selectedAnomaly.detectionMethod.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'rgba(255,255,255,0.45)' }}>Detection Timestamp:</span>
                          <span style={{ color: '#fff', fontFamily: 'var(--font-mono, monospace)' }}>
                            {new Date(selectedAnomaly.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'rgba(255,255,255,0.45)' }}>Confidence Rating:</span>
                          <span style={{ color: '#00ff88', fontWeight: 700 }}>
                            {Math.round(selectedAnomaly.confidence * 100)}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'rgba(255,255,255,0.45)' }}>Current Status:</span>
                          <span style={{ color: selectedAnomaly.status === 'resolved' ? '#00ff88' : '#ff2d55', fontWeight: 700 }}>
                            {selectedAnomaly.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: TIMELINE */}
              {drawerTab === 'timeline' && (
                <AnomalyTimelineLog
                  anomaly={selectedAnomaly || undefined}
                  allAnomalies={anomalies}
                  onSelectAnomaly={(a) => {
                    setSelectedAnomalyId(a.id);
                    setSelectedParamId(a.parameterId);
                  }}
                />
              )}

              {/* TAB 5: VYOM AI */}
              {drawerTab === 'ai' && (
                <VyomAIAnomalyExplainer
                  selectedAnomaly={selectedAnomaly || undefined}
                  onSelectParam={(paramId) => setSelectedParamId(paramId)}
                />
              )}

              {/* TAB 6: WHAT-IF & BENCHMARK */}
              {drawerTab === 'what_if' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <WhatIfComparison />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ScenariosScreen;
