import { useCallback, useEffect, useState } from "react";

export default function AdminLink() {
  const [isAdmin, setIsAdmin] = useState(false);

  const check = useCallback(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setIsAdmin(data.isAdmin));
  }, []);

  useEffect(() => {
    check();
    window.addEventListener("pageshow", check);
    return () => window.removeEventListener("pageshow", check);
  }, [check]);

  if (!isAdmin) return null;

  return <a href="/admin">Admin</a>;
}
