// Static presentation values; controls do not create or update business records.
import { Plus } from "lucide-react";
import {
  BedDouble,
  MoreVertical,
  Pencil,
  Power,
  RotateCcw,
  Users,
} from "lucide-react";
import { formatCurrency } from "../../utils/format";
const filters = [
  {
    label: "All",
    value: "",
  },
  {
    label: "Available",
    value: "AVAILABLE",
  },
  {
    label: "Occupied",
    value: "OCCUPIED",
  },
  {
    label: "Maintenance",
    value: "MAINTENANCE",
  },
];
function getStatusClass(status) {
  return status.toLowerCase().replaceAll("_", "-");
}
function RoomCard({ room }) {
  return (
    <article className={`room-card ${!room.isActive ? "inactive" : ""}`}>
      <div className="room-image">
        {room.imageUrl ? (
          <img src={room.imageUrl} alt={`Room ${room.roomNumber}`} />
        ) : (
          <div className="room-image-placeholder">
            <BedDouble size={42} />

            <span>Room {room.roomNumber}</span>
          </div>
        )}

        {!room.isActive && <span className="inactive-overlay">Inactive</span>}
      </div>

      <div className="room-card-body">
        <div className="room-card-heading">
          <div>
            <h3>Room {room.roomNumber}</h3>

            <p>{room.roomType}</p>
          </div>

          <MoreVertical size={18} />
        </div>

        <strong className="room-price">
          {formatCurrency(room.ratePerNightCentavos)}
          <span>/night</span>
        </strong>

        <div className="room-details">
          <span>
            <Users size={14} />
            {room.capacity} guest
            {room.capacity === 1 ? "" : "s"}
          </span>

          {room.floor !== null && <span>Floor {room.floor}</span>}
        </div>

        <div className="room-card-footer">
          <span className={`room-status ${getStatusClass(room.status)}`}>
            {room.status.replaceAll("_", " ")}
          </span>

          {
            <div className="room-actions">
              <button type="button" title="Edit room" disabled>
                <Pencil size={15} />
              </button>

              {room.isActive ? (
                <button type="button" title="Deactivate room" disabled>
                  <Power size={15} />
                </button>
              ) : (
                <button type="button" title="Reactivate room" disabled>
                  <RotateCcw size={15} />
                </button>
              )}
            </div>
          }
        </div>
      </div>
    </article>
  );
}

export default function RoomsPage() {
  const rooms = [
    {
      id: "sample-room-101",
      roomNumber: "101",
      roomType: "Deluxe",
      status: "AVAILABLE",
      isActive: true,
      capacity: 2,
      floor: 1,
      ratePerNightCentavos: 250000,
    },
    {
      id: "sample-room-102",
      roomNumber: "102",
      roomType: "Suite",
      status: "OCCUPIED",
      isActive: true,
      capacity: 4,
      floor: 1,
      ratePerNightCentavos: 400000,
    },
  ];
  const statusFilter = "";
  return (
    <section className="rooms-page">
      <header className="rooms-page-header">
        <div>
          <h1>Room Management</h1>

          <p>Manage condotel rooms, rates, and availability.</p>
        </div>

        {
          <button
            type="button"
            className="primary-button add-room-button"
            disabled
          >
            <Plus size={17} />
            Add Room
          </button>
        }
      </header>

      <div className="room-filter-bar">
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

      {rooms.length === 0 ? (
        <div className="rooms-empty">No rooms found.</div>
      ) : (
        <div className="room-grid">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} true={true} />
          ))}
        </div>
      )}
    </section>
  );
}
