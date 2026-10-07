export default function PlaceholderPage({ title }) {
  return (
    <section>
      <h1
        style={{
          marginTop: 0,
        }}
      >
        {title}
      </h1>

      <p>
        This page is reserved for interface presentation. No operation is
        connected.
      </p>
    </section>
  );
}
