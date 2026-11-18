import { Request, Response } from "express";
import {
  getAdminStats,
  listAdminBazaars,
  deleteClosedBazaar,
} from "../models/admin.model";

const rupiah = (value: number) =>
  `Rp ${Math.round(value).toLocaleString("id-ID")}`;

const dateFormat = (value: string | null) => {
  if (!value) return "-";

  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export async function adminDashboard(req: Request, res: Response) {
  const stats = await getAdminStats();

  res.render("admin/dashboard", {
    stats,
    active: "admin",
  });
}

export async function adminBazaarList(req: Request, res: Response) {
  const [stats, bazaars] = await Promise.all([
    getAdminStats(),
    listAdminBazaars(),
  ]);

  res.render("admin/bazaars", {
    stats,
    bazaars,
    rupiah,
    dateFormat,
    active: "admin-bazaars",
    error: req.query.error || null,
    success: req.query.success || null,
  });
}

export async function adminDeleteBazaar(req: Request, res: Response) {
  const id = String(req.params.id || "");

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    return res.redirect("/admin/bazar?error=invalid");
  }

  try {
    const deleted = await deleteClosedBazaar(id);

    if (!deleted) {
      return res.redirect("/admin/bazar?error=failed");
    }

    if (req.session?.bazaarId === id) {
      req.session.bazaarId = null;
    }

    return res.redirect("/admin/bazar?success=deleted");
  } catch (error) {
    console.error("ADMIN DELETE BAZAAR ERROR:", error);

    return res.redirect("/admin/bazar?error=failed");
  }
}
