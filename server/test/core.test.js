"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  attendancePercentage,
  isValidDateOnly,
} = require("../src/lib/attendance");
const { validateImage, resolvePhoto } = require("../src/lib/upload");

test("attendance percentages are calculated consistently and rounded to one decimal place", () => {
  assert.equal(attendancePercentage(35, 40), 87.5);
  assert.equal(attendancePercentage(2, 3), 66.7);
  assert.equal(attendancePercentage(0, 0), 0);
  assert.equal(attendancePercentage(0, 8), 0);
});

test("date-only validation accepts real calendar dates, including leap day", () => {
  assert.equal(isValidDateOnly("2024-02-29"), true);
  assert.equal(isValidDateOnly("2025-02-29"), false);
  assert.equal(isValidDateOnly("2025-13-01"), false);
  assert.equal(isValidDateOnly("2025-2-01"), false);
});

test("photo validation checks real image signatures, MIME, and extension", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  assert.equal(
    validateImage({
      buffer: jpeg,
      originalname: "photo.jpeg",
      mimetype: "image/jpeg",
    }).mime,
    "image/jpeg",
  );
  assert.throws(
    () =>
      validateImage({
        buffer: jpeg,
        originalname: "photo.png",
        mimetype: "image/png",
      }),
    /content, MIME type/,
  );
  assert.equal(resolvePhoto("../../outside.jpg"), null);
  assert.equal(resolvePhoto("not-a-generated-filename.jpg"), null);
});
