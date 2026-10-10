import { useResource } from "../shared/useResource";
import { BedDouble, CalendarCheck, CreditCard, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { formatCurrency } from "../../utils/format";
import { formatDate } from "../../utils/format";
function getStatusClass(status) {
  return status.toLowerCase().replaceAll("_", "-");
}
function formatStatus(status) {
  return status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error } = useResource("/dashboard");
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Loading dashboard...</p>;
  const { statistics, occupancy, recentReservations } = data;
  const cards = [
    {
      title: "Total Rooms",
      value: statistics.totalRooms,
      detail: `${occupancy.availableRooms} available`,
      icon: BedDouble,
      className: "blue",
    },
    {
      title: "Current Guests",
      value: statistics.currentGuests,
      detail: `${occupancy.occupancyPercent}% occupancy`,
      icon: Users,
      className: "green",
    },
    {
      title: "Today's Check-ins",
      value: statistics.todayCheckIns,
      detail: `${statistics.todayCheckOuts ?? 0} check-outs today`,
      icon: CalendarCheck,
      className: "orange",
    },
    {
      title: "Today's Payments",
      value: formatCurrency(statistics.todayPaymentsCentavos),
      detail: `${statistics.todayPaymentCount ?? 0} paid payment(s)`,
      icon: CreditCard,
      className: "purple",
    },
  ];
  return (
    <section className="dashboard-page">
      <header className="dashboard-header">
        <h1>Welcome, {user?.firstName || "Admin"}!</h1>

        <p>Here's what's happening with your condotel today.</p>
      </header>

      <div className="stat-grid">
        {cards.map(({ title, value, detail, icon: Icon, className }) => (
          <article key={title} className={`stat-card ${className}`}>
            <div>
              <span className="stat-title">{title}</span>

              <strong>{value}</strong>

              <small>{detail}</small>
            </div>

            <Icon size={30} />
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-panel reservations-panel">
          <div className="panel-heading">
            <h2>Recent Reservations</h2>

            <button
              type="button"
              onClick={() => navigate("/admin/reservations")}
            >
              View all
            </button>
          </div>

          {recentReservations.length === 0 ? (
            <div className="dashboard-empty">No reservations found.</div>
          ) : (
            <div className="table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Guest Name</th>

                    <th>Room</th>

                    <th>Check-in</th>

                    <th>Check-out</th>

                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {recentReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>
                        {reservation.guest.firstName}{" "}
                        {reservation.guest.lastName}
                      </td>

                      <td>Room {reservation.room.roomNumber}</td>

                      <td>{formatDate(reservation.checkIn)}</td>

                      <td>{formatDate(reservation.checkOut)}</td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            reservation.status,
                          )}`}
                        >
                          {formatStatus(reservation.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="dashboard-panel occupancy-panel">
          <h2>Room Occupancy</h2>

          <div
            className="occupancy-circle"
            style={{
              "--occupancy": `${occupancy.occupancyPercent}%`,
            }}
          >
            <div>
              <strong>{occupancy.occupancyPercent}%</strong>

              <span>Occupied</span>
            </div>
          </div>

          <div className="occupancy-legend">
            <span>
              <i className="occupied-dot" />
              Occupied
              <strong>{occupancy.occupiedRooms}</strong>
            </span>

            <span>
              <i className="available-dot" />
              Available
              <strong>{occupancy.availableRooms}</strong>
            </span>

            <span>
              <i className="maintenance-dot" />
              Maintenance
              <strong>{occupancy.maintenanceRooms}</strong>
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}
