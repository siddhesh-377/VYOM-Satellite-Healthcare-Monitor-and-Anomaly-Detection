import React, { useState } from 'react';
import { ExplainableAnomaly } from '../../engines/AnomalyPipelineEngine';

interface AnomalyTimelineLogProps {
  anomaly?: ExplainableAnomaly;
  allAnomalies: ExplainableAnomaly[];
  onSelectAnomaly: (anomaly: ExplainableAnomaly) => void;
}

export function AnomalyTimelineLog({
  anomaly,
  allAnomalies,
  onSelectAnomaly,
}: AnomalyTimelineLogProps) {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'warning' | 'critical'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'resolved'>('all');

  const filteredAnomalies = allAnomalies.filter((a) => {
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    if (filterStatus === 'active' && a.status === 'resolved') return false;
    if (filterStatus === 'resolved' && a.status !== 'resolved') return false;
    return true;
  });

  return (
    <div
      style={{
        background: 'rgba(5, 14, 30, 0.85)',
        border: '1px solid rgba(0, 212, 255, 0.18)',
        borderRadius: 8,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header and Filter Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: 10,
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(0, 212, 255, 0.75)', letterSpacing: '0.14em' }}>
            BLACK BOX ANOMALY EVENT LOG & TIMELINE
          </div>
          <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
            Event Audit Trail ({allAnomalies.length} total)
          </div>
        </div>

        {/* Severity & Status Filter Pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'warning', 'critical'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterSeverity(s)}
              style={{
                background: filterSeverity === s ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${filterSeverity === s ? '#00d4ff' : 'rgba(255,255,255,0.1)'}`,
                color: filterSeverity === s ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8.5,
                padding: '3px 8px',
                borderRadius: 3,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {s}
            </button>
          ))}
          {(['all', 'active', 'resolved'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                background: filterStatus === st ? 'rgba(0, 255, 136, 0.2)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${filterStatus === st ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
                color: filterStatus === st ? '#00ff88' : 'rgba(255,255,255,0.5)',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8.5,
                padding: '3px 8px',
                borderRadius: 3,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 14 }}>
        {/* Left: Filtered Anomalies List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {filteredAnomalies.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: 16, textAlign: 'center' }}>
              No anomaly events match current filter.
            </div>
          ) : (
            filteredAnomalies.map((a) => {
              const isSelected = anomaly?.id === a.id;
              const sevCol = a.severity === 'critical' ? '#ff2d55' : '#ff9500';
              return (
                <div
                  key={a.id}
                  onClick={() => onSelectAnomaly(a)}
                  style={{
                    padding: '8px 10px',
                    background: isSelected ? 'rgba(0, 212, 255, 0.12)' : 'rgba(0,0,0,0.35)',
                    border: `1px solid ${isSelected ? '#00d4ff' : 'rgba(255,255,255,0.06)'}`,
                    borderLeft: `3px solid ${sevCol}`,
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, fontWeight: 700, color: sevCol }}>
                      {a.parameterName}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 8,
                        color: a.status === 'resolved' ? '#00ff88' : '#00d4ff',
                        background: a.status === 'resolved' ? 'rgba(0,255,136,0.1)' : 'rgba(0,212,255,0.1)',
                        padding: '1px 5px',
                        borderRadius: 2,
                      }}
                    >
                      {a.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 10, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.explanation}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Detailed Stage Progression for Selected Anomaly */}
        <div
          style={{
            background: 'rgba(2, 6, 14, 0.75)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '10px 12px',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(0, 212, 255, 0.8)', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>
            EVENT PROGRESSION TIMELINE STAGES ({anomaly ? anomaly.parameterName : 'Select Anomaly'})
          </div>

          {!anomaly ? (
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9.5, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: 20 }}>
              Select an anomaly event to inspect its 10-stage progression timeline.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
              {anomaly.timeline.map((step, idx) => {
                return (
                  <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: step.status === 'completed' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(0, 212, 255, 0.2)',
                        border: `1px solid ${step.status === 'completed' ? '#00ff88' : '#00d4ff'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 8,
                        color: step.status === 'completed' ? '#00ff88' : '#00d4ff',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {step.stageNumber}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9.5, fontWeight: 700, color: '#ffffff' }}>
                          {step.stageName}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-body, sans-serif)', fontSize: 9.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3, marginTop: 1 }}>
                        {step.description}
                      </div>
                      {step.telemetryRef && (
                        <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, color: '#00d4ff', marginTop: 2 }}>
                          TELEMETRY EVIDENCE REF: {step.telemetryRef}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
