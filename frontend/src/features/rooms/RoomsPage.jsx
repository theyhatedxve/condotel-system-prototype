import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { apiError, useResource } from "../shared/useResource";
import { WorkflowDialog, WorkflowForm } from "../shared/WorkflowForm";
import apiClient from "../../services/apiClient";
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
function RoomCard({ room, canManage, onEdit, onToggle }) {
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
              <button
                type="button"
                title="Edit room"
                disabled={!canManage}
                onClick={() => onEdit(room)}
              >
                <Pencil size={15} />
              </button>

              {room.isActive ? (
                <button
                  type="button"
                  title="Deactivate room"
                  disabled={!canManage}
                  onClick={() => onToggle(room)}
                >
                  <Power size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  title="Reactivate room"
                  disabled={!canManage}
                  onClick={() => onToggle(room)}
                >
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
  const { user } = useAuth();
  const canManage = ["STAFF", "ADMIN"].includes(user.role);
  const { data, error, reload } = useResource("/rooms");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [actionError, setActionError] = useState("");
  const rooms = (data || []).filter(
    (room) => !statusFilter || room.status === statusFilter,
  );
  async function toggle(room) {
    try {
      await apiClient.patch("/rooms/" + room.id, { isActive: !room.isActive });
      reload();
      setActionError("");
    } catch (failure) {
      setActionError(apiError(failure));
    }
  }
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
            disabled={!canManage}
            onClick={() =>
              setEditing({ capacity: 2, ratePerNightCentavos: 250000 })
            }
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
            onClick={() => setStatusFilter(filter.value)}
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
            <RoomCard
              key={room.id}
              room={room}
              canManage={canManage}
              onEdit={setEditing}
              onToggle={toggle}
            />
          ))}
        </div>
      )}
      {(error || actionError) && <p role="alert">{error || actionError}</p>}
      {editing && (
        <WorkflowDialog
          title={editing.id ? "Edit Room" : "Add Room"}
          onClose={() => setEditing(null)}
        >
          <WorkflowForm
            initial={{
              ...editing,
              status:
                editing.status === "OCCUPIED" ? "AVAILABLE" : editing.status,
            }}
            fields={[
              ...(!editing.id
                ? [
                    {
                      name: "roomNumber",
                      label: "Room number",
                      required: true,
                      maxLength: 30,
                    },
                    {
                      name: "roomType",
                      label: "Room type",
                      required: true,
                      maxLength: 100,
                    },
                    {
                      name: "floor",
                      label: "Floor (optional)",
                      type: "number",
                      min: -10,
                      max: 200,
                    },
                    {
                      name: "capacity",
                      label: "Capacity",
                      type: "number",
                      required: true,
                      min: 1,
                      max: 50,
                    },
                  ]
                : [
                    {
                      name: "status",
                      label: "Availability",
                      required: true,
                      options: [
                        { value: "AVAILABLE", label: "Available" },
                        { value: "MAINTENANCE", label: "Maintenance" },
                      ],
                    },
                  ]),
              {
                name: "ratePerNightCentavos",
                label: "Nightly rate (centavos)",
                type: "number",
                required: true,
                min: 100,
                max: 5000000,
              },
            ]}
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              if (editing.id)
                await apiClient.patch("/rooms/" + editing.id, {
                  ratePerNightCentavos: Number(values.ratePerNightCentavos),
                  status: values.status,
                });
              else
                await apiClient.post("/rooms", {
                  roomNumber: values.roomNumber,
                  roomType: values.roomType,
                  capacity: Number(values.capacity),
                  floor:
                    values.floor === undefined || values.floor === ""
                      ? undefined
                      : Number(values.floor),
                  ratePerNightCentavos: Number(values.ratePerNightCentavos),
                });
              setEditing(null);
              reload();
            }}
          />
        </WorkflowDialog>
      )}
    </section>
  );
}
