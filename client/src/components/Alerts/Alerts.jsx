import React, { useCallback, useEffect, useRef, useState } from "react";
import { Siren, AlertCircle, Radio } from "lucide-react";
import PageShell from "../Layout/PageShell";
import { getDashboard } from "../../api/varunaApi";
import { SeverityBadge, PriorityScore } from "../common/Severity";
import "./Alerts.css";

const POLL_MS = 60000;

const Alerts = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(true);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await getDashboard();
      setData(result);
    } catch (err) {
      console.error("Failed to load alerts:", err);
      setError("Couldn't reach the VARUNA analysis service. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!live) return;
    timerRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [live, load]);

  const critical = (data?.top_critical_incidents || []).filter((i) => i.severity === "Critical");
  const high = (data?.top_critical_incidents || []).filter((i) => i.severity === "High");

  return (
    <PageShell noFooter>
      <div className="v-dash-header">
        <div>
          <h1 className="v-dash-title">Critical Alerts</h1>
          <p className="v-dash-subtitle">Highest-severity incidents, refreshed automatically every minute.</p>
        </div>
        <div className="v-dash-header-actions">
          <button
            className={`v-live-toggle ${live ? "on" : ""}`}
            onClick={() => setLive((v) => !v)}
          >
            <Radio size={14} /> {live ? "Live" : "Paused"}
          </button>
        </div>
      </div>

      {error && (
        <div className="v-alert-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button className="v-btn" onClick={load}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="v-skeleton" style={{ height: 200, width: "100%" }} />
      ) : critical.length === 0 && high.length === 0 ? (
        <div className="v-panel">
          <div className="v-empty-state">
            <Siren size={28} style={{ marginBottom: 10, color: "var(--v-sev-low)" }} />
            <h4>No critical or high-severity incidents</h4>
            <p>Everything currently tracked is at Moderate severity or below.</p>
          </div>
        </div>
      ) : (
        <>
          {!!critical.length && (
            <div className="v-panel v-alert-section critical">
              <div className="v-panel-title"><Siren size={17} /> Critical ({critical.length})</div>
              <div className="v-alert-feed">
                {critical.map((incident) => (
                  <AlertRow key={incident.incident_id} incident={incident} />
                ))}
              </div>
            </div>
          )}
          {!!high.length && (
            <div className="v-panel v-alert-section high" style={{ marginTop: 16 }}>
              <div className="v-panel-title"><Siren size={17} /> High ({high.length})</div>
              <div className="v-alert-feed">
                {high.map((incident) => (
                  <AlertRow key={incident.incident_id} incident={incident} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
};

const AlertRow = ({ incident }) => (
  <div className={`v-incident-card v-sev-${incident.severity.toLowerCase()} v-alert-row`}>
    <div className="v-alert-row-top">
      <SeverityBadge severity={incident.severity} size="sm" />
      <PriorityScore score={incident.priority_score} severity={incident.severity} />
    </div>
    <h4>{incident.title}</h4>
    <div className="v-critical-card-meta v-mono">{incident.category} · {incident.source}</div>
    {incident.summary && <p className="v-critical-card-summary">{incident.summary}</p>}
    {!!incident.recommended_actions?.length && (
      <ul className="v-critical-card-actions">
        {incident.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
      </ul>
    )}
  </div>
);

export default Alerts;
