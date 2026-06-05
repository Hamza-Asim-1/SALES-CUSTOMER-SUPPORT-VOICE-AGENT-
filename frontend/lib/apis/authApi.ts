export interface AuthUserProfile {
  id: string;
  username: string;
  email: string;
  business_name?: string;
}

const authBaseUrl = () => process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:2000";

export async function fetchCurrentUser(token: string): Promise<AuthUserProfile> {
  const response = await fetch(`${authBaseUrl()}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Could not load user profile");
  }

  return response.json();
}
