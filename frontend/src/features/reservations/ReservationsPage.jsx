import { useState } from "react";
import { Plus } from "lucide-react";
import { formatCurrency, formatDate } from "../../utils/format";
import { useAuth } from "../auth/useAuth";
import { apiError, useResource } from "../shared/useResource";
import { WorkflowDialog, WorkflowForm } from "../shared/WorkflowForm";
import apiClient from "../../services/apiClient";
const filters = [
  { label: "All", value: "" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Pending", value: "PENDING" },
  { label: "Checked In", value: "CHECKED_IN" },
  { label: "Checked Out", value: "CHECKED_OUT" },
];
export default function ReservationsPage() {
  const { user } = useAuth();
  const staff = ["ADMIN", "STAFF"].includes(user.role);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, error, reload } = useResource(
    "/reservations?status=" + statusFilter + "&page=" + page,
  );
  const rooms = useResource("/rooms");
  const guests = useResource(staff ? "/guests" : null);
  const noteFields = [
    {
      name: "specialRequests",
      label: "Special requests (optional)",
      type: "textarea",
    },
    {
      name: "estimatedArrival",
      label: "Estimated arrival (optional)",
      type: "time",
      help: "Added to your reservation notes.",
    },
  ];
  const [today] = useState(() =>
    new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
  );
  async function action(operation) {
    setBusy(true);
    setActionError("");
    try {
      await operation();
      reload();
    } catch (failure) {
      setActionError(apiError(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reservations-page">
      <header className="reservations-header">
        <div>
          <h1>Reservations</h1>
          <p>Manage bookings and room availability.</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => setCreating(true)}
        >
          <Plus size={17} />
          New Reservation
        </button>
      </header>
      <div className="reservation-filters">
        {filters.map((filter) => (
          <button
            key={filter.label}
            type="button"
            className={
              statusFilter === filter.value
                ? "room-filter active"
                : "room-filter"
            }
            onClick={() => {
              setStatusFilter(filter.value);
              setPage(1);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {(error || actionError) && (
        <p className="workflow-error" role="alert">
          {error || actionError}
        </p>
      )}
      <div className="reservation-table-wrapper">
        <table className="reservation-table">
          <thead>
            <tr>
              <th>Reference No.</th>
              <th>Guest</th>
              <th>Room</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((reservation) => (
              <tr key={reservation.id}>
                <td>{reservation.referenceNo}</td>
                <td>
                  {reservation.guest.firstName} {reservation.guest.lastName}
                </td>
                <td>Room {reservation.room.roomNumber}</td>
                <td>{formatDate(reservation.checkIn)}</td>
                <td>{formatDate(reservation.checkOut)}</td>
                <td>{formatCurrency(reservation.totalAmountCentavos)}</td>
                <td>
                  <span
                    className={
                      "reservation-status " + reservation.status.toLowerCase()
                    }
                  >
                    {reservation.status}
                  </span>
                </td>
                <td>
                  <div className="reservation-actions">
                    <button
                      type="button"
                      onClick={() => setEditing(reservation)}
                    >
                      Notes
                    </button>
                    {["PENDING", "CONFIRMED"].includes(reservation.status) && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            action(async () => {
                              const response = await apiClient.post(
                                "/payments/checkout/" + reservation.id,
                              );
                              window.location.assign(response.data.checkoutUrl);
                            })
                          }
                        >
                          Pay
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm("Cancel this reservation?"))
                              void action(() =>
                                apiClient.patch(
                                  "/reservations/" + reservation.id,
                                  { status: "CANCELLED" },
                                ),
                              );
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {staff &&
                      ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(
                        reservation.status,
                      ) && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            action(() =>
                              apiClient.patch(
                                "/reservations/" + reservation.id,
                                {
                                  status: {
                                    PENDING: "CONFIRMED",
                                    CONFIRMED: "CHECKED_IN",
                                    CHECKED_IN: "CHECKED_OUT",
                                  }[reservation.status],
                                },
                              ),
                            )
                          }
                        >
                          {
                            {
                              PENDING: "Confirm",
                              CONFIRMED: "Check in",
                              CHECKED_IN: "Check out",
                            }[reservation.status]
                          }
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.length === 0 && <p>No reservations found.</p>}
      <div className="workflow-pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button
          disabled={!data || data.length < 50}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
        <button onClick={reload}>Refresh</button>
      </div>
      {creating && (
        <WorkflowDialog
          title="New Reservation"
          onClose={() => setCreating(false)}
        >
          {(rooms.error || guests.error) && (
            <p role="alert">{rooms.error || guests.error}</p>
          )}
          <WorkflowForm
            initial={{ adults: 1, children: 0 }}
            fields={[
              {
                name: "roomId",
                label: "Room",
                required: true,
                options: (rooms.data || [])
                  .filter(
                    (room) => room.isActive && room.status !== "MAINTENANCE",
                  )
                  .map((room) => ({
                    value: room.id,
                    label:
                      "Room " +
                      room.roomNumber +
                      " / " +
                      formatCurrency(room.ratePerNightCentavos) +
                      "/night",
                  })),
              },
              ...(staff
                ? [
                    {
                      name: "guestId",
                      label: "Guest (leave empty for yourself)",
                      options: (guests.data || []).map((guest) => ({
                        value: guest.id,
                        label:
                          guest.firstName +
                          " " +
                          guest.lastName +
                          " / " +
                          guest.email,
                      })),
                    },
                  ]
                : []),
              {
                name: "checkIn",
                label: "Check-in",
                type: "date",
                min: today,
                required: true,
              },
              {
                name: "checkOut",
                label: "Check-out",
                type: "date",
                min: today,
                required: true,
              },
              {
                name: "adults",
                label: "Adults",
                type: "number",
                min: 1,
                max: 50,
                required: true,
              },
              {
                name: "children",
                label: "Children",
                type: "number",
                min: 0,
                max: 50,
              },
              ...noteFields,
            ]}
            onCancel={() => setCreating(false)}
            submitLabel="Book reservation"
            onSubmit={async (values) => {
              await apiClient.post("/reservations", {
                ...values,
                guestId: values.guestId || undefined,
                adults: Number(values.adults),
                children: Number(values.children || 0),
                specialRequests: values.specialRequests ?? null,
                estimatedArrival: values.estimatedArrival || undefined,
              });
              setCreating(false);
              reload();
            }}
          />
        </WorkflowDialog>
      )}
      {editing && (
        <WorkflowDialog
          title="Reservation notes"
          onClose={() => setEditing(null)}
        >
          <p className="reservation-notes">
            {editing.specialRequests ?? "No special requests."}
          </p>
          {!["CANCELLED", "CHECKED_OUT"].includes(editing.status) && (
            <WorkflowForm
              fields={noteFields}
              initial={{ specialRequests: editing.specialRequests }}
              onCancel={() => setEditing(null)}
              onSubmit={async (values) => {
                await apiClient.patch("/reservations/" + editing.id, {
                  specialRequests: values.specialRequests || null,
                  estimatedArrival: values.estimatedArrival || undefined,
                });
                setEditing(null);
                reload();
              }}
            />
          )}
        </WorkflowDialog>
      )}
    </section>
  );
}
