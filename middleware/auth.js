import { GraphQLError } from "graphql";
import { verifyAccessToken } from "../utils/generateTokens.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";

/**
 * Builds the per-request context for Apollo Server.
 * Reads the access token from the Authorization header (Bearer <token>),
 * verifies it, and attaches either the current staff user OR the current
 * customer (never both - see generateCustomerAccessToken) to the context.
 * Invalid/expired tokens do NOT throw here — they simply leave `user`/
 * `customer` null, so public operations (e.g. login, register, the shop
 * queries) still work. Protected resolvers enforce auth themselves via
 * requireAuth/requireRole/requireCustomerAuth below.
 */
export const buildContext = async ({ req }) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return { user: null, customer: null, token: null };

  try {
    const decoded = verifyAccessToken(token);

    if (decoded.customerId) {
      const customer = await Customer.findById(decoded.customerId);
      if (!customer || !customer.isActive) return { user: null, customer: null, token: null };
      return { user: null, customer, token };
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) return { user: null, customer: null, token: null };
    return { user, customer: null, token };
  } catch (err) {
    return { user: null, customer: null, token: null };
  }
};

/** Throws unless the request is authenticated. Returns the user for convenience. */
export const requireAuth = (context) => {
  if (!context.user) {
    throw new GraphQLError("You must be logged in to perform this action.", {
      extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
    });
  }
  return context.user;
};

/**
 * Throws unless the authenticated user's role is in `allowedRoles`.
 * Usage: requireRole(context, [ROLES.ADMIN, ROLES.MANAGER])
 */
export const requireRole = (context, allowedRoles = []) => {
  const user = requireAuth(context);
  if (!allowedRoles.includes(user.role)) {
    throw new GraphQLError(
      `Role '${user.role}' is not permitted to perform this action.`,
      { extensions: { code: "FORBIDDEN", http: { status: 403 } } }
    );
  }
  return user;
};

/** Throws unless the request is authenticated as a customer (storefront account). */
export const requireCustomerAuth = (context) => {
  if (!context.customer) {
    throw new GraphQLError("You must be logged in to perform this action.", {
      extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
    });
  }
  return context.customer;
};
