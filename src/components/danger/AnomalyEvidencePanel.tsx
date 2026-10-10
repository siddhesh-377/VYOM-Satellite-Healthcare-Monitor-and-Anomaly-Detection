import React from 'react';
import { ExplainableAnomaly } from '../../engines/AnomalyPipelineEngine';

interface AnomalyEvidencePanelProps {
  anomaly?: ExplainableAnomaly;
  onInitiateRecovery?: () => void;
  onAskAI?: (prompt: string) => void;
}

export function AnomalyEvidencePanel({
  anomaly,
  onInitiateRecovery,
  onAskAI,
}: AnomalyEvidencePanelProps) {
  if (!anomaly) {
    return (
      <div
        style={{
          background: 'rgba(5, 14, 30, 0.85)',
          border: '1px solid rgba(0, 212, 255, 0.15)',
          borderRadius: 8,
          padding: '24px',
          textAlign: 'center',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>🛡️</div>
        <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
          NO ACTIVE ANOMALY DETECTED
        </div>
        <p style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', margin: 0 }}>
          All spacecraft telemetry channels are operating within nominal baseline flight envelopes. Trigger a danger scenario to observe the multi-tier anomaly detection pipeline.
        </p>
      </div>
    );
  }

  const isCritical = anomaly.severity === 'critical';
  const severityColor = isCritical ? '#ff2d55' : '#ff9500';

  const statusBg =
    anomaly.status === 'resolved'
      ? 'rgba(0, 255, 136, 0.15)'
      : anomaly.status === 'recovering'
      ? 'rgba(0, 212, 255, 0.15)'
      : isCritical
      ? 'rgba(255, 45, 85, 0.15)'
      : 'rgba(255, 149, 0, 0.15)';

  const statusColor =
    anomaly.status === 'resolved'
      ? '#00ff88'
      : anomaly.status === 'recovering'
      ? '#00d4ff'
      : severityColor;

  return (
    <div
      style={{
        background: 'rgba(5, 14, 30, 0.92)',
        border: `1px solid ${severityColor}40`,
        borderRadius: 8,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        backdropFilter: 'blur(16px)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${severityColor}15`,
      }}
    >
      {/* ── Event Summary Header ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: 12,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9,
                fontWeight: 700,
                color: severityColor,
                background: `${severityColor}20`,
                padding: '2px 8px',
                borderRadius: 3,
                border: `1px solid ${severityColor}50`,
                letterSpacing: '0.12em',
              }}
            >
              {anomaly.severity.toUpperCase()} ANOMALY
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9,
                color: statusColor,
                background: statusBg,
                padding: '2px 8px',
                borderRadius: 3,
                border: `1px solid ${statusColor}40`,
                letterSpacing: '0.12em',
                fontWeight: 700,
              }}
            >
              STATUS: {anomaly.status.toUpperCase()}
            </span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)' }}>
              ID: {anomaly.id}
            </span>
          </div>

          <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
            {anomaly.parameterName} Excursion
          </div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, color: 'rgba(0, 212, 255, 0.8)', marginTop: 2 }}>
            Subsystem: {anomaly.affectedSubsystem} · Detection Method: {anomaly.detectionMethod.toUpperCase()}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {anomaly.status !== 'resolved' && onInitiateRecovery && (
            <button
              onClick={onInitiateRecovery}
              style={{
                background: 'rgba(0, 255, 136, 0.15)',
                border: '1px solid #00ff88',
                borderRadius: 4,
                color: '#00ff88',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9.5,
                fontWeight: 700,
                padding: '6px 12px',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                transition: 'all 0.2s ease',
              }}
            >
              🛡️ INITIATE RECOVERY
            </button>
          )}

          {onAskAI && (
            <button
              onClick={() => onAskAI(`Explain the root cause and recommended procedure for anomaly ${anomaly.id} on ${anomaly.parameterName}.`)}
              style={{
                background: 'rgba(155, 93, 229, 0.2)',
                border: '1px solid #9b5de5',
                borderRadius: 4,
                color: '#ffffff',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9.5,
                fontWeight: 700,
                padding: '6px 12px',
                cursor: 'pointer',
                letterSpacing: '0.1em',
              }}
            >
              ◉ ASK VYOM AI
            </button>
          )}
        </div>
      </div>

      {/* ── Measured Evidence Table ── */}
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9,
            letterSpacing: '0.14em',
            color: 'rgba(0, 212, 255, 0.75)',
            marginBottom: 8,
            fontWeight: 700,
          }}
        >
          MEASURED TELEMETRY EVIDENCE COMPARISON
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.45)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '6px 10px' }}>PARAMETER</th>
                <th style={{ padding: '6px 10px' }}>CURRENT VALUE</th>
                <th style={{ padding: '6px 10px' }}>BASELINE / RANGE</th>
                <th style={{ padding: '6px 10px' }}>TRIGGERED LIMIT</th>
                <th style={{ padding: '6px 10px' }}>DEVIATION</th>
                <th style={{ padding: '6px 10px' }}>EVALUATION</th>
              </tr>
            </thead>
            <tbody>
              {anomaly.measuredEvidence.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: idx === 0 ? 'rgba(255, 45, 85, 0.05)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '6px 10px', color: '#ffffff', fontWeight: idx === 0 ? 700 : 400 }}>
                    {row.parameterName}
                  </td>
                  <td style={{ padding: '6px 10px', color: idx === 0 ? severityColor : '#ffffff', fontWeight: 700 }}>
                    {row.currentValue.toFixed(1)} {row.unit}
                  </td>
                  <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.6)' }}>
                    {row.expectedRange}
                  </td>
                  <td style={{ padding: '6px 10px', color: idx === 0 ? severityColor : 'rgba(255,255,255,0.6)' }}>
                    {row.triggeredLimit}
                  </td>
                  <td style={{ padding: '6px 10px', color: idx === 0 ? '#ff9500' : 'rgba(255,255,255,0.5)' }}>
                    {row.deviation > 0 ? `+${row.deviation.toFixed(1)}` : row.deviation.toFixed(1)} {row.unit} ({row.deviationPercent}%)
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontSize: 8.5,
                        fontWeight: 700,
                        background:
                          row.result === 'Critical'
                            ? 'rgba(255, 45, 85, 0.2)'
                            : row.result === 'Warning'
                            ? 'rgba(255, 149, 0, 0.2)'
                            : 'rgba(0, 255, 136, 0.15)',
                        color:
                          row.result === 'Critical'
                            ? '#ff2d55'
                            : row.result === 'Warning'
                            ? '#ff9500'
                            : '#00ff88',
                      }}
                    >
                      {row.result.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detection Explanation ── */}
      <div
        style={{
          background: 'rgba(2, 6, 14, 0.75)',
          border: '1px solid rgba(0, 212, 255, 0.15)',
          borderRadius: 6,
          padding: '12px 14px',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: '#00d4ff', letterSpacing: '0.12em', marginBottom: 4, fontWeight: 700 }}>
          DETECTION EXPLANATION
        </div>
        <p style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 11.5, color: 'rgba(255, 255, 255, 0.85)', margin: 0, lineHeight: 1.5 }}>
          {anomaly.explanation}
        </p>
      </div>

      {/* ── Root-Cause Assessment & Differential Diagnosis ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: '#ff9500', letterSpacing: '0.1em', marginBottom: 4 }}>
            SUSPECTED ROOT CAUSE
          </div>
          <p style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 11, color: '#ffffff', margin: '0 0 6px 0', lineHeight: 1.4 }}>
            {anomaly.rootCause.suspectedCause}
          </p>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
            {anomaly.rootCause.differentialDiagnosis}
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: '#00ff88', letterSpacing: '0.1em', marginBottom: 4 }}>
            RECOMMENDED DIAGNOSTIC ACTION
          </div>
          <p style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 11, color: '#ffffff', margin: 0, lineHeight: 1.4 }}>
            {anomaly.rootCause.recommendedNextStep}
          </p>
        </div>
      </div>

      {/* ── Before & After Telemetry Statistics ── */}
      <div
        style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(0, 212, 255, 0.12)',
          borderRadius: 6,
          padding: '12px 14px',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(0, 212, 255, 0.8)', letterSpacing: '0.12em', marginBottom: 8, fontWeight: 700 }}>
          BEFORE-AND-AFTER ANOMALY METRICS
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>PRE-ANOMALY BASELINE</div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, fontWeight: 700, color: '#00d4ff' }}>
              {anomaly.beforeAfter.preAnomalyBaseline.toFixed(1)} {anomaly.unit}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>PEAK VALUE OBSERVED</div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, fontWeight: 700, color: severityColor }}>
              {anomaly.beforeAfter.peakValueDuringEvent.toFixed(1)} {anomaly.unit}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>PEAK DEVIATION</div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, fontWeight: 700, color: '#ff9500' }}>
              {anomaly.beforeAfter.peakDeviation.toFixed(1)} {anomaly.unit}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>POST-RECOVERY VALUE</div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, fontWeight: 700, color: anomaly.isRecovered ? '#00ff88' : 'rgba(255,255,255,0.5)' }}>
              {anomaly.beforeAfter.postRecoveryValue != null ? `${anomaly.beforeAfter.postRecoveryValue.toFixed(1)} ${anomaly.unit}` : 'Pending'}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>RECOVERY CRITERIA</div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, fontWeight: 700, color: anomaly.beforeAfter.recoveryCriteriaMet ? '#00ff88' : '#ff9500', marginTop: 2 }}>
              {anomaly.beforeAfter.recoveryCriteriaMet ? 'PASSED (STABILIZED)' : 'IN PROGRESS'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
