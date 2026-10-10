/**
 * VYOM — Multi-Tier Explainable Anomaly Detection Pipeline Engine
 *
 * Implements an aerospace telemetry anomaly-detection pipeline:
 * Telemetry Collection → Data Validation → Baseline Comparison →
 * Threshold and Trend Analysis → Anomaly Classification → Root-Cause Evidence →
 * Alert Generation → Graph Annotation → Recovery Verification
 */

import { Telemetry, Incident } from '../types/mission';
import { useMissionStore } from '../store/missionStore';
import { eventBus } from './MissionEventBus';
import {
  TELEMETRY_PARAMETER_PROFILES,
  TelemetryParameterProfile,
  extractParameterValue,
  DetectionMethodType,
  SubsystemCategory,
} from '../config/telemetryProfiles';

export interface MeasuredEvidenceItem {
  parameterId: string;
  parameterName: string;
  unit: string;
  currentValue: number;
  baseline: number;
  expectedRange: string;
  triggeredLimit: string;
  deviation: number;
  deviationPercent: number;
  result: 'Normal' | 'Warning' | 'Critical';
}

export interface RootCauseAssessment {
  observedEvidence: string;
  suspectedCause: string;
  supportingParameters: Array<{ parameter: string; value: string; correlation: string }>;
  differentialDiagnosis: string;
  recommendedNextStep: string;
}

export interface AnomalyBeforeAfter {
  preAnomalyBaseline: number;
  peakValue: number;
  peakValueDuringEvent: number;
  thresholdCrossed: number;
  peakDeviation: number;
  startTime: number;
  warningCrossingTime?: number;
  criticalCrossingTime?: number;
  recoveryInitiatedTime?: number;
  recoveryResolvedTime?: number;
  durationSec?: number;
  postRecoveryValue?: number;
  recoveryCriteriaMet: boolean;
}

export interface AnomalyTimelineStage {
  stageNumber: number;
  stageName: string;
  timestamp: number;
  description: string;
  telemetryRef?: string;
  status: 'completed' | 'in-progress' | 'pending';
}

export interface ExplainableAnomaly {
  id: string;
  scenarioId?: string;
  parameterId: string;
  parameterName: string;
  unit: string;
  currentValue: number;
  baseline: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  deviation: number;
  deviationPercent: number;
  detectionMethod: DetectionMethodType;
  timestamp: number;
  severity: 'warning' | 'critical' | 'emergency';
  affectedSubsystem: SubsystemCategory;
  normalized_subsystem?: string;
  evidence: string[];
  confidence: number;
  recommendedAction: string;
  status: 'active' | 'monitoring' | 'recovering' | 'resolved';
  pipelineStagesCompleted: string[];
  explanation: string;
  measuredEvidence: MeasuredEvidenceItem[];
  rootCause: RootCauseAssessment;
  beforeAfter: AnomalyBeforeAfter;
  timeline: AnomalyTimelineStage[];
  isRecovered: boolean;
}

interface ParameterHistoryPoint {
  val: number;
  time: number;
}

export class AnomalyPipelineService {
  private historyBuffer: Map<string, ParameterHistoryPoint[]> = new Map();
  private maxHistorySamples: number = 100;
  private violationCounters: Map<string, number> = new Map();
  private nominalConsecutiveCounters: Map<string, number> = new Map();
  private activeAnomalies: Map<string, ExplainableAnomaly> = new Map();
  private anomalyCounter: number = 100;
  private recoveryInitiatedFlag: boolean = false;
  private listeners: ((anomalies: ExplainableAnomaly[]) => void)[] = [];

  constructor() {
    eventBus.subscribe('THREAT_MITIGATED', () => {
      this.initiateRecovery();
    });
  }

  public subscribe(listener: (anomalies: ExplainableAnomaly[]) => void): () => void {
    this.listeners.push(listener);
    listener(this.getAllAnomalies());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const list = this.getAllAnomalies();
    this.listeners.forEach((l) => l(list));
  }

  public getAllAnomalies(): ExplainableAnomaly[] {
    return Array.from(this.activeAnomalies.values());
  }

  public getActiveAnomaly(): ExplainableAnomaly | undefined {
    return Array.from(this.activeAnomalies.values()).find((a) => a.status !== 'resolved');
  }

  public getAnomalyById(id: string): ExplainableAnomaly | undefined {
    return this.activeAnomalies.get(id);
  }

  public initiateRecovery(): void {
    this.recoveryInitiatedFlag = true;
    const now = Date.now();
    this.activeAnomalies.forEach((anomaly) => {
      if (anomaly.status === 'active' || anomaly.status === 'monitoring') {
        anomaly.status = 'recovering';
        anomaly.beforeAfter.recoveryInitiatedTime = now;
        anomaly.timeline.push({
          stageNumber: 8,
          stageName: 'Recovery Initiated',
          timestamp: now,
          description: 'Countermeasure or fault removal engaged. Telemetry transitioning toward nominal range.',
          status: 'completed',
        });
      }
    });
    this.notify();
  }

  public reset(): void {
    this.activeAnomalies.clear();
    this.historyBuffer.clear();
    this.violationCounters.clear();
    this.nominalConsecutiveCounters.clear();
    this.recoveryInitiatedFlag = false;
    this.notify();
  }

  /**
   * Main pipeline execution evaluating a telemetry packet
   */
  public evaluate(telemetry: Telemetry): ExplainableAnomaly[] {
    if (!telemetry) return [];
    const timestamp = telemetry.timestamp || Date.now();
    const generatedAnomalies: ExplainableAnomaly[] = [];

    // Stage 1: Telemetry Collection & Stage 2: Data Validation
    for (const key of Object.keys(TELEMETRY_PARAMETER_PROFILES)) {
      const profile = TELEMETRY_PARAMETER_PROFILES[key];
      const val = extractParameterValue(telemetry, profile.subsystemPath);

      // Explicit Data Validation: handle null, undefined, NaN
      if (val === undefined || isNaN(val)) {
        continue;
      }

      // Record sample in buffer
      this.recordSample(profile.id, val, timestamp);

      // Check existing anomaly for this parameter
      const existingAnomaly = this.activeAnomalies.get(profile.id);

      // Stage 3 & 4: Baseline Comparison & Threshold Analysis
      const isCritical = this.checkLimit(val, profile.criticalLimits, profile.isInverted);
      const isWarning = isCritical || this.checkLimit(val, profile.warningLimits, profile.isInverted);

      const rateOfChange = this.calculateRateOfChange(profile.id);
      const isRateViolation =
        profile.maxRateOfChangePerSec != null &&
        Math.abs(rateOfChange) > profile.maxRateOfChangePerSec &&
        (val < profile.nominalRange.min || val > profile.nominalRange.max);

      const deviation = Math.abs(val - profile.nominalValue);
      const deviationPercent =
        profile.nominalValue !== 0
          ? Number(((deviation / Math.abs(profile.nominalValue)) * 100).toFixed(1))
          : 0;

      // Persistence check
      if (isWarning || isRateViolation) {
        const count = (this.violationCounters.get(profile.id) || 0) + 1;
        this.violationCounters.set(profile.id, count);
        this.nominalConsecutiveCounters.set(profile.id, 0);

        // Explicit critical alerts trigger immediately (count >= 1), otherwise require configured persistence samples
        const persistenceMet = isCritical ? count >= 1 : count >= profile.persistenceSamples;

        if (persistenceMet) {
          if (!existingAnomaly) {
            // Stage 5 & 6: Anomaly Classification & Root-Cause Evidence
            const severity: 'warning' | 'critical' = isCritical ? 'critical' : 'warning';
            const method: DetectionMethodType = isRateViolation
              ? 'rate-of-change'
              : count > 1
              ? 'persistence'
              : 'threshold';

            const newAnomaly = this.createAnomalyRecord(
              profile,
              val,
              deviation,
              deviationPercent,
              severity,
              method,
              timestamp,
              telemetry
            );

            this.activeAnomalies.set(profile.id, newAnomaly);
            generatedAnomalies.push(newAnomaly);

            // Register incident in mission store & publish event
            this.syncStoreIncident(newAnomaly);
            eventBus.publish('ALERT_RAISED', {
              id: newAnomaly.id,
              subsystem: newAnomaly.affectedSubsystem,
              message: newAnomaly.explanation,
              severity: newAnomaly.severity,
            });
          } else {
            // Update peak and threshold crossing in existing anomaly
            this.updateExistingAnomaly(existingAnomaly, val, deviation, isCritical, timestamp);
          }
        }
      } else {
        // Parameter is within safe envelope
        this.violationCounters.set(profile.id, 0);
        const nomCount = (this.nominalConsecutiveCounters.get(profile.id) || 0) + 1;
        this.nominalConsecutiveCounters.set(profile.id, nomCount);

        // Stage 9: Recovery Verification
        // If an anomaly exists and is recovering (or fault is removed), verify stability
        if (existingAnomaly && existingAnomaly.status !== 'resolved') {
          existingAnomaly.beforeAfter.postRecoveryValue = val;

          if (existingAnomaly.status === 'active') {
            existingAnomaly.status = 'recovering';
            existingAnomaly.beforeAfter.recoveryInitiatedTime = timestamp;
            existingAnomaly.timeline.push({
              stageNumber: 8,
              stageName: 'Recovery Initiated',
              timestamp,
              description: `Sensor telemetry returning inside baseline boundaries (${val.toFixed(1)} ${profile.unit}).`,
              status: 'completed',
            });
          }

          // Recovery criteria: 4 consecutive normal samples inside safe envelope
          if (nomCount >= 4) {
            existingAnomaly.status = 'resolved';
            existingAnomaly.isRecovered = true;
            existingAnomaly.beforeAfter.recoveryCriteriaMet = true;
            existingAnomaly.beforeAfter.recoveryResolvedTime = timestamp;
            existingAnomaly.beforeAfter.durationSec = Number(
              ((timestamp - existingAnomaly.beforeAfter.startTime) / 1000).toFixed(1)
            );

            existingAnomaly.timeline.push({
              stageNumber: 10,
              stageName: 'Recovery Criteria Verified & Event Resolved',
              timestamp,
              description: `Telemetry stabilized inside envelope for ${nomCount} consecutive samples. Incident resolved.`,
              status: 'completed',
            });

            this.updateStoreIncidentResolved(existingAnomaly);
            eventBus.publish('ALERT_RESOLVED', { id: existingAnomaly.id });
          }
        }
      }
    }

    if (generatedAnomalies.length > 0 || this.activeAnomalies.size > 0) {
      this.notify();
    }

    return generatedAnomalies;
  }

  private checkLimit(val: number, limits?: { min?: number; max?: number }, inverted?: boolean): boolean {
    if (!limits) return false;
    if (inverted) {
      if (limits.min != null && val <= limits.min) return true;
      if (limits.max != null && val >= limits.max) return true;
    } else {
      if (limits.max != null && val >= limits.max) return true;
      if (limits.min != null && val <= limits.min) return true;
    }
    return false;
  }

  private recordSample(paramId: string, val: number, time: number) {
    if (!this.historyBuffer.has(paramId)) {
      this.historyBuffer.set(paramId, []);
    }
    const samples = this.historyBuffer.get(paramId)!;
    samples.push({ val, time });
    if (samples.length > this.maxHistorySamples) {
      samples.shift();
    }
  }

  private calculateRateOfChange(paramId: string): number {
    const samples = this.historyBuffer.get(paramId);
    if (!samples || samples.length < 2) return 0;
    const first = samples[samples.length - 2];
    const last = samples[samples.length - 1];
    const dt = (last.time - first.time) / 1000;
    if (dt <= 0) return 0;
    return (last.val - first.val) / dt;
  }

  private createAnomalyRecord(
    profile: TelemetryParameterProfile,
    val: number,
    deviation: number,
    deviationPercent: number,
    severity: 'warning' | 'critical',
    detectionMethod: DetectionMethodType,
    timestamp: number,
    telemetry: Telemetry
  ): ExplainableAnomaly {
    const anomId = `ANOM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${++this.anomalyCounter}`;

    const limitStr = severity === 'critical'
      ? (profile.isInverted ? `≤ ${profile.criticalLimits?.min}` : `≥ ${profile.criticalLimits?.max}`)
      : (profile.isInverted ? `≤ ${profile.warningLimits?.min}` : `≥ ${profile.warningLimits?.max}`);

    const expectedRangeStr = `${profile.nominalRange.min} - ${profile.nominalRange.max} ${profile.unit}`;

    // Supporting parameters cross-correlation
    const supporting = this.findCorrelatedParameters(profile, telemetry);

    // Differential diagnosis & next steps
    const rootCause = this.buildRootCauseAssessment(profile, val, severity, supporting);

    // Transparent, non-hallucinated explanation
    const explanation = `${severity.toUpperCase()} anomaly triggered because measured ${profile.displayName} (${val.toFixed(1)} ${profile.unit}) crossed configured ${severity} limit (${limitStr} ${profile.unit}). Deviation from baseline is ${deviation.toFixed(1)} ${profile.unit} (${deviationPercent}%). Detected via ${detectionMethod.replace('-', ' ')} verification.`;

    const measuredEvidence: MeasuredEvidenceItem[] = [
      {
        parameterId: profile.id,
        parameterName: profile.displayName,
        unit: profile.unit,
        currentValue: val,
        baseline: profile.nominalValue,
        expectedRange: expectedRangeStr,
        triggeredLimit: `${limitStr} ${profile.unit}`,
        deviation,
        deviationPercent,
        result: severity === 'critical' ? 'Critical' : 'Warning',
      },
    ];

    // Append supporting evidence rows
    supporting.forEach((s) => {
      measuredEvidence.push({
        parameterId: s.parameter,
        parameterName: s.parameter,
        unit: '',
        currentValue: parseFloat(s.value) || 0,
        baseline: 0,
        expectedRange: 'Nominal',
        triggeredLimit: s.correlation,
        deviation: 0,
        deviationPercent: 0,
        result: 'Warning',
      });
    });

    const timeline: AnomalyTimelineStage[] = [
      {
        stageNumber: 1,
        stageName: 'Telemetry Deviation Detected',
        timestamp: timestamp - 1000,
        description: `Measured ${profile.displayName} deviated from nominal baseline (${profile.nominalValue} ${profile.unit}).`,
        status: 'completed',
      },
      {
        stageNumber: 2,
        stageName: `${severity.toUpperCase()} Threshold Crossed`,
        timestamp,
        description: `Telemetry crossed flight rule limit: ${val.toFixed(1)} ${profile.unit} ${limitStr}.`,
        telemetryRef: `${profile.id}=${val.toFixed(1)}`,
        status: 'completed',
      },
      {
        stageNumber: 3,
        stageName: 'Detection Engine Raised Event',
        timestamp,
        description: `Detection pipeline classified event via ${detectionMethod.replace('-', ' ')}. Evidence assembled.`,
        status: 'completed',
      },
      {
        stageNumber: 4,
        stageName: 'Root-Cause Evidence Collected',
        timestamp,
        description: `Cross-correlated supporting parameters across ${profile.subsystem}.`,
        status: 'completed',
      },
    ];

    return {
      id: anomId,
      parameterId: profile.id,
      parameterName: profile.displayName,
      unit: profile.unit,
      currentValue: val,
      baseline: profile.nominalValue,
      warningThreshold: profile.isInverted ? profile.warningLimits?.min : profile.warningLimits?.max,
      criticalThreshold: profile.isInverted ? profile.criticalLimits?.min : profile.criticalLimits?.max,
      deviation,
      deviationPercent,
      detectionMethod,
      timestamp,
      severity,
      affectedSubsystem: profile.subsystem,
      normalized_subsystem: profile.subsystem,
      evidence: [
        `Measured ${profile.displayName} = ${val.toFixed(1)} ${profile.unit} (Limit: ${limitStr} ${profile.unit})`,
        `Baseline Delta: ${deviation > 0 ? '+' : ''}${deviation.toFixed(1)} ${profile.unit} (${deviationPercent}%)`,
        `Subsystem: ${profile.subsystem}`,
      ],
      confidence: 0.96,
      recommendedAction: rootCause.recommendedNextStep,
      status: 'active',
      pipelineStagesCompleted: [
        'Telemetry Collection',
        'Data Validation',
        'Baseline Comparison',
        'Threshold & Trend Analysis',
        'Anomaly Classification',
        'Root-Cause Evidence',
        'Alert Generation',
        'Graph Annotation',
      ],
      explanation,
      measuredEvidence,
      rootCause,
      beforeAfter: {
        preAnomalyBaseline: profile.nominalValue,
        peakValue: val,
        peakValueDuringEvent: val,
        thresholdCrossed: severity === 'critical'
          ? (profile.isInverted ? profile.criticalLimits?.min ?? 0 : profile.criticalLimits?.max ?? 0)
          : (profile.isInverted ? profile.warningLimits?.min ?? 0 : profile.warningLimits?.max ?? 0),
        peakDeviation: deviation,
        startTime: timestamp,
        warningCrossingTime: timestamp,
        criticalCrossingTime: severity === 'critical' ? timestamp : undefined,
        recoveryCriteriaMet: false,
      },
      timeline,
      isRecovered: false,
    };
  }

  private updateExistingAnomaly(
    anomaly: ExplainableAnomaly,
    val: number,
    deviation: number,
    isCritical: boolean,
    timestamp: number
  ) {
    anomaly.currentValue = val;
    anomaly.measuredEvidence[0].currentValue = val;
    anomaly.measuredEvidence[0].deviation = deviation;

    // Track peak value
    const profile = TELEMETRY_PARAMETER_PROFILES[anomaly.parameterId];
    if (profile.isInverted) {
      if (val < anomaly.beforeAfter.peakValueDuringEvent) {
        anomaly.beforeAfter.peakValue = val;
        anomaly.beforeAfter.peakValueDuringEvent = val;
        anomaly.beforeAfter.peakDeviation = deviation;
      }
    } else {
      if (val > anomaly.beforeAfter.peakValueDuringEvent) {
        anomaly.beforeAfter.peakValue = val;
        anomaly.beforeAfter.peakValueDuringEvent = val;
        anomaly.beforeAfter.peakDeviation = deviation;
      }
    }

    // Escalate to critical if crossing critical limit
    if (isCritical && anomaly.severity !== 'critical') {
      anomaly.severity = 'critical';
      anomaly.beforeAfter.criticalCrossingTime = timestamp;
      anomaly.timeline.push({
        stageNumber: 5,
        stageName: 'Critical Threshold Escalation',
        timestamp,
        description: `Condition worsened to CRITICAL limit: ${val.toFixed(1)} ${profile.unit}.`,
        status: 'completed',
      });
    }
  }

  private findCorrelatedParameters(
    profile: TelemetryParameterProfile,
    telemetry: Telemetry
  ): Array<{ parameter: string; value: string; correlation: string }> {
    const list: Array<{ parameter: string; value: string; correlation: string }> = [];

    if (profile.subsystem === 'Thermal (TCS)') {
      const payloadT = telemetry?.thermal?.payloadTempC;
      const cpuLoad = telemetry?.compute?.cpuPercent;
      if (payloadT != null) list.push({ parameter: 'Payload Temperature', value: `${payloadT.toFixed(1)} °C`, correlation: 'Thermal conductive soak from avionics bay' });
      if (cpuLoad != null) list.push({ parameter: 'CPU Utilization', value: `${cpuLoad.toFixed(0)} %`, correlation: 'Compute workload thermal dissipation factor' });
    } else if (profile.subsystem === 'Power (EPS)') {
      const v = telemetry?.power?.voltageV;
      const soc = telemetry?.power?.batteryPercent;
      const load = telemetry?.power?.consumptionW;
      if (v != null) list.push({ parameter: 'Bus Voltage', value: `${v.toFixed(1)} V`, correlation: 'Ohmic drop across distribution harness' });
      if (soc != null) list.push({ parameter: 'Battery SoC', value: `${soc.toFixed(1)} %`, correlation: 'Depletion rate proportional to power deficit' });
      if (load != null) list.push({ parameter: 'Active Load', value: `${load.toFixed(0)} W`, correlation: 'Current draw from avionics bus' });
    } else if (profile.subsystem === 'Communication') {
      const dr = telemetry?.comm?.dataRateMbps;
      const lat = telemetry?.comm?.latencyMs;
      if (dr != null) list.push({ parameter: 'Data Rate', value: `${dr.toFixed(2)} Mbps`, correlation: 'Adaptive modulation throttling due to low Eb/N0' });
      if (lat != null) list.push({ parameter: 'Latency', value: `${lat.toFixed(0)} ms`, correlation: 'ARQ packet retransmission overhead' });
    } else if (profile.subsystem === 'ADCS / Guidance') {
      const rate = telemetry?.attitude?.angularVelDegS;
      if (rate != null) list.push({ parameter: 'Angular Slew Rate', value: `${rate.toFixed(2)} °/s`, correlation: 'Momentum dumping failure creating body torque' });
    }

    return list;
  }

  private buildRootCauseAssessment(
    profile: TelemetryParameterProfile,
    val: number,
    severity: string,
    supporting: Array<{ parameter: string; value: string; correlation: string }>
  ): RootCauseAssessment {
    if (profile.subsystem === 'Thermal (TCS)') {
      return {
        observedEvidence: `Thermal sensor ${profile.displayName} reads ${val.toFixed(1)} ${profile.unit}, exceeding allowable envelope.`,
        suspectedCause: 'Excessive thermal dissipation or radiator heat-pipe circulation degradation.',
        supportingParameters: supporting,
        differentialDiagnosis: 'Differential check: rule out solar angle direct illumination vs processor runaway before hardware isolation.',
        recommendedNextStep: 'Engage secondary radiator cooling loop, throttle non-essential instrument processing, and re-point solar arrays.',
      };
    } else if (profile.subsystem === 'Power (EPS)') {
      return {
        observedEvidence: `${profile.displayName} reads ${val.toFixed(1)} ${profile.unit}, triggering ${severity} bus undervoltage.`,
        suspectedCause: 'Solar array shadow occlusion, cell string disconnect, or short-circuit power bus fault.',
        supportingParameters: supporting,
        differentialDiagnosis: 'Differentiate eclipse entry from solar array drive assembly (SADA) mechanical jam.',
        recommendedNextStep: 'Shed non-critical payload loads, command battery conditioning, and verify solar array sun tracking angle.',
      };
    } else if (profile.subsystem === 'Communication') {
      return {
        observedEvidence: `RF link parameter ${profile.displayName} degraded to ${val.toFixed(1)} ${profile.unit}.`,
        suspectedCause: 'Ground station line-of-sight elevation loss, antenna pointing jitter, or atmospheric attenuation.',
        supportingParameters: supporting,
        differentialDiagnosis: 'Distinguish transponder amplifier hardware trip from physical antenna misalignment.',
        recommendedNextStep: 'Switch to omnidirectional low-gain antenna (LGA) safe beacon and re-execute ground tracking lock.',
      };
    } else {
      return {
        observedEvidence: `${profile.displayName} parameter variance (${val.toFixed(1)} ${profile.unit}) outside nominal bounds.`,
        suspectedCause: 'External environmental disturbance or mechanical subsystem deviation.',
        supportingParameters: supporting,
        differentialDiagnosis: 'Evaluate sensor calibration drift versus true mechanical failure.',
        recommendedNextStep: 'Run subsystem self-test, verify telemetry correlation, and prepare safe mode profile.',
      };
    }
  }

  private syncStoreIncident(anomaly: ExplainableAnomaly) {
    const store = useMissionStore.getState();
    const incident: Incident = {
      id: anomaly.id,
      mission_day: store.missionDay || 1,
      normalized_fault_category: anomaly.affectedSubsystem,
      normalized_subsystem: anomaly.affectedSubsystem,
      severity: anomaly.severity,
      status: 'detected',
      description: anomaly.explanation,
      detection_time: anomaly.timestamp,
      recovery_mode: 'ai',
      procedures: [
        {
          id: `PROC-${anomaly.parameterId}`,
          fault_type: anomaly.parameterId,
          name: `Autonomous Mitigation: ${anomaly.affectedSubsystem}`,
          description: anomaly.recommendedAction,
          steps: [
            'Isolate non-essential subsystem loads',
            'Cross-strap redundant secondary bus',
            'Verify 3-sigma telemetry stabilization',
          ],
          estimated_time_s: 30,
          success_probability: 0.95,
          risk_level: anomaly.severity === 'critical' ? 'high' : 'medium',
        },
      ],
      confidence: anomaly.confidence,
    };
    store.addIncident(incident);
  }

  private updateStoreIncidentResolved(anomaly: ExplainableAnomaly) {
    const store = useMissionStore.getState();
    const inc = store.incidents.find((i) => i.id === anomaly.id);
    if (inc) {
      inc.status = 'resolved';
      inc.recovery_end = anomaly.beforeAfter.recoveryResolvedTime;
    }
  }
}

export const anomalyPipeline = new AnomalyPipelineService();
