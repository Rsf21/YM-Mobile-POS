import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { findStaffByUsername } from "../models/staff.model";

export function loginPage(req: Request, res: Response) {
  if (req.session?.staffId) return res.redirect("/");
  res.render("login", { error: null });
}

export async function login(req: Request, res: Response) {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const staff = await findStaffByUsername(username);
  const ok = staff && (await bcrypt.compare(password, staff.password_hash));
  if (!ok) return res.status(401).render("login", { error: "Username atau password salah" });
  req.session = {
    staffId: staff.id,
    name: staff.name,
    role: staff.role,
    storeId: staff.store_id,
    storeName: staff.stores?.name ?? "",
  };
  res.redirect("/");
}

export function logout(req: Request, res: Response) {
  req.session = null;
  res.redirect("/login");
}
