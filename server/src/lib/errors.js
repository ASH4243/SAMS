"use strict";

class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
  }
}

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
const positiveId = (raw) => {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new AppError(400, "A valid ID is required.");
  return id;
};

function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  if (error && error.name === "ZodError") {
    return res.status(400).json({
      success: false,
      message: "Please check the submitted information.",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  if (error && error.code === "LIMIT_FILE_SIZE") {
    return res
      .status(413)
      .json({ success: false, message: "The photo must be 4 MB or smaller." });
  }
  if (error && error.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: "The upload is malformed or contains an unexpected file field.",
    });
  }
  if (error && error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "A record with one of these values already exists.",
    });
  }
  if (error && error.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "This record is still referenced by another record.",
    });
  }
  if (error && error.code === "22P02") {
    return res
      .status(400)
      .json({ success: false, message: "One or more values are invalid." });
  }
  const status = Number(error && error.status) || 500;
  if (status >= 500) console.error(error && error.stack ? error.stack : error);
  return res.status(status).json({
    success: false,
    message:
      status >= 500 ? "An unexpected server error occurred." : error.message,
    ...(status < 500 && error.details ? { errors: error.details } : {}),
  });
}

module.exports = { AppError, asyncHandler, positiveId, errorHandler };
