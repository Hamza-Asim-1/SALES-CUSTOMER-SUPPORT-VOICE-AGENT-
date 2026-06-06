export interface AuthUserProfile {
  id: string;
  username: string;
  email: string;
  business_name?: string;
}

import { AUTH_API_URL } from "@/lib/api-config";

const authBaseUrl = () => AUTH_API_URL;

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
