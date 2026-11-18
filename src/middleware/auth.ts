import { Request, Response, NextFunction } from "express";
import { getOpenBazaar } from "../../models/bazaar.model";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.staffId) return next();
  if (req.originalUrl.startsWith("/api/"))
    return res.status(401).json({ error: "Sesi habis" });
  res.redirect("/login");
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.staffId) {
    if (req.originalUrl.startsWith("/api/")) {
      return res.status(401).json({ error: "Sesi habis" });
    }

    return res.redirect("/login");
  }

  if (req.session.role !== "admin") {
    if (req.originalUrl.startsWith("/api/")) {
      return res.status(403).json({ error: "Khusus admin" });
    }

    return res.status(403).render("error", {
      message: "Khusus admin",
    });
  }

  next();
}

export async function requireBazaar(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.session?.storeId) {
      if (req.originalUrl.startsWith("/api/")) {
        return res.status(403).json({ error: "Akun tidak terhubung ke toko" });
      }

      return res.status(403).render("error", {
        message: "Akun ini tidak terhubung ke toko",
      });
    }

    const id = req.session.bazaarId;
    const bazaar = id ? await getOpenBazaar(req.session.storeId, id) : null;

    if (!bazaar) {
      req.session.bazaarId = null;

      if (req.originalUrl.startsWith("/api/")) {
        return res.status(409).json({ error: "Pilih bazar dulu" });
      }

      return res.redirect("/bazar");
    }

    res.locals.bazaar = bazaar;
    next();
  } catch (e) {
    next(e);
  }
}
