import { describe, it, expect, beforeEach } from 'vitest';
import { AnomalyPipelineService } from '../engines/AnomalyPipelineEngine';
import { TELEMETRY_PARAMETER_PROFILES } from '../config/telemetryProfiles';
import { Telemetry } from '../types/mission';

function createNominalTelemetry(): Telemetry {
  return {
    missionDay: 1,
    timestamp: 1000,
    power: {
      batteryPercent: 96, // Nominal [65, 100]
      voltageV: 28.5, // Nominal [26, 32]
      currentA: 5.2,
      solarGenerationW: 260, // Nominal [180, 340]
      consumptionW: 120, // Nominal [80, 160]
    },
    thermal: {
      cpuTempC: 41.8, // Nominal [25, 50]
      batteryTempC: 22,
      payloadTempC: 32.5, // Nominal [15, 45]
      externalTempC: 15,
    },
    attitude: {
      rollDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      angularVelDegS: 0.01,
      reactionWheelRpm: 3240,
    },
    comm: {
      signalDbm: -72, // Nominal [-85, -60]
      dataRateMbps: 8.4, // Nominal [4, 12]
      packetsPerSec: 120,
      latencyMs: 35,
      uptime: 99.8,
    },
    compute: {
      cpuPercent: 32,
      memoryPercent: 44,
      storagePercent: 50,
    },
    orbit: {
      altitudeKm: 550,
      velocityKms: 7.6,
      accelerationMs2: 0,
      gForce: 1,
      latitudeDeg: 0,
      longitudeDeg: 0,
      inclinationDeg: 51.6,
      periodMin: 95,
      apogeeKm: 555,
      perigeeKm: 545,
      semiMajorAxisKm: 6928,
      eccentricity: 0.001,
      trueAnomalyDeg: 45,
      atmosphericLayer: 'Exosphere',
      atmosphericDensityKgM3: 1e-12,
      atmosphericDragN: 0.001,
    },
    overallHealth: 98,
    healthStatus: 'nominal',
    dataSource: 'simulation',
  };
}

describe('Explainable Anomaly Detection Pipeline Acceptance Tests', () => {
  let pipeline: AnomalyPipelineService;

  beforeEach(() => {
    pipeline = new AnomalyPipelineService();
    pipeline.reset();
  });

  // Test 1 — Thermal fault
  it('Test 1: Thermal fault detection, threshold crossing, and evidence generation', () => {
    const telemetry = createNominalTelemetry();
    telemetry.timestamp = 1000;
    telemetry.thermal.cpuTempC = 78; // Above critical limit (75°C) -> triggers immediately

    const anomalies = pipeline.evaluate(telemetry);
    const cpuAnomaly = anomalies.find((a) => a.parameterId === 'cpuTempC');

    expect(cpuAnomaly).toBeDefined();
    expect(cpuAnomaly?.severity).toBe('critical');
    expect(cpuAnomaly?.affectedSubsystem.toLowerCase()).toContain('thermal');
    expect(cpuAnomaly?.currentValue).toBe(78);
    expect(cpuAnomaly?.baseline).toBe(TELEMETRY_PARAMETER_PROFILES.cpuTempC.nominalValue);
    expect(cpuAnomaly?.measuredEvidence.length).toBeGreaterThan(0);
    expect(cpuAnomaly?.rootCause.suspectedCause.toLowerCase()).toContain('thermal');
    expect(cpuAnomaly?.timeline.length).toBeGreaterThan(0);
    expect(cpuAnomaly?.explanation.toLowerCase()).toContain('temp');
  });

  // Test 2 — Power fault
  it('Test 2: Power fault undervoltage, load correlation, and evidence citation', () => {
    const telemetry = createNominalTelemetry();
    telemetry.timestamp = 2000;
    telemetry.power.voltageV = 21.0; // Below critical limit (22.0V) -> triggers immediately

    const anomalies = pipeline.evaluate(telemetry);
    const powerAnomaly = anomalies.find((a) => a.parameterId === 'voltageV');

    expect(powerAnomaly).toBeDefined();
    expect(powerAnomaly?.severity).toBe('critical');
    expect(powerAnomaly?.affectedSubsystem.toLowerCase()).toContain('power');
    expect(powerAnomaly?.rootCause.supportingParameters.length).toBeGreaterThan(0);
    expect(
      powerAnomaly?.rootCause.supportingParameters.some(
        (p) =>
          p.parameter.toLowerCase().includes('battery') ||
          p.parameter.toLowerCase().includes('consumption') ||
          p.parameter.toLowerCase().includes('solar')
      )
    ).toBe(true);
    expect(powerAnomaly?.measuredEvidence[0].triggeredLimit).toContain('22 V');
  });

  // Test 3 — Communication fault
  it('Test 3: Communication fault signal attenuation and bitrate display', () => {
    const telemetry = createNominalTelemetry();
    telemetry.timestamp = 3000;
    telemetry.comm.signalDbm = -115; // Below critical limit (-110 dBm) -> triggers immediately

    const anomalies = pipeline.evaluate(telemetry);
    const commAnomaly = anomalies.find((a) => a.parameterId === 'signalDbm');

    expect(commAnomaly).toBeDefined();
    expect(commAnomaly?.severity).toBe('critical');
    expect(commAnomaly?.affectedSubsystem.toLowerCase()).toContain('communication');
    expect(commAnomaly?.unit).toBe('dBm');
    expect(commAnomaly?.currentValue).toBe(-115);
  });

  // Test 4 — No false alert
  it('Test 4: Nominal simulation generates zero false alerts', () => {
    const telemetry = createNominalTelemetry();

    // Run 5 consecutive nominal cycles
    for (let i = 0; i < 5; i++) {
      telemetry.timestamp = 1000 + i * 1000;
      const anomalies = pipeline.evaluate(telemetry);
      expect(anomalies.length).toBe(0);
    }

    expect(pipeline.getActiveAnomaly()).toBeUndefined();
    expect(pipeline.getAllAnomalies().length).toBe(0);
  });

  // Test 5 — Threshold boundary
  it('Test 5: Threshold boundary tests (below, at, and above limits)', () => {
    const profile = TELEMETRY_PARAMETER_PROFILES.cpuTempC;
    const warnLimit = profile.warningLimits?.max!; // 65
    const critLimit = profile.criticalLimits?.max!; // 75

    // Nominal: Below warn limit
    let t = createNominalTelemetry();
    t.thermal.cpuTempC = warnLimit - 1; // 64
    let anomalies = pipeline.evaluate(t);
    expect(anomalies.find((a) => a.parameterId === 'cpuTempC')).toBeUndefined();

    // Warning boundary: Requires persistence (3 samples of 68°C)
    pipeline.reset();
    t.thermal.cpuTempC = warnLimit + 3; // 68
    for (let i = 0; i < profile.persistenceSamples; i++) {
      t.timestamp = 1000 + i * 1000;
      anomalies = pipeline.evaluate(t);
    }
    let anom = anomalies.find((a) => a.parameterId === 'cpuTempC');
    expect(anom).toBeDefined();
    expect(anom?.severity).toBe('warning');

    // Critical boundary: Immediately triggers on exceeding critical limit
    pipeline.reset();
    t.thermal.cpuTempC = critLimit + 2; // 77
    t.timestamp = 5000;
    anomalies = pipeline.evaluate(t);
    anom = anomalies.find((a) => a.parameterId === 'cpuTempC');
    expect(anom).toBeDefined();
    expect(anom?.severity).toBe('critical');
  });

  // Test 6 — Persistence detection
  it('Test 6: Persistence requirement prevents premature alerts', () => {
    // payloadTempC has persistenceSamples = 3, warningLimit = 55
    const t = createNominalTelemetry();
    t.thermal.payloadTempC = 58; // Above warning limit (55)

    // Sample 1: condition observed but persistence not met
    t.timestamp = 1000;
    let anomalies = pipeline.evaluate(t);
    expect(anomalies.find((a) => a.parameterId === 'payloadTempC')).toBeUndefined();

    // Sample 2: still below 3 samples
    t.timestamp = 2000;
    anomalies = pipeline.evaluate(t);
    expect(anomalies.find((a) => a.parameterId === 'payloadTempC')).toBeUndefined();

    // Sample 3: persistence threshold of 3 reached -> Alert raised!
    t.timestamp = 3000;
    anomalies = pipeline.evaluate(t);
    const payloadAnom = anomalies.find((a) => a.parameterId === 'payloadTempC');
    expect(payloadAnom).toBeDefined();
    expect(payloadAnom?.severity).toBe('warning');
  });

  // Test 7 — Recovery verification
  it('Test 7: Recovery verification requires consecutive nominal samples inside flight bounds', () => {
    const t = createNominalTelemetry();
    t.thermal.cpuTempC = 78; // Critical (triggers immediately)
    t.timestamp = 1000;
    pipeline.evaluate(t);

    const active = pipeline.getActiveAnomaly();
    expect(active).toBeDefined();
    expect(active?.status).toBe('active');

    // Initiate recovery
    pipeline.initiateRecovery();
    expect(active?.status).toBe('recovering');

    // Return telemetry to nominal (41.8°C), but verify it requires 4 consecutive samples
    t.thermal.cpuTempC = 41.8;

    // Sample 1 of recovery
    t.timestamp = 2000;
    pipeline.evaluate(t);
    expect(active?.status).toBe('recovering');
    expect(active?.beforeAfter.recoveryCriteriaMet).toBe(false);

    // Sample 2 of recovery
    t.timestamp = 3000;
    pipeline.evaluate(t);
    expect(active?.status).toBe('recovering');

    // Sample 3 of recovery
    t.timestamp = 4000;
    pipeline.evaluate(t);
    expect(active?.status).toBe('recovering');

    // Sample 4 of recovery (consecutive requirement met)
    t.timestamp = 5000;
    pipeline.evaluate(t);
    expect(active?.status).toBe('resolved');
    expect(active?.beforeAfter.recoveryCriteriaMet).toBe(true);
    expect(active?.beforeAfter.postRecoveryValue).toBe(41.8);
  });

  // Test 8 — Cross-component consistency
  it('Test 8: Cross-component consistency between measured evidence, timeline, and before/after stats', () => {
    const t = createNominalTelemetry();
    t.timestamp = 1000;
    t.thermal.cpuTempC = 78; // Critical

    pipeline.evaluate(t);
    const anomaly = pipeline.getActiveAnomaly()!;

    expect(anomaly).toBeDefined();
    expect(anomaly.severity).toBe('critical');

    // Evidence matches current sample
    const evidenceItem = anomaly.measuredEvidence.find((e) => e.parameterName.toLowerCase().includes('temp'));
    expect(evidenceItem).toBeDefined();
    expect(evidenceItem?.currentValue).toBe(78);
    expect(evidenceItem?.result).toBe('Critical');

    // Timeline matches stages
    expect(anomaly.timeline.some((s) => s.stageName.includes('Threshold Crossed'))).toBe(true);
    expect(anomaly.timeline.some((s) => s.stageName.includes('Detection Engine Raised Event'))).toBe(true);

    // Before/after stats record peak
    expect(anomaly.beforeAfter.peakValue).toBe(78);
  });

  // Test 9 — Offline / Fallback handling
  it('Test 9: Deterministic local rule engine generates valid diagnostic outputs without backend', () => {
    const t = createNominalTelemetry();
    t.thermal.cpuTempC = 78; // Critical
    pipeline.evaluate(t);
    const anomaly = pipeline.getActiveAnomaly()!;

    expect(anomaly.rootCause).toBeDefined();
    expect(anomaly.rootCause.observedEvidence.toLowerCase()).toContain('temp');
    expect(anomaly.rootCause.suspectedCause).toBeDefined();
    expect(anomaly.rootCause.recommendedNextStep).toBeDefined();
  });

  // Test 10 — Invalid / NaN telemetry resilience
  it('Test 10: Gracefully handles missing, stale, or NaN telemetry without crashing', () => {
    const invalidTelemetry: any = {
      timestamp: 1000,
      thermal: { cpuTempC: NaN },
      power: { voltageV: undefined },
      comm: null,
    };

    expect(() => {
      const anomalies = pipeline.evaluate(invalidTelemetry);
      expect(Array.isArray(anomalies)).toBe(true);
    }).not.toThrow();
  });
});
