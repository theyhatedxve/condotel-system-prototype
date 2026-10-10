import { useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useResource } from "../shared/useResource";
import { WorkflowDialog, WorkflowForm } from "../shared/WorkflowForm";
import {
  accountFields,
  contactFields,
  contactPayload,
} from "../shared/contactFields";
import apiClient from "../../services/apiClient";

export default function GuestsPage({ users = false }) {
  const { user } = useAuth();
  const allowed = users
    ? user.role === "ADMIN"
    : ["ADMIN", "STAFF"].includes(user.role);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const endpoint = users ? "/users" : "/guests";
  const { data, error, reload } = useResource(
    allowed
      ? endpoint + "?search=" + encodeURIComponent(query) + "&page=" + page
      : null,
  );
  const fields = editing?.id ? contactFields : accountFields;
  const adminFields = users
    ? [
        {
          name: "role",
          label: "Role",
          required: true,
          options: ["CUSTOMER", "STAFF", "ADMIN"].map((value) => ({
            value,
            label: value,
          })),
        },
        ...(editing?.id
          ? [
              {
                name: "status",
                label: "Status",
                required: true,
                options: ["ACTIVE", "INACTIVE", "SUSPENDED"].map((value) => ({
                  value,
                  label: value,
                })),
              },
            ]
          : []),
      ]
    : [];
  if (!allowed)
    return (
      <section>
        <h1>{users ? "User Management" : "Guest Management"}</h1>
        <p>Staff access is required to view these records.</p>
      </section>
    );
  return (
    <section className="guests-page">
      <header className="guests-header">
        <div>
          <h1>{users ? "User Management" : "Guest Management"}</h1>
          <p>Manage registered and walk-in guests.</p>
        </div>
        <div className="workflow-actions">
          {users && (
            <button onClick={() => setImporting(true)}>Import users</button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={() => setEditing({ role: "CUSTOMER" })}
          >
            <Plus size={17} />
            {users ? "Add User" : "Add Guest"}
          </button>
        </div>
      </header>
      <form
        className="guest-search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(search);
        }}
      >
        <Search size={17} />
        <input
          value={search}
          maxLength={255}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email, username, or phone..."
          aria-label="Search guests"
        />
        <button type="submit" className="primary-button">
          Search
        </button>
      </form>
      <p>
        Email and phone require a complete match. Names and usernames support
        partial matches.
      </p>
      {error && (
        <p className="workflow-error" role="alert">
          {error}
        </p>
      )}
      <div className="guest-table-wrapper">
        <table className="guest-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              {users && <th>Role</th>}
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data || []).map((guest) => (
              <tr key={guest.id}>
                <td>
                  {guest.firstName} {guest.lastName}
                </td>
                <td>{guest.email}</td>
                <td>{guest.phone || "-"}</td>
                {users && <td>{guest.role}</td>}
                <td>
                  <span className="guest-active-badge">{guest.status}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="table-icon-button"
                    aria-label={"Edit " + guest.firstName}
                    onClick={() => setEditing(guest)}
                  >
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.length === 0 && <p>No matching accounts.</p>}
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
      </div>
      {editing && (
        <WorkflowDialog
          title={
            editing.id
              ? "Edit contact details"
              : users
                ? "Add User"
                : "Add Guest"
          }
          onClose={() => setEditing(null)}
        >
          {!editing.id && (
            <p>
              The account must change its initial password after signing in.
            </p>
          )}
          <WorkflowForm
            fields={[...fields, ...adminFields]}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              const payload = editing.id
                ? contactPayload(values)
                : {
                    ...contactPayload(values),
                    username: values.username || undefined,
                    password: values.password,
                  };
              if (users) {
                payload.role = values.role;
                if (editing.id) payload.status = values.status;
              }
              if (editing.id)
                await apiClient.patch(endpoint + "/" + editing.id, payload);
              else await apiClient.post(endpoint, payload);
              setEditing(null);
              reload();
            }}
          />
        </WorkflowDialog>
      )}
      {importing && (
        <WorkflowDialog
          title="Import users"
          onClose={() => setImporting(false)}
        >
          <p>
            Paste a JSON array of up to 50 accounts using email, password,
            firstName, lastName, and optional phone, username, role. The entire
            import is cancelled if a record conflicts.
          </p>
          <WorkflowForm
            fields={[
              {
                name: "records",
                label: "Accounts JSON",
                type: "textarea",
                maxLength: 100000,
              },
            ]}
            onSubmit={async (values) => {
              const records = JSON.parse(values.records);
              await apiClient.post("/users/import", { users: records });
              setImporting(false);
              reload();
            }}
          />
        </WorkflowDialog>
      )}
    </section>
  );
}
