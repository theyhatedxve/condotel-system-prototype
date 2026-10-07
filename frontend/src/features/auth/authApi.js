// Authentication requests return backend data for the provider and password form.
// Password verification and Argon2id hashing happen on the backend, not in React.
import apiClient from "../../services/apiClient";

export async function loginUser(credentials) {
  return (await apiClient.post("/auth/login", credentials)).data;
}

export async function getCurrentUser() {
  return (await apiClient.get("/auth/me")).data;
}

export async function changeMyPassword(payload) {
  return (await apiClient.post("/auth/change-password", payload)).data;
}
