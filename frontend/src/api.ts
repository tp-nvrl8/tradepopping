export type LoginResponse = {
  token: string;
  email: string;
};

export async function loginRequest(email: string, code: string): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, code }),
  });

  if (!res.ok) {
    // Optional: inspect res.status/res.json for more detail
    throw new Error("Invalid email or code");
  }

  return res.json();
}

// Example protected call we can use later
export async function getSecret(token: string) {
  const res = await fetch("/api/secret", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Not authorized");
  }

  return res.json();
}