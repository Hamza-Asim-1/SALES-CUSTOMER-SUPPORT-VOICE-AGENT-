"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { login, logout } from "@/app/store/features/authSlice";
import { RootState } from "@/app/store/store";
import { fetchCurrentUser } from "@/lib/apis/authApi";

export function useAuth(requireAuth = true) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token && (!isAuthenticated || !user?.id)) {
      fetchCurrentUser(token)
        .then((profile) => {
          dispatch(
            login({
              user: {
                id: profile.id,
                name: profile.username,
                email: profile.email,
              },
              token,
            })
          );
        })
        .catch(() => {
          localStorage.removeItem("token");
          dispatch(logout());
          if (requireAuth) {
            router.push("/login");
          }
        });
    } else if (!token && requireAuth) {
      router.push("/login");
    }
  }, [dispatch, isAuthenticated, requireAuth, router, user?.id]);

  return { isAuthenticated, user };
}
