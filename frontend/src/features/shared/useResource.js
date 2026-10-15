import { useCallback, useEffect, useState } from "react";
import apiClient from "../../services/apiClient";

export function apiError(error) {
  const message = error.response?.data?.message;
  return Array.isArray(message)
    ? message.join(" ")
    : message || "Unable to complete the request. Please try again.";
}
// A null path skips fetching (for example, guest choices for customer accounts).
// Changing the path or calling reload starts a fresh authenticated request.
export function useResource(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    apiClient
      .get(path, { signal: controller.signal })
      .then((response) => {
        setData(response.data);
        setError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(apiError(error));
        }
      });
    // Cancel obsolete requests when filters change or the component unmounts.
    return () => controller.abort();
  }, [path, revision]);
  return { data, error, reload };
}
