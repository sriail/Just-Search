import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { readFileSync } from "node:fs";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));
const pagesPath = fileURLToPath(new URL("pages/", import.meta.url));
const imagesPath = fileURLToPath(new URL("images/", import.meta.url));

// Read page templates once at startup
const indexHtml = readFileSync(pagesPath + "index.html");
const settingsHtml = readFileSync(pagesPath + "settings.html");

// Wisp Configuration
logging.set_level(logging.INFO);
Object.assign(wisp.options, {
  dns_servers: ["1.1.1.3", "1.0.0.3"],
});

const fastify = Fastify({
  serverFactory: (handler) => {
    return createServer()
      .on("request", (req, res) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        handler(req, res);
      })
      .on("upgrade", (req, socket, head) => {
        if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
        else socket.end();
      });
  },
});

// Serve public/ as the static root
fastify.register(fastifyStatic, {
  root: publicPath,
  decorateReply: true,
});

// Serve scramjet client assets at /scram/
fastify.register(fastifyStatic, {
  root: scramjetPath,
  prefix: "/scram/",
  decorateReply: false,
});

// Serve libcurl transport assets at /libcurl/
fastify.register(fastifyStatic, {
  root: libcurlPath,
  prefix: "/libcurl/",
  decorateReply: false,
});

// Serve bare-mux assets at /baremux/
fastify.register(fastifyStatic, {
  root: baremuxPath,
  prefix: "/baremux/",
  decorateReply: false,
});

// Serve images from src/images/ at /images/
fastify.register(fastifyStatic, {
  root: imagesPath,
  prefix: "/images/",
  decorateReply: false,
});

// Serve index.html from src/pages/
fastify.get("/", (req, reply) => {
  return reply.type("text/html").send(indexHtml);
});

// Serve settings.html partial
fastify.get("/settings.html", (req, reply) => {
  return reply.type("text/html").send(settingsHtml);
});

fastify.setNotFoundHandler((req, reply) => {
  return reply.code(404).type("text/plain").send("404 Not Found");
});

fastify.server.on("listening", () => {
  const address = fastify.server.address();
  console.log("Listening on:");
  console.log(`\thttp://localhost:${address.port}`);
  console.log(`\thttp://${hostname()}:${address.port}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
  console.log("Shutting down...");
  fastify.close();
  process.exit(0);
}

const port = parseInt(process.env.PORT || "") || 8080;

fastify.listen({
  port: port,
  host: "0.0.0.0",
});
