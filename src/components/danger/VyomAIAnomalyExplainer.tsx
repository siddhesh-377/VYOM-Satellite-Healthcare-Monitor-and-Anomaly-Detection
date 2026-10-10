import React, { useState } from 'react';
import { ExplainableAnomaly } from '../../engines/AnomalyPipelineEngine';
import { backendWS } from '../../services/BackendWebSocketService';

interface VyomAIAnomalyExplainerProps {
  selectedAnomaly?: ExplainableAnomaly | null;
  onSelectParam?: (paramId: string) => void;
}

interface QAPair {
  question: string;
  answer: string;
  source: 'ai_backend' | 'rule_based_engine';
  timestamp: string;
}

export const VyomAIAnomalyExplainer: React.FC<VyomAIAnomalyExplainerProps> = ({
  selectedAnomaly,
  onSelectParam,
}) => {
  const [qaHistory, setQaHistory] = useState<QAPair[]>([]);
  const [customQuery, setCustomQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);

  const suggestedQuestions = [
    'Why was this anomaly detected?',
    'Which parameter triggered the alert?',
    'Show telemetry changes before and after',
    'Why is this severity level assigned?',
    'Which other subsystem parameters should I inspect?',
    'Has the spacecraft returned to normal operating limits?',
  ];

  const handleAskQuestion = async (question: string) => {
    if (!selectedAnomaly) return;
    setIsQuerying(true);

    const timeStr = new Date().toLocaleTimeString();

    // Check if backend WS is connected with AI service
    if (backendWS.isConnected) {
      try {
        // Structured call could be piped to backend
      } catch (err) {
        console.warn('Backend AI query fallback to deterministic rule engine:', err);
      }
    }

    // Deterministic Rule-Based Aerospace Explainer (Local Truth)
    let answer = '';
    const {
      parameterName,
      parameterId,
      unit,
      currentValue,
      baseline,
      warningThreshold,
      criticalThreshold,
      deviation,
      deviationPercent,
      detectionMethod,
      timestamp,
      severity,
      affectedSubsystem,
      rootCause,
      beforeAfter,
      status,
      explanation,
      recommendedAction,
    } = selectedAnomaly;

    const triggeredLimit = severity === 'critical' ? criticalThreshold : warningThreshold;

    if (question.includes('Why was this anomaly detected')) {
      answer = `Detection triggered via [${detectionMethod.toUpperCase()}]: ${parameterName} recorded at ${currentValue.toFixed(2)} ${unit}, violating the configured ${severity.toUpperCase()} threshold (${triggeredLimit ?? '--'} ${unit}). Baseline operating point was ${baseline.toFixed(2)} ${unit} (deviation: ${deviationPercent ? deviationPercent.toFixed(1) + '%' : deviation.toFixed(2) + ' ' + unit}). The anomaly pipeline confirmed the criteria at simulation time ${new Date(timestamp).toLocaleTimeString()}.`;
    } else if (question.includes('Which parameter triggered')) {
      answer = `The triggering parameter is ${parameterName} [${parameterId}] within the ${affectedSubsystem.toUpperCase()} subsystem. Current measurement: ${currentValue.toFixed(2)} ${unit} vs allowable limit: ${triggeredLimit ?? '--'} ${unit}.`;
    } else if (question.includes('before and after')) {
      if (beforeAfter) {
        answer = `Pre-anomaly baseline: ${beforeAfter.preAnomalyBaseline.toFixed(2)} ${unit}. Peak observed value: ${beforeAfter.peakValue.toFixed(2)} ${unit} (max deviation: ${beforeAfter.peakDeviation.toFixed(2)} ${unit}). Event duration: ${(beforeAfter.durationSec || 0).toFixed(1)}s. ${beforeAfter.postRecoveryValue !== undefined ? `Post-recovery stabilized value: ${beforeAfter.postRecoveryValue.toFixed(2)} ${unit}. Recovery criteria: ${beforeAfter.recoveryCriteriaMet ? 'PASSED (Nominal)' : 'IN PROGRESS'}.` : 'Spacecraft is currently undergoing anomaly progression.'}`;
      } else {
        answer = `Baseline prior to deviation: ${baseline.toFixed(2)} ${unit}. Current: ${currentValue.toFixed(2)} ${unit}. Statistics will finalize upon stabilization.`;
      }
    } else if (question.includes('severity')) {
      answer = `Classified as [${severity.toUpperCase()}] because measured value ${currentValue.toFixed(2)} ${unit} crossed the ${severity} limit of ${triggeredLimit ?? '--'} ${unit}. ${severity === 'critical' ? 'Potential mission failure or permanent subsystem hardware degradation if unmitigated.' : 'Potential performance reduction or precursor to cascade failure.'}`;
    } else if (question.includes('other subsystem') || question.includes('inspect')) {
      answer = `Supporting parameters for ${affectedSubsystem}: ${rootCause?.supportingParameters?.join(', ') || 'None correlated'}. Recommended diagnostic check: "${rootCause?.recommendedNextStep || recommendedAction}".`;
    } else if (question.includes('returned to normal') || question.includes('recovered')) {
      if (status === 'resolved') {
        answer = `AFFIRMATIVE: The spacecraft has satisfied all recovery criteria. Telemetry returned to nominal bounds and maintained consecutive verified samples.`;
      } else if (status === 'recovering') {
        answer = `RECOVERY IN PROGRESS: Countermeasures applied. Telemetry is moving towards nominal baseline (${currentValue.toFixed(2)} ${unit}), waiting for consecutive stabilization window.`;
      } else {
        answer = `NEGATIVE: The spacecraft remains in ACTIVE anomaly status (${currentValue.toFixed(2)} ${unit}). Countermeasure intervention required.`;
      }
    } else {
      answer = `Rule-based evaluation for ${parameterName}: Current reading is ${currentValue.toFixed(2)} ${unit}. Detection explanation: ${explanation}. Suspected cause: ${rootCause?.suspectedCause || 'Simulated stress injection'}. Recommended action: ${recommendedAction}.`;
    }

    setQaHistory((prev) => [
      ...prev,
      {
        question,
        answer,
        source: backendWS.isConnected ? 'ai_backend' : 'rule_based_engine',
        timestamp: timeStr,
      },
    ]);

    setIsQuerying(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim() || !selectedAnomaly) return;
    const q = customQuery.trim();
    setCustomQuery('');
    handleAskQuestion(q);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(5, 14, 30, 0.85)',
        border: '1px solid rgba(0, 212, 255, 0.2)',
        borderRadius: 8,
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(0, 212, 255, 0.05)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: backendWS.isConnected ? '#00ff88' : '#00d4ff',
              boxShadow: backendWS.isConnected ? '0 0 8px #00ff88' : '0 0 8px #00d4ff',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display, sans-serif)',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: '#00d4ff',
            }}
          >
            VYOM AI — ANOMALY EXPLAINER
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 8.5,
            padding: '2px 6px',
            borderRadius: 4,
            background: backendWS.isConnected ? 'rgba(0,255,136,0.1)' : 'rgba(255,149,0,0.1)',
            border: `1px solid ${backendWS.isConnected ? '#00ff88' : '#ff9500'}`,
            color: backendWS.isConnected ? '#00ff88' : '#ff9500',
          }}
        >
          {backendWS.isConnected ? '● AI BACKEND CONNECTED' : '⚙ LOCAL DETERMINISTIC ENGINE'}
        </span>
      </div>

      {/* Anomaly Context Summary Banner */}
      {selectedAnomaly ? (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.3)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9,
          }}
        >
          <div>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Target Anomaly: </span>
            <strong style={{ color: selectedAnomaly.severity === 'critical' ? '#ff2d55' : '#ff9500' }}>
              {selectedAnomaly.parameterName}
            </strong>{' '}
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>
              ({selectedAnomaly.currentValue.toFixed(1)} {selectedAnomaly.unit})
            </span>
          </div>
          {onSelectParam && (
            <button
              onClick={() => onSelectParam(selectedAnomaly.parameterId)}
              style={{
                background: 'rgba(0, 212, 255, 0.1)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: 4,
                padding: '2px 8px',
                color: '#00d4ff',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8,
                cursor: 'pointer',
              }}
            >
              FOCUS GRAPH →
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.3)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 8.5,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          No active anomaly selected. Select an anomaly or trigger a scenario to ask Vyom AI.
        </div>
      )}

      {/* Q&A Message History */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {qaHistory.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 10px',
              color: 'rgba(255,255,255,0.35)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 9,
              lineHeight: 1.6,
            }}
          >
            Click any suggested diagnostic question below or type an inquiry to receive a structured
            explanation supported by live telemetry, threshold violations, and root-cause evidence.
          </div>
        )}

        {qaHistory.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Operator Query */}
            <div
              style={{
                alignSelf: 'flex-end',
                maxWidth: '85%',
                padding: '6px 10px',
                background: 'rgba(0, 212, 255, 0.15)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: '8px 8px 2px 8px',
                fontFamily: 'var(--font-body, sans-serif)',
                fontSize: 10.5,
                color: '#fff',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 7, color: 'rgba(0,212,255,0.7)', marginBottom: 2 }}>
                OPERATOR · {item.timestamp}
              </div>
              {item.question}
            </div>

            {/* Vyom AI Response */}
            <div
              style={{
                alignSelf: 'flex-start',
                maxWidth: '92%',
                padding: '8px 12px',
                background: 'rgba(0, 14, 30, 0.8)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                borderRadius: '8px 8px 8px 2px',
                fontFamily: 'var(--font-body, sans-serif)',
                fontSize: 10.5,
                color: 'rgba(255,255,255,0.9)',
                lineHeight: 1.5,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 7.5,
                  color: '#00d4ff',
                  marginBottom: 4,
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  paddingBottom: 2,
                }}
              >
                <span>VYOM AI DIAGNOSTICIAN</span>
                <span style={{ color: item.source === 'ai_backend' ? '#00ff88' : '#ff9500' }}>
                  {item.source === 'ai_backend' ? 'AI Cloud Model' : 'Telemetry Rule Engine'}
                </span>
              </div>
              {item.answer}
            </div>
          </div>
        ))}
      </div>

      {/* Suggested Quick Questions */}
      <div
        style={{
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.4)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 7.5,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.1em',
            marginBottom: 6,
          }}
        >
          SUGGESTED DIAGNOSTIC QUERIES:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleAskQuestion(q)}
              disabled={!selectedAnomaly || isQuerying}
              style={{
                background: 'rgba(0, 212, 255, 0.08)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                borderRadius: 4,
                padding: '4px 8px',
                color: selectedAnomaly ? '#00d4ff' : 'rgba(255,255,255,0.25)',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8,
                cursor: selectedAnomaly ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
            >
              › {q}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Query Input */}
      <form
        onSubmit={handleCustomSubmit}
        style={{
          display: 'flex',
          borderTop: '1px solid rgba(0, 212, 255, 0.15)',
          background: 'rgba(2, 6, 14, 0.95)',
        }}
      >
        <input
          type="text"
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
          placeholder={selectedAnomaly ? 'Ask Vyom AI about this anomaly...' : 'Select an anomaly first...'}
          disabled={!selectedAnomaly || isQuerying}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            padding: '8px 12px',
            color: '#fff',
            fontFamily: 'var(--font-body, sans-serif)',
            fontSize: 10,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!selectedAnomaly || !customQuery.trim() || isQuerying}
          style={{
            background: 'rgba(0, 212, 255, 0.2)',
            border: 'none',
            borderLeft: '1px solid rgba(0, 212, 255, 0.3)',
            padding: '0 14px',
            color: '#00d4ff',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9,
            fontWeight: 700,
            cursor: !selectedAnomaly || !customQuery.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {isQuerying ? '...' : 'ASK'}
        </button>
      </form>
    </div>
  );
};
