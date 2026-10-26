import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
http
  .createServer(async (req, res) => {
    try {
      const requested = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        root,
        `.${requested === "/" ? "/index.html" : requested}`,
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403);
        return res.end();
      }
      const body = await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(8082, "127.0.0.1", () =>
    console.log("Vista web de Fieldkit: http://127.0.0.1:8082"),
  );
