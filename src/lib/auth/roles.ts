import type { AppRole } from "./AuthProvider";

export function roleLabel(role: AppRole) {
  if (role === "admin") return "Admin";
  if (role === "technician") return "Support";
  return "Teacher";
}

export function formatRoleList(roles: AppRole[]) {
  return roles.length ? roles.map(roleLabel).join(", ") : "No role";
}

export function accessSummary(roles: AppRole[]) {
  if (roles.includes("admin")) return "Schools, tickets, users, and full NOC control";
  if (roles.includes("technician")) return "Schools, tickets, and NOC operations";
  return "Teacher portal only";
}