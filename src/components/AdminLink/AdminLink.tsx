import { useEffect, useState } from "react";

export default function AdminLink() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setIsAdmin(data.isAdmin));
  }, []);

  if (!isAdmin) return null;

  return <a href="/admin">Admin</a>;
}
