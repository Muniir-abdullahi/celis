"use client";

import { useEffect, useState } from "react";
import { fetchRolePermissions, updateRolePermissions } from "~/server/auth.functions";
import { permissionsChanged } from "~/lib/role-permissions";

export function useRolePermissions(role: string, canManage: boolean) {
  const [data, setData] = useState({ role: "", keys: [] as string[], original: [] as string[] });
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attempt, retry] = useState(0);
  const loading = pending || data.role !== role;
  const dirty = !loading && permissionsChanged(data.keys, data.original);

  useEffect(() => {
    let active = true;
    setPending(true); setError(""); setSaved(false);
    if (!role) { setPending(false); setData({ role, keys: [], original: [] }); return; }
    fetchRolePermissions({ data: { role } }).then((keys) => {
      if (active) setData({ role, keys, original: keys });
    }).catch(() => {
      if (active) { setData({ role, keys: [], original: [] }); setError("Permissions could not be loaded. Please try again."); }
    }).finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [role, attempt]);

  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  const toggle = (key: string) => {
    if (!canManage || loading || saving || (error && !dirty) || role === "super_admin") return;
    setSaved(false);
    setData((value) => ({ ...value, keys: value.keys.includes(key) ? value.keys.filter((item) => item !== key) : [...value.keys, key] }));
  };
  const reset = () => { setData((value) => ({ ...value, keys: [...value.original] })); setSaved(false); setError(""); };
  const save = async () => {
    if (!canManage || loading || saving || !dirty || role === "super_admin") return;
    setSaving(true); setSaved(false); setError("");
    try {
      const keys = await updateRolePermissions({ data: { role, permissionKeys: data.keys } });
      setData({ role, keys, original: keys }); setSaved(true);
    } catch { setError("Changes could not be saved. Your selections are still here; please try again."); }
    finally { setSaving(false); }
  };
  return { keys: data.role === role ? data.keys : [], loading, saving, saved, error, dirty, toggle, reset, save, retry: () => retry((value) => value + 1) };
}
