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
