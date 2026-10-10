import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
} from 'recharts';
import { useMissionStore } from '../../store/missionStore';
import {
  TELEMETRY_PARAMETER_PROFILES,
  TelemetryParameterProfile,
  extractParameterValue,
} from '../../config/telemetryProfiles';
import { ExplainableAnomaly } from '../../engines/AnomalyPipelineEngine';

interface TelemetryAnomalyGraphProps {
  selectedParamId?: string;
  onSelectParamId?: (id: string) => void;
  activeAnomaly?: ExplainableAnomaly;
  onInspectCrossing?: (sample: any) => void;
}

export function TelemetryAnomalyGraph({
  selectedParamId = 'cpuTempC',
  onSelectParamId,
  activeAnomaly,
  onInspectCrossing,
}: TelemetryAnomalyGraphProps) {
  const telemetryHistory = useMissionStore((s) => s.telemetryHistory);
  const [internalParamId, setInternalParamId] = useState<string>(selectedParamId);
  const [timeWindow, setTimeWindow] = useState<'30s' | '60s' | '120s' | 'all'>('60s');

  const paramId = onSelectParamId ? selectedParamId : internalParamId;
  const setParamId = onSelectParamId || setInternalParamId;

  const profile: TelemetryParameterProfile =
    TELEMETRY_PARAMETER_PROFILES[paramId] || TELEMETRY_PARAMETER_PROFILES.cpuTempC;

  // Build chart dataset from real telemetry history
  const chartData = useMemo(() => {
    if (!telemetryHistory || telemetryHistory.length === 0) return [];

    let sliceCount = 60;
    if (timeWindow === '30s') sliceCount = 30;
    else if (timeWindow === '60s') sliceCount = 60;
    else if (timeWindow === '120s') sliceCount = 120;
    else sliceCount = telemetryHistory.length;

    const sliced = telemetryHistory.slice(-sliceCount);
    const firstTime = sliced[0]?.timestamp || Date.now();

    return sliced.map((t, idx) => {
      const val = extractParameterValue(t, profile.subsystemPath);
      const relativeSec = Math.round(((t.timestamp || Date.now()) - firstTime) / 1000);
      const isWarn = profile.isInverted
        ? profile.warningLimits?.min != null && val != null && val <= profile.warningLimits.min
        : profile.warningLimits?.max != null && val != null && val >= profile.warningLimits.max;
      const isCrit = profile.isInverted
        ? profile.criticalLimits?.min != null && val != null && val <= profile.criticalLimits.min
        : profile.criticalLimits?.max != null && val != null && val >= profile.criticalLimits.max;

      return {
        index: idx,
        timestamp: t.timestamp || Date.now(),
        timeLabel: `T+${relativeSec}s`,
        value: val !== undefined ? Number(val.toFixed(2)) : null,
        baseline: profile.nominalValue,
        warningLimit: profile.isInverted ? profile.warningLimits?.min : profile.warningLimits?.max,
        criticalLimit: profile.isInverted ? profile.criticalLimits?.min : profile.criticalLimits?.max,
        isWarning: isWarn,
        isCritical: isCrit,
      };
    });
  }, [telemetryHistory, profile, timeWindow]);

  const currentVal = chartData.length > 0 ? chartData[chartData.length - 1].value : profile.nominalValue;

  // Determine anomaly interval bounds for shading
  const anomalyInterval = useMemo(() => {
    if (!activeAnomaly || activeAnomaly.parameterId !== paramId) return null;
    const startIdx = chartData.findIndex((d) => d.timestamp >= activeAnomaly.beforeAfter.startTime);
    const endIdx = activeAnomaly.beforeAfter.recoveryResolvedTime
      ? chartData.findIndex((d) => d.timestamp >= activeAnomaly.beforeAfter.recoveryResolvedTime!)
      : chartData.length - 1;

    if (startIdx >= 0 && endIdx >= startIdx) {
      return {
        x1: chartData[startIdx].timeLabel,
        x2: chartData[endIdx]?.timeLabel || chartData[chartData.length - 1]?.timeLabel,
      };
    }
    return null;
  }, [activeAnomaly, paramId, chartData]);

  // Detection point label
  const detectionPoint = useMemo(() => {
    if (!activeAnomaly || activeAnomaly.parameterId !== paramId) return null;
    const pt = chartData.find((d) => Math.abs(d.timestamp - activeAnomaly.timestamp) < 2500);
    return pt ? pt.timeLabel : null;
  }, [activeAnomaly, paramId, chartData]);

  const warnLimit = profile.isInverted ? profile.warningLimits?.min : profile.warningLimits?.max;
  const critLimit = profile.isInverted ? profile.criticalLimits?.min : profile.criticalLimits?.max;

  // Domain range calculation
  const yDomain = useMemo(() => {
    const vals = chartData.map((d) => d.value).filter((v): v is number => v != null);
    if (vals.length === 0) return ['auto', 'auto'];
    const minVal = Math.min(...vals, profile.nominalRange.min, warnLimit ?? Infinity, critLimit ?? Infinity);
    const maxVal = Math.max(...vals, profile.nominalRange.max, warnLimit ?? -Infinity, critLimit ?? -Infinity);
    const padding = (maxVal - minVal) * 0.15 || 5;
    return [Math.floor(minVal - padding), Math.ceil(maxVal + padding)];
  }, [chartData, profile, warnLimit, critLimit]);

  return (
    <div
      style={{
        background: 'rgba(5, 14, 30, 0.85)',
        border: '1px solid rgba(0, 212, 255, 0.2)',
        borderRadius: 8,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header & Parameter Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: activeAnomaly?.parameterId === paramId
                ? (activeAnomaly.severity === 'critical' ? '#ff2d55' : '#ff9500')
                : '#00d4ff',
              boxShadow: activeAnomaly?.parameterId === paramId
                ? (activeAnomaly.severity === 'critical' ? '0 0 10px #ff2d55' : '0 0 10px #ff9500')
                : '0 0 6px #00d4ff',
            }}
          />
          <div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(0, 212, 255, 0.75)', letterSpacing: '0.14em' }}>
              TIME-SERIES TELEMETRY INSPECTOR · {profile.subsystem.toUpperCase()}
            </div>
            <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
              {profile.displayName}
            </div>
          </div>
        </div>

        {/* Controls: Selector & Time Window */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Parameter Picker */}
          <select
            value={paramId}
            onChange={(e) => setParamId(e.target.value)}
            style={{
              background: 'rgba(2, 6, 14, 0.9)',
              border: '1px solid rgba(0, 212, 255, 0.35)',
              borderRadius: 4,
              color: '#00d4ff',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              padding: '5px 10px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {Object.values(TELEMETRY_PARAMETER_PROFILES).map((p) => (
              <option key={p.id} value={p.id} style={{ background: '#020409', color: '#fff' }}>
                {p.displayName} ({p.unit})
              </option>
            ))}
          </select>

          {/* Time Window Buttons */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['30s', '60s', '120s', 'all'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                style={{
                  background: timeWindow === w ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                  border: 'none',
                  color: timeWindow === w ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 9,
                  padding: '3px 7px',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                {w}
              </button>
            ))}
          </div>

          {/* Current Reading Badge */}
          <div
            style={{
              padding: '4px 10px',
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 4,
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11,
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            {currentVal != null ? currentVal.toFixed(1) : '--'} <span style={{ fontSize: 9, color: '#00d4ff' }}>{profile.unit}</span>
          </div>
        </div>
      </div>

      {/* Threshold Legends */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--font-mono, monospace)', fontSize: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)' }}>
          <span style={{ width: 14, height: 2, backgroundColor: '#00d4ff' }} />
          <span>Nominal Baseline ({profile.nominalValue} {profile.unit})</span>
        </div>
        {warnLimit != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ff9500' }}>
            <span style={{ width: 14, height: 2, borderTop: '2px dashed #ff9500' }} />
            <span>Warning Limit ({warnLimit} {profile.unit})</span>
          </div>
        )}
        {critLimit != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ff2d55' }}>
            <span style={{ width: 14, height: 2, borderTop: '2px dashed #ff2d55' }} />
            <span>Critical Limit ({critLimit} {profile.unit})</span>
          </div>
        )}
        {anomalyInterval && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ff2d55' }}>
            <span style={{ width: 10, height: 10, backgroundColor: 'rgba(255, 45, 85, 0.15)', border: '1px solid rgba(255, 45, 85, 0.4)', borderRadius: 2 }} />
            <span>Active Anomaly Interval</span>
          </div>
        )}
      </div>

      {/* Recharts Live Chart */}
      <div style={{ width: '100%', height: 210, minHeight: 210 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 18, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="timeLabel"
              stroke="rgba(255,255,255,0.35)"
              tick={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)' }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain as any}
              stroke="rgba(255,255,255,0.35)"
              tick={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)' }}
              tickFormatter={(v) => `${v}`}
              width={42}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(2, 6, 14, 0.95)',
                border: '1px solid rgba(0, 212, 255, 0.35)',
                borderRadius: 6,
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}
              formatter={(val: any) => [`${val} ${profile.unit}`, profile.displayName]}
              labelFormatter={(label) => `Simulation Time: ${label}`}
            />

            {/* Shaded Anomaly Interval */}
            {anomalyInterval && (
              <ReferenceArea
                x1={anomalyInterval.x1}
                x2={anomalyInterval.x2}
                fill="rgba(255, 45, 85, 0.12)"
                stroke="rgba(255, 45, 85, 0.35)"
                strokeDasharray="2 2"
              />
            )}

            {/* Nominal Baseline Reference Line */}
            <ReferenceLine
              y={profile.nominalValue}
              stroke="#00d4ff"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{ value: 'BASELINE', fill: '#00d4ff', fontSize: 8, position: 'insideTopLeft' }}
            />

            {/* Warning Limit Reference Line */}
            {warnLimit != null && (
              <ReferenceLine
                y={warnLimit}
                stroke="#ff9500"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{ value: 'WARN', fill: '#ff9500', fontSize: 8, position: 'insideTopRight' }}
              />
            )}

            {/* Critical Limit Reference Line */}
            {critLimit != null && (
              <ReferenceLine
                y={critLimit}
                stroke="#ff2d55"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{ value: 'CRIT', fill: '#ff2d55', fontSize: 8, position: 'insideTopRight' }}
              />
            )}

            {/* Detection Marker Line */}
            {detectionPoint && (
              <ReferenceLine
                x={detectionPoint}
                stroke="#ff2d55"
                strokeWidth={2}
                label={{ value: 'DETECTION', fill: '#ff2d55', fontSize: 8, position: 'top' }}
              />
            )}

            {/* Telemetry Waveform */}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#00d4ff"
              strokeWidth={2}
              fill="url(#areaGradient)"
              isAnimationActive={false}
              dot={(props: any) => {
                if (props.payload.isCritical) {
                  return (
                    <circle
                      key={props.key}
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill="#ff2d55"
                      stroke="#fff"
                      strokeWidth={1}
                      onClick={() => onInspectCrossing && onInspectCrossing(props.payload)}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                }
                if (props.payload.isWarning) {
                  return (
                    <circle
                      key={props.key}
                      cx={props.cx}
                      cy={props.cy}
                      r={3.5}
                      fill="#ff9500"
                      stroke="#fff"
                      strokeWidth={1}
                      onClick={() => onInspectCrossing && onInspectCrossing(props.payload)}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                }
                return <React.Fragment key={props.key} />;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
