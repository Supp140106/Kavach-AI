import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { useLocation } from "react-router-dom";
import { RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import PageShell from "../Layout/PageShell";
import { getAllSources } from "../../api/varunaApi";
import { SeverityBadge, SEVERITY_ORDER } from "../common/Severity";
import "./LiveMap.css";

const SEVERITY_RADIUS = { Low: 6, Moderate: 8, High: 10, Critical: 13 };
const SEVERITY_STROKE = {
  Low: "#16a34a",
  Moderate: "#eab308",
  High: "#f97316",
  Critical: "#dc2626",
};

/** Recenters the map when a specific incident is focused (e.g. from the Dashboard) */
const FlyToIncident = ({ incident }) => {
  const map = useMap();
  useEffect(() => {
    if (incident?.latitude != null && incident?.longitude != null) {
      map.flyTo([incident.latitude, incident.longitude], 6, { duration: 0.8 });
    }
  }, [incident, map]);
  return null;
};

const LiveMap = () => {
  const routerLocation = useLocation();
  const focusId = routerLocation.state?.focusId;

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSeverities, setActiveSeverities] = useState(new Set(SEVERITY_ORDER));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllSources();
      setIncidents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load sources:", err);
      setError("Couldn't reach the VARUNA analysis service. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSeverity = (sev) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      next.has(sev) ? next.delete(sev) : next.add(sev);
      return next;
    });
  };

  const visibleIncidents = useMemo(
    () => incidents.filter((i) => activeSeverities.has(i.severity) && i.latitude != null && i.longitude != null),
    [incidents, activeSeverities]
  );

  const focusIncident = useMemo(
    () => incidents.find((i) => i.id === focusId || i.incident_id === focusId),
    [incidents, focusId]
  );

  const counts = useMemo(() => {
    const out = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
    incidents.forEach((i) => { if (out[i.severity] !== undefined) out[i.severity] += 1; });
    return out;
  }, [incidents]);

  return (
    <PageShell noFooter>
      <div className="v-dash-header">
        <div>
          <h1 className="v-dash-title">Live Map</h1>
          <p className="v-dash-subtitle">
            {loading ? "Loading incidents…" : `${visibleIncidents.length} of ${incidents.length} incidents shown`}
          </p>
        </div>
        <button className="v-btn v-btn-primary" onClick={load} disabled={loading}>
          {loading ? <span className="v-loading-spinner" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="v-alert-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button className="v-btn" onClick={load}>Retry</button>
        </div>
      )}

      <div className="v-map-legend">
        {SEVERITY_ORDER.map((sev) => (
          <button
            key={sev}
            className={`v-map-legend-chip ${activeSeverities.has(sev) ? "active" : ""}`}
            style={{ "--chip-color": SEVERITY_STROKE[sev] }}
            onClick={() => toggleSeverity(sev)}
          >
            <span className="v-map-legend-dot" />
            {sev} <span className="v-mono">({counts[sev]})</span>
          </button>
        ))}
      </div>

      <div className="v-map-frame">
        <MapContainer center={[20, 0]} zoom={2} minZoom={2} worldCopyJump>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {focusIncident && <FlyToIncident incident={focusIncident} />}
          {visibleIncidents.map((incident) => (
            <CircleMarker
              key={incident.id}
              center={[incident.latitude, incident.longitude]}
              radius={SEVERITY_RADIUS[incident.severity] || 7}
              pathOptions={{
                color: SEVERITY_STROKE[incident.severity] || "#64748b",
                fillColor: SEVERITY_STROKE[incident.severity] || "#64748b",
                fillOpacity: 0.55,
                weight: 2,
              }}
            >
              <Popup>
                <div className="v-map-popup">
                  <SeverityBadge severity={incident.severity} size="sm" />
                  <h4>{incident.title}</h4>
                  <div className="v-map-popup-meta v-mono">
                    {incident.category} · {incident.source}
                  </div>
                  {incident.description && (
                    <p className="v-map-popup-desc">{incident.description.slice(0, 220)}</p>
                  )}
                  <div className="v-map-popup-coords v-mono">
                    {incident.latitude?.toFixed(3)}, {incident.longitude?.toFixed(3)}
                  </div>
                  {incident.url && (
                    <a href={incident.url} target="_blank" rel="noopener noreferrer" className="v-map-popup-link">
                      Source <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </PageShell>
  );
};

export default LiveMap;
