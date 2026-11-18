import "dotenv/config";
import app from "./app";
import { env } from "./src/config/env";

app.listen(env.port, () => {
  console.log(`YM Mobile POS jalan di http://localhost:${env.port}`);
});
