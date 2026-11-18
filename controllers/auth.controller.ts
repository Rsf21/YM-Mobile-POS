import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { findStaffByUsername } from "../models/staff.model";

export function loginPage(req: Request, res: Response) {
  if (req.session?.staffId) {
    return res.redirect(req.session.role === "admin" ? "/admin" : "/");
  }

  res.render("login", { error: null });
}

export function adminLoginPage(req: Request, res: Response) {
  if (req.session?.staffId && req.session.role === "admin") {
    return res.redirect("/admin");
  }

  res.render("admin/login", { error: null });
}

export async function login(req: Request, res: Response) {
  const username = String(req.body.username || "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password || "");

  const staff = await findStaffByUsername(username);
  const ok = staff && (await bcrypt.compare(password, staff.password_hash));

  if (!staff || !ok || staff.role === "admin" || !staff.store_id) {
    return res.status(401).render("login", {
      error: "Username atau password salah",
    });
  }

  req.session = {
    staffId: staff.id,
    name: staff.name,
    role: staff.role,
    storeId: staff.store_id,
    storeName: staff.stores?.name ?? "",
  };

  return res.redirect("/");
}

export async function adminLogin(req: Request, res: Response) {
  const username = String(req.body.username || "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password || "");

  const staff = await findStaffByUsername(username);
  const ok = staff && (await bcrypt.compare(password, staff.password_hash));

  if (!ok || staff.role !== "admin") {
    return res.status(401).render("admin/login", {
      error: "Username atau password admin salah",
    });
  }

  req.session = {
    staffId: staff.id,
    name: staff.name,
    role: staff.role,
    storeId: staff.store_id,
    storeName: staff.stores?.name ?? "",
  };

  return res.redirect("/admin");
}

export function logout(req: Request, res: Response) {
  req.session = null;
  res.redirect("/login");
}
