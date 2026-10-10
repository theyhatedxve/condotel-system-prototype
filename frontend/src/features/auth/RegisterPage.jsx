import { useState } from "react";
import { Link } from "react-router-dom";
import { WorkflowForm } from "../shared/WorkflowForm";
import { accountFields } from "../shared/contactFields";
import apiClient from "../../services/apiClient";
export default function RegisterPage() {
  const [created, setCreated] = useState(false);
  return (
    <main className="registration-shell">
      <section className="workflow-panel">
        <h1>Create Account</h1>
        {created ? (
          <p role="status">
            Your account is ready. Sign in to make a reservation.
          </p>
        ) : (
          <WorkflowForm
            fields={accountFields}
            submitLabel="Create account"
            onSubmit={async (values) => {
              await apiClient.post("/auth/register", values);
              setCreated(true);
            }}
          />
        )}
        <Link to="/login">Sign in</Link>
      </section>
    </main>
  );
}
