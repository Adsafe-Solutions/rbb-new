import { createServer } from "node:http";
import { handle } from "./app.ts";

const port = Number(process.env.PORT) || 4000;

createServer(handle).listen(port, () => {
  console.log(`RBB API listening on http://localhost:${port}`);
});
