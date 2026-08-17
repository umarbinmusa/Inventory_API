import jwt from "jsonwebtoken";

/**
 * Issues a short-lived access token carrying identity + role for authorization checks.
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
  );
};

/**
 * Issues a long-lived refresh token. Its hash is persisted on the user document
 * so it can be revoked (logout) and validated on refresh.
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id.toString(), tokenVersion: Date.now() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );
};

export const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);

/**
 * Customer-facing tokens use a distinct `customerId` claim (rather than
 * `userId`) so buildContext can tell the two apart and a customer token can
 * never accidentally resolve to a staff User (or vice versa) even though
 * both share the same JWT secrets.
 */
export const generateCustomerAccessToken = (customer) => {
  return jwt.sign(
    { customerId: customer._id.toString(), role: "CUSTOMER" },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
  );
};

export const generateCustomerRefreshToken = (customer) => {
  return jwt.sign(
    { customerId: customer._id.toString(), tokenVersion: Date.now() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );
};
