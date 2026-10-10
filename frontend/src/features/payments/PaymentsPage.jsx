import { useState } from "react";
import { useResource } from "../shared/useResource";
import { useAuth } from "../auth/useAuth";
import { WorkflowDialog, WorkflowForm } from "../shared/WorkflowForm";
import apiClient from "../../services/apiClient";
import { formatCurrency, formatDate } from "../../utils/format";
export default function PaymentsPage() {
  const { data, error, reload } = useResource("/payments");
  const { user } = useAuth();
  const [reconcile, setReconcile] = useState(null);
  return (
    <section>
      <header className="reservations-header">
        <div>
          <h1>Payments</h1>
          <p>Reservation payment status.</p>
        </div>
        <button className="primary-button" onClick={reload}>
          Refresh
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="reservation-table-wrapper">
        <table className="reservation-table">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data || []).map((payment) => (
              <tr key={payment.id}>
                <td>{payment.id}</td>
                <td>{formatCurrency(payment.amountCentavos)}</td>
                <td>{payment.status}</td>
                <td>{formatDate(payment.createdAt)}</td>
                <td>
                  {user.role === "ADMIN" && payment.status !== "PAID" && (
                    <button onClick={() => setReconcile(payment)}>
                      Reconcile checkout
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.length === 0 && <p>No payments found.</p>}
      {reconcile && (
        <WorkflowDialog
          title="Reconcile checkout"
          onClose={() => setReconcile(null)}
        >
          <p>
            Enter the matching checkout session ID from PayMongo. The server
            verifies its reference and amount.
          </p>
          <WorkflowForm
            fields={[
              {
                name: "sessionId",
                label: "PayMongo checkout session ID",
                required: true,
              },
            ]}
            onSubmit={async (values) => {
              await apiClient.post(
                `/payments/${reconcile.id}/reconcile`,
                values,
              );
              setReconcile(null);
              reload();
            }}
          />
        </WorkflowDialog>
      )}
    </section>
  );
}
