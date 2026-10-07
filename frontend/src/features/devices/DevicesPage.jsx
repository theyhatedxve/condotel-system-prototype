import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import apiClient from "../../services/apiClient";
import "./devices.css";

function errorMessage(error) {
  const message = error.response?.data?.message;
  return Array.isArray(message)
    ? message.join(" ")
    : typeof message === "string"
      ? message
      : "Unable to reach the server. Refresh the device list before trying again.";
}

export default function DevicesPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [deviceName, setDeviceName] = useState("");
  const [provisioning, setProvisioning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isAdmin = user.role === "ADMIN";

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    apiClient
      .get("/devices")
      .then(({ data }) => {
        if (!cancelled) setDevices(data);
      })
      .catch((error) => {
        if (!cancelled) setError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function register(event) {
    event.preventDefault();
    if (saving || provisioning) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await apiClient.post("/devices", {
        deviceName: deviceName.trim(),
      });
      setDevices((current) => [data.device, ...current]);
      setProvisioning(data);
      setDeviceName("");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="devices-page">
      <header>
        <h1>Device Management</h1>
        <p>Register door devices and securely store their device secrets.</p>
      </header>
      {!isAdmin ? (
        <p role="status">
          Only administrators can register and view door devices.
        </p>
      ) : (
        <>
          {error && (
            <p className="device-error" role="alert">
              {error}
            </p>
          )}
          <form className="device-panel device-register" onSubmit={register}>
            <label htmlFor="device-name">
              Device Name
              <input
                id="device-name"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                placeholder="e.g. Room 101 Door"
                maxLength={100}
                required
                disabled={saving || !!provisioning}
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={
                loading || saving || !!provisioning || !deviceName.trim()
              }
            >
              {saving ? "Registering..." : "Register Door Device"}
            </button>
          </form>
          {provisioning && (
            <section
              className="device-panel device-provisioning"
              aria-labelledby="provisioning-title"
            >
              <h2 id="provisioning-title">
                Device registered: {provisioning.device.deviceName}
              </h2>
              <p>
                Save the device ID and secret securely for provisioning the door
                controller. The secret is shown only now and cannot be viewed
                again after closing or leaving this page.
              </p>
              <label>
                Device ID
                <input
                  readOnly
                  value={provisioning.device.deviceId}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <label>
                Device Secret
                <textarea
                  readOnly
                  value={provisioning.deviceSecret}
                  rows={2}
                  spellCheck={false}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <button
                className="primary-button"
                type="button"
                onClick={() => setProvisioning(null)}
              >
                I have saved the device secret
              </button>
            </section>
          )}
          <div className="device-panel device-list">
            <h2>Registered Devices</h2>
            {loading ? (
              <p role="status">Loading devices...</p>
            ) : devices.length === 0 ? (
              <p>No door devices registered.</p>
            ) : (
              <div className="device-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Device Name</th>
                      <th>Device ID</th>
                      <th>Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device) => (
                      <tr key={device.deviceId}>
                        <td>{device.deviceName}</td>
                        <td>{device.deviceId}</td>
                        <td>{new Date(device.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
