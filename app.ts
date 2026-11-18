import path from "path";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cookieSession from "cookie-session";
import { env } from "./src/config/env";
import routes from "./src/routes";

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "blob:"],
        "worker-src": ["'self'", "blob:"],
        "upgrade-insecure-requests": null,
      },
    },
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use(
  cookieSession({
    name: "ympos",
    keys: [env.sessionSecret],
    httpOnly: true,
    sameSite: "lax",
    secure: env.prod,
    maxAge: 12 * 60 * 60 * 1000,
  }),
);

app.use((req, res, next) => {
  res.locals.user = req.session?.staffId ? req.session : null;
  next();
});

app.use(express.static(path.join(process.cwd(), "public")));

app.use(
  "/vendor/html5-qrcode",
  express.static(path.join(process.cwd(), "node_modules/html5-qrcode")),
);

app.use(routes);

app.use((req, res) =>
  res.status(404).render("error", {
    message: "Halaman tidak ditemukan",
  }),
);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  if (req.originalUrl.startsWith("/api/")) {
    return res.status(500).json({
      error: "Terjadi kesalahan server",
    });
  }

  res.status(500).render("error", {
    message: "Terjadi kesalahan server",
  });
});

export default app;
