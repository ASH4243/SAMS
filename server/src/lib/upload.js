"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const multer = require("multer");
const { AppError } = require("./errors");
const { projectRoot } = require("../config/env");

const uploadDirectory = path.resolve(
  projectRoot,
  process.env.UPLOAD_DIR || path.join("server", "uploads"),
);
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
}).single("photo");

function identifyImage(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return { mime: "image/jpeg", ext: ".jpg" };
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { mime: "image/png", ext: ".png" };
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", ext: ".webp" };
  }
  return null;
}

function validateImage(file) {
  if (!file || !file.buffer)
    throw new AppError(400, "Choose a JPG, PNG, or WebP photo to upload.");
  const actual = identifyImage(file.buffer);
  const extension = path.extname(file.originalname || "").toLowerCase();
  const allowedExtensions =
    actual && (actual.ext === ".jpg" ? [".jpg", ".jpeg"] : [actual.ext]);
  if (
    !actual ||
    !allowedExtensions.includes(extension) ||
    file.mimetype !== actual.mime
  ) {
    throw new AppError(
      400,
      "The photo content, MIME type, and file extension must match (JPG, PNG, or WebP).",
    );
  }
  return actual;
}

async function savePhoto(file) {
  const actual = validateImage(file);
  await fs.mkdir(uploadDirectory, { recursive: true });
  const filename = `${crypto.randomUUID()}${actual.ext}`;
  await fs.writeFile(path.join(uploadDirectory, filename), file.buffer, {
    flag: "wx",
  });
  return { filename, mime: actual.mime };
}

async function removePhoto(filename) {
  if (!filename || !/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(filename)) return;
  await fs
    .rm(path.join(uploadDirectory, filename), { force: true })
    .catch(() => {});
}

function resolvePhoto(filename) {
  if (!filename || !/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(filename))
    return null;
  const target = path.resolve(uploadDirectory, filename);
  if (!target.startsWith(`${uploadDirectory}${path.sep}`)) return null;
  return target;
}

module.exports = {
  imageUpload,
  validateImage,
  savePhoto,
  removePhoto,
  resolvePhoto,
  uploadDirectory,
};
