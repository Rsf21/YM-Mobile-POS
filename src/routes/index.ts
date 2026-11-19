import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireAdmin, requireBazaar } from "../middleware/auth";

import {
  loginPage,
  login,
  logout,
  adminLoginPage,
  adminLogin,
} from "../../controllers/auth.controller";

import {
  posPage,
  apiByPlu,
  apiSearch,
  apiBazaarItems,
} from "../../controllers/pos.controller";

import {
  apiCheckout,
  receiptPage,
  historyPage,
} from "../../controllers/sale.controller";

import {
  productPage,
  updateProduct,
} from "../../controllers/product.controller";

import {
  bazaarListPage,
  bazaarCreate,
  bazaarSelect,
  recapPage,
  bazaarClose,
  apiBazaarRecap,
  apiBazaarClose,
  bazaarInvoicePdf,
} from "../../controllers/bazaar.controller";

import {
  itemsPage,
  apiCatalog,
  itemAdd,
  itemUpdate,
} from "../../controllers/item.controller";

import {
  adminDashboard,
  adminBazaarList,
  adminDeleteBazaar,
} from "../../controllers/admin.controller";

const wrap = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const r = Router();

const inBazaar = [requireAuth, wrap(requireBazaar)];

r.get("/login", loginPage);
r.post("/login", loginLimiter, wrap(login));

r.get("/acikiwir", adminLoginPage);
r.post("/acikiwir", loginLimiter, wrap(adminLogin));

r.post("/logout", logout);

r.get("/bazar", requireAuth, wrap(bazaarListPage));
r.post("/bazar", requireAuth, wrap(bazaarCreate));
r.post("/bazar/:id/pilih", requireAuth, wrap(bazaarSelect));

r.get("/bazar/:id/rekap", requireAuth, wrap(recapPage));
r.get("/bazar/:id/invoice.pdf", requireAuth, wrap(bazaarInvoicePdf));
r.post("/bazar/:id/tutup", requireAuth, wrap(bazaarClose));

r.get("/", ...inBazaar, posPage);

r.get("/api/bazaar/recap", ...inBazaar, wrap(apiBazaarRecap));
r.post("/api/bazaar/close", ...inBazaar, wrap(apiBazaarClose));

r.get("/api/products/catalog", ...inBazaar, wrap(apiBazaarItems));
r.get("/api/products/plu/:plu", ...inBazaar, wrap(apiByPlu));
r.get("/api/products/search", ...inBazaar, wrap(apiSearch));

r.post("/api/checkout", ...inBazaar, wrap(apiCheckout));

r.get("/barang", ...inBazaar, wrap(itemsPage));
r.get("/api/catalog/plu/:plu", ...inBazaar, wrap(apiCatalog));

r.post("/barang", ...inBazaar, wrap(itemAdd));
r.post("/barang/ubah", ...inBazaar, wrap(itemUpdate));

r.get("/riwayat", requireAuth, wrap(historyPage));

r.get("/about", requireAuth, (req, res) => {
  res.render("about", { active: "about" });
});

r.get("/meet-developer", requireAuth, (req, res) => {
  res.render("meet-developer", {
    active: "meet-developer",
  });
});

r.get("/faq", requireAuth, (req, res) => {
  res.render("faq", {
    active: "faq",
  });
});

r.get("/struk/:id", requireAuth, wrap(receiptPage));

r.get("/produk", requireAuth, requireAdmin, wrap(productPage));
r.post("/produk/ubah", requireAuth, requireAdmin, wrap(updateProduct));

r.get("/admin", requireAuth, requireAdmin, wrap(adminDashboard));
r.get("/admin/bazar", requireAuth, requireAdmin, wrap(adminBazaarList));

r.post(
  "/admin/bazar/:id/hapus",
  requireAuth,
  requireAdmin,
  wrap(adminDeleteBazaar),
);

export default r;
