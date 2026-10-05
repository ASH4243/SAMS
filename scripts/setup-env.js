"use strict";

const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = path.join(root, ".env.example");
const destination = path.join(root, ".env");
if (fs.existsSync(destination)) {
  console.log(".env already exists; leaving it unchanged.");
} else {
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  console.log(
    "Created .env from .env.example. Update DATABASE_URL and JWT_SECRET before starting the app.",
  );
}
