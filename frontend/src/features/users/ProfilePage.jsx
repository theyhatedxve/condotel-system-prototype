import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { WorkflowForm } from "../shared/WorkflowForm";
import { contactFields, contactPayload } from "../shared/contactFields";
import apiClient from "../../services/apiClient";
export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [message, setMessage] = useState("");
  return (
    <section className="workflow-panel">
      <h1>My Profile</h1>
      <WorkflowForm
        key={user.updatedAt}
        fields={contactFields}
        initial={user}
        onSubmit={async (values) => {
          await apiClient.patch("/auth/me", contactPayload(values));
          await refreshUser();
          setMessage("Profile updated.");
        }}
      />
      {message && <p role="status">{message}</p>}
    </section>
  );
}
