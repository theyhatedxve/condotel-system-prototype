// Static presentation values; controls do not create or update business records.
import { Plus } from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { formatDate } from "../../utils/format";
const filters = [
  {
    label: "All",
    value: "",
  },
  {
    label: "Confirmed",
    value: "CONFIRMED",
  },
  {
    label: "Pending",
    value: "PENDING",
  },
  {
    label: "Checked In",
    value: "CHECKED_IN",
  },
  {
    label: "Checked Out",
    value: "CHECKED_OUT",
  },
];
export default function ReservationsPage() {
  const reservations = [
    {
      id: "sample-reservation",
      referenceNo: "SAMPLE-001",
      guest: {
        id: "sample-guest",
        firstName: "Sample",
        lastName: "Guest",
        email: "guest@example.test",
        phone: "",
        status: "ACTIVE",
      },
      room: { roomNumber: "101" },
      checkIn: "2026-10-07T00:00:00Z",
      checkOut: "2026-10-09T00:00:00Z",
      totalAmountCentavos: 500000,
      status: "CONFIRMED",
    },
  ];
  const statusFilter = "";
  return (
    <section className="reservations-page">
      <header className="reservations-header">
        <div>
          <h1>Reservations</h1>

          <p>Manage bookings and room availability.</p>
        </div>

        <button type="button" className="primary-button" disabled>
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
            disabled
          >
            {filter.label}
          </button>
        ))}
      </div>

      {
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
              {reservations.map((reservation) => (
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
                      className={`reservation-status ${reservation.status.toLowerCase()}`}
                    >
                      {reservation.status}
                    </span>
                  </td>

                  <td>
                    <div className="reservation-actions">
                      {reservation.status === "PENDING" && (
                        <button type="button" disabled>
                          Pay
                        </button>
                      )}

                      {["PENDING", "CONFIRMED"].includes(
                        reservation.status,
                      ) && (
                        <button type="button" disabled>
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    </section>
  );
}
