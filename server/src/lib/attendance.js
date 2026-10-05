"use strict";

function attendancePercentage(present, total) {
  const totalCount = Number(total) || 0;
  const presentCount = Number(present) || 0;
  if (totalCount <= 0) return 0;
  return Math.round((presentCount / totalCount) * 1000) / 10;
}

function isValidDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

module.exports = { attendancePercentage, isValidDateOnly };
