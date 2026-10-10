export const contactFields = [
  {
    name: "firstName",
    label: "First name",
    required: true,
    maxLength: 100,
    autoComplete: "given-name",
  },
  {
    name: "lastName",
    label: "Last name",
    required: true,
    maxLength: 100,
    autoComplete: "family-name",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    required: true,
    maxLength: 255,
    autoComplete: "email",
  },
  {
    name: "phone",
    label: "Phone (optional)",
    maxLength: 30,
    autoComplete: "tel",
  },
];
export const accountFields = [
  ...contactFields,
  {
    name: "username",
    label: "Username (optional)",
    minLength: 3,
    maxLength: 30,
    autoComplete: "username",
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    required: true,
    minLength: 8,
    maxLength: 128,
    autoComplete: "new-password",
  },
];
export function contactPayload(values) {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phone: values.phone || null,
  };
}
