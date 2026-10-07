// Static presentation values; controls do not create or update business records.
import { Pencil, Plus, Search } from "lucide-react";

export default function GuestsPage() {
  const guests = [
    {
      id: "sample-guest",
      firstName: "Sample",
      lastName: "Guest",
      email: "guest@example.test",
      phone: "",
      status: "ACTIVE",
    },
  ];
  const search = "";
  return (
    <section className="guests-page">
      <header className="guests-header">
        <div>
          <h1>Guest Management</h1>

          <p>Manage registered and walk-in guests.</p>
        </div>

        <button type="button" className="primary-button" disabled>
          <Plus size={17} />
          Add Guest
        </button>
      </header>

      <form
        className="guest-search"
        onSubmit={(event) => event.preventDefault()}
      >
        <Search size={17} />

        <input
          value={search}
          placeholder="Search by name, email, username, or phone..."
          disabled
        />

        <button type="submit" className="primary-button" disabled>
          Search
        </button>
      </form>

      {
        <div className="guest-table-wrapper">
          <table className="guest-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {guests.map((guest) => (
                <tr key={guest.id}>
                  <td>
                    {guest.firstName} {guest.lastName}
                  </td>

                  <td>{guest.email}</td>

                  <td>{guest.phone || "-"}</td>

                  <td>
                    <span className="guest-active-badge">{guest.status}</span>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="table-icon-button"
                      disabled
                    >
                      <Pencil size={15} />
                    </button>
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
