"use strict";

const { z } = require("zod");
const { isValidDateOnly } = require("./attendance");

const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);
const name = z.string().trim().min(2).max(160);
const className = z.string().trim().min(1).max(100);
const semester = z.coerce.number().int().min(1).max(12);
const dateOnly = z
  .string()
  .refine(isValidDateOnly, "Enter a valid date in YYYY-MM-DD format.");
const bloodGroup = z
  .union([
    z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
    z.literal("").transform(() => null),
  ])
  .optional()
  .nullable();
const id = z.coerce.number().int().positive();
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(20);

module.exports = {
  z,
  email,
  password,
  name,
  className,
  semester,
  dateOnly,
  bloodGroup,
  id,
  page,
  limit,
};
