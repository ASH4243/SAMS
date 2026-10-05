"use strict";

const path = require("node:path");
const dotenv = require("dotenv");

const projectRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(projectRoot, ".env") });

module.exports = { projectRoot };
