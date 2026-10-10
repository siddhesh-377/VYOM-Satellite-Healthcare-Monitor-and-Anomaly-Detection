/**
 * VYOM — Centralized Satellite Telemetry Profiles & Anomaly Detection Envelopes
 *
 * Defines nominal operating baselines, warning and critical boundaries,
 * rate-of-change limits, and persistence rules for all satellite subsystems.
 *
 * Note: These values represent illustrative engineering simulation thresholds
 * configured for digital twin testing and telemetry validation.
 */

export type SubsystemCategory =
  | 'Thermal (TCS)'
  | 'Power (EPS)'
  | 'Communication'
  | 'ADCS / Guidance'
  | 'Avionics / Compute'
  | 'Life Support (ECLSS)';

export type DetectionMethodType =
  | 'threshold'
  | 'baseline-deviation'
  | 'rate-of-change'
  | 'persistence'
  | 'cross-correlation';

export interface TelemetryParameterProfile {
  id: string;
  channelKey: string;
  subsystemPath: string; // e.g. 'thermal.cpuTempC'
  displayName: string;
  subsystem: SubsystemCategory;
  unit: string;
  nominalValue: number;
  nominalRange: { min: number; max: number };
  warningLimits?: { min?: number; max?: number };
  criticalLimits?: { min?: number; max?: number };
  maxRateOfChangePerSec?: number;
  persistenceSamples: number; // Consecutive samples required before raising alert
  applicableMethods: DetectionMethodType[];
  description: string;
  isInverted?: boolean; // True if lower values are dangerous (e.g. voltage, battery, signal)
}

export const TELEMETRY_PARAMETER_PROFILES: Record<string, TelemetryParameterProfile> = {
  cpuTempC: {
    id: 'cpuTempC',
    channelKey: 'cpuTempC',
    subsystemPath: 'thermal.cpuTempC',
    displayName: 'Flight Computer Temp',
    subsystem: 'Thermal (TCS)',
    unit: '°C',
    nominalValue: 41.8,
    nominalRange: { min: 25.0, max: 50.0 },
    warningLimits: { max: 65.0 },
    criticalLimits: { max: 75.0 },
    maxRateOfChangePerSec: 2.0,
    persistenceSamples: 3,
    applicableMethods: ['threshold', 'baseline-deviation', 'rate-of-change', 'persistence', 'cross-correlation'],
    description: 'Onboard computer processor core temperature. High levels risk silicon thermal throttling and watchdog reset.',
  },
  payloadTempC: {
    id: 'payloadTempC',
    channelKey: 'payloadTempC',
    subsystemPath: 'thermal.payloadTempC',
    displayName: 'Payload Sensor Temp',
    subsystem: 'Thermal (TCS)',
    unit: '°C',
    nominalValue: 32.5,
    nominalRange: { min: 15.0, max: 45.0 },
    warningLimits: { max: 55.0 },
    criticalLimits: { max: 68.0 },
    maxRateOfChangePerSec: 1.5,
    persistenceSamples: 3,
    applicableMethods: ['threshold', 'baseline-deviation', 'rate-of-change'],
    description: 'Primary optical/hyperspectral payload instrument bench temperature.',
  },
  voltageV: {
    id: 'voltageV',
    channelKey: 'voltageV',
    subsystemPath: 'power.voltageV',
    displayName: 'Main Bus Voltage',
    subsystem: 'Power (EPS)',
    unit: 'V',
    nominalValue: 28.5,
    nominalRange: { min: 26.0, max: 32.0 },
    warningLimits: { min: 24.0 },
    criticalLimits: { min: 22.0 },
    maxRateOfChangePerSec: 1.0,
    persistenceSamples: 2,
    applicableMethods: ['threshold', 'baseline-deviation', 'rate-of-change', 'cross-correlation'],
    description: 'Primary 28V regulated power distribution bus. Undervoltage leads to component brownout.',
    isInverted: true,
  },
  batteryPercent: {
    id: 'batteryPercent',
    channelKey: 'batteryPercent',
    subsystemPath: 'power.batteryPercent',
    displayName: 'Battery State of Charge',
    subsystem: 'Power (EPS)',
    unit: '%',
    nominalValue: 96.4,
    nominalRange: { min: 65.0, max: 100.0 },
    warningLimits: { min: 40.0 },
    criticalLimits: { min: 20.0 },
    maxRateOfChangePerSec: 1.5,
    persistenceSamples: 3,
    applicableMethods: ['threshold', 'baseline-deviation', 'rate-of-change', 'cross-correlation'],
    description: 'Lithium-ion energy storage state of charge. Depletion risks permanent spacecraft loss during eclipse.',
    isInverted: true,
  },
  solarGenerationW: {
    id: 'solarGenerationW',
    channelKey: 'solarGenerationW',
    subsystemPath: 'power.solarGenerationW',
    displayName: 'Solar Array Generation',
    subsystem: 'Power (EPS)',
    unit: 'W',
    nominalValue: 260.0,
    nominalRange: { min: 180.0, max: 340.0 },
    warningLimits: { min: 140.0 },
    criticalLimits: { min: 50.0 },
    maxRateOfChangePerSec: 15.0,
    persistenceSamples: 2,
    applicableMethods: ['threshold', 'baseline-deviation', 'cross-correlation'],
    description: 'Total electrical power harvested from deployed photovoltaic solar arrays.',
    isInverted: true,
  },
  consumptionW: {
    id: 'consumptionW',
    channelKey: 'consumptionW',
    subsystemPath: 'power.consumptionW',
    displayName: 'Subsystem Power Load',
    subsystem: 'Power (EPS)',
    unit: 'W',
    nominalValue: 120.0,
    nominalRange: { min: 80.0, max: 160.0 },
    warningLimits: { max: 180.0 },
    criticalLimits: { max: 220.0 },
    maxRateOfChangePerSec: 10.0,
    persistenceSamples: 3,
    applicableMethods: ['threshold', 'baseline-deviation', 'cross-correlation'],
    description: 'Aggregate electrical power consumed across active avionics and payloads.',
  },
  signalDbm: {
    id: 'signalDbm',
    channelKey: 'signalDbm',
    subsystemPath: 'comm.signalDbm',
    displayName: 'RF Downlink Signal',
    subsystem: 'Communication',
    unit: 'dBm',
    nominalValue: -72.0,
    nominalRange: { min: -85.0, max: -60.0 },
    warningLimits: { min: -95.0 },
    criticalLimits: { min: -110.0 },
    maxRateOfChangePerSec: 5.0,
    persistenceSamples: 2,
    applicableMethods: ['threshold', 'baseline-deviation', 'rate-of-change', 'cross-correlation'],
    description: 'Ground station received carrier signal power. Low values indicate RF attenuation or antenna misalignment.',
    isInverted: true,
  },
  dataRateMbps: {
    id: 'dataRateMbps',
    channelKey: 'dataRateMbps',
    subsystemPath: 'comm.dataRateMbps',
    displayName: 'Downlink Data Rate',
    subsystem: 'Communication',
    unit: 'Mbps',
    nominalValue: 8.4,
    nominalRange: { min: 4.0, max: 12.0 },
    warningLimits: { min: 2.0 },
    criticalLimits: { min: 0.5 },
    maxRateOfChangePerSec: 2.0,
    persistenceSamples: 2,
    applicableMethods: ['threshold', 'baseline-deviation'],
    description: 'Effective telemetry and payload data throughput to tracking ground stations.',
    isInverted: true,
  },
  reactionWheelRpm: {
    id: 'reactionWheelRpm',
    channelKey: 'reactionWheelRpm',
    subsystemPath: 'attitude.reactionWheelRpm',
    displayName: 'Reaction Wheel Speed',
    subsystem: 'ADCS / Guidance',
    unit: 'RPM',
    nominalValue: 3240.0,
    nominalRange: { min: 1000.0, max: 4800.0 },
    warningLimits: { max: 5500.0 },
    criticalLimits: { max: 6200.0 },
    maxRateOfChangePerSec: 150.0,
    persistenceSamples: 2,
    applicableMethods: ['threshold', 'baseline-deviation', 'cross-correlation'],
    description: 'Angular momentum storage wheel speed. Saturation causes loss of fine 3-axis pointing control.',
  },
  angularVelDegS: {
    id: 'angularVelDegS',
    channelKey: 'angularVelDegS',
    subsystemPath: 'attitude.angularVelDegS',
    displayName: 'Spacecraft Slew Rate',
    subsystem: 'ADCS / Guidance',
    unit: '°/s',
    nominalValue: 0.01,
    nominalRange: { min: 0.0, max: 0.1 },
    warningLimits: { max: 0.5 },
    criticalLimits: { max: 1.5 },
    maxRateOfChangePerSec: 0.2,
    persistenceSamples: 1,
    applicableMethods: ['threshold', 'rate-of-change'],
    description: 'Rate of angular body rotation across roll, pitch, and yaw axes.',
  },
  cpuPercent: {
    id: 'cpuPercent',
    channelKey: 'cpuPercent',
    subsystemPath: 'compute.cpuPercent',
    displayName: 'Onboard CPU Load',
    subsystem: 'Avionics / Compute',
    unit: '%',
    nominalValue: 32.0,
    nominalRange: { min: 10.0, max: 60.0 },
    warningLimits: { max: 75.0 },
    criticalLimits: { max: 90.0 },
    maxRateOfChangePerSec: 15.0,
    persistenceSamples: 3,
    applicableMethods: ['threshold', 'baseline-deviation', 'cross-correlation'],
    description: 'Real-time flight computer processor utilization.',
  },
};

export function extractParameterValue(telemetry: any, path: string): number | undefined {
  if (!telemetry) return undefined;
  const parts = path.split('.');
  let current = telemetry;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (current == null) return undefined;
    if (current[part] !== undefined) {
      current = current[part];
    } else if (part === 'comm' && current.communications !== undefined) {
      current = current.communications;
    } else if (part === 'communications' && current.comm !== undefined) {
      current = current.comm;
    } else if (part === 'voltageV' && current.voltage !== undefined) {
      current = current.voltage;
    } else if (part === 'voltage' && current.voltageV !== undefined) {
      current = current.voltageV;
    } else if (part === 'solarGenerationW' && current.generationWatts !== undefined) {
      current = current.generationWatts;
    } else if (part === 'consumptionW' && current.consumptionWatts !== undefined) {
      current = current.consumptionWatts;
    } else if (part === 'signalDbm' && current.signalStrengthDbm !== undefined) {
      current = current.signalStrengthDbm;
    } else if (part === 'dataRateMbps' && current.dataRateKbps !== undefined) {
      current = current.dataRateKbps / 1000;
    } else {
      return undefined;
    }
  }
  return typeof current === 'number' && !isNaN(current) ? current : undefined;
}
