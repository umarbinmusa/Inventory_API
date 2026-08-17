import { GraphQLError } from "graphql";
import Customer from "../../models/Customer.js";
import Sale from "../../models/Sale.js";
import Order from "../../models/Order.js";
import { ROLES } from "../../config/roles.js";
import { requireAuth, requireRole, requireCustomerAuth } from "../../middleware/auth.js";
import {
  generateCustomerAccessToken,
  generateCustomerRefreshToken,
  verifyRefreshToken,
} from "../../utils/generateTokens.js";

const ORDER_POPULATE = [
  { path: "items.product" },
  { path: "customer" },
  { path: "convertedSale" },
  { path: "processedBy" },
];

const issueCustomerAuthPayload = async (customer) => {
  const accessToken = generateCustomerAccessToken(customer);
  const refreshToken = generateCustomerRefreshToken(customer);
  await customer.setRefreshToken(refreshToken);
  return { customer, accessToken, refreshToken };
};

export const customerResolvers = {
  Customer: {
    id: (parent) => parent._id.toString(),
    // Explicitly awaited so this resolver returns a plain number rather
    // than a live Mongoose Query object - a Query can only be executed
    // once, and re-touching it anywhere downstream throws "Query was
    // already executed". A resolved value has no such restriction.
    orderCount: async (parent) => Sale.countDocuments({ customer: parent._id }),
    hasAccount: (parent) => !!parent.password,
  },

  Query: {
    customers: async (_p, _a, context) => {
      requireAuth(context);
      return Customer.find().sort({ fullName: 1 });
    },
    customer: async (_p, { id }, context) => {
      requireAuth(context);
      return Customer.findById(id);
    },

    currentCustomer: (_p, _a, context) => context.customer || null,

    myOrders: async (_p, _a, context) => {
      const customer = requireCustomerAuth(context);
      return Order.find({ customer: customer._id }).populate(ORDER_POPULATE).sort({ createdAt: -1 });
    },
  },

  Mutation: {
    createCustomer: async (_p, { input }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]);
      return Customer.create(input);
    },

    updateCustomer: async (_p, { id, input }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]);
      const customer = await Customer.findByIdAndUpdate(id, input, {
        new: true,
        runValidators: true,
      });
      if (!customer) {
        throw new GraphQLError("Customer not found.", { extensions: { code: "NOT_FOUND" } });
      }
      return customer;
    },

    deleteCustomer: async (_p, { id }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER]);
      const orderCount = await Sale.countDocuments({ customer: id });
      if (orderCount > 0) {
        throw new GraphQLError("Can't delete a customer with existing sales history.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const result = await Customer.findByIdAndDelete(id);
      if (!result) {
        throw new GraphQLError("Customer not found.", { extensions: { code: "NOT_FOUND" } });
      }
      return { success: true, message: "Customer deleted." };
    },

    // --- Storefront self-service account, public/unauthenticated ---

    registerCustomer: async (_p, { input }) => {
      const { fullName, email, password, phone, address } = input;

      const normalizedEmail = email.trim().toLowerCase();
      const existing = await Customer.findOne({ email: normalizedEmail });
      if (existing) {
        if (existing.password) {
          throw new GraphQLError("An account with this email already exists. Try logging in instead.", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        // A Customer record already exists (e.g. from a past guest order or
        // staff-entered walk-in) but has never been used to register - turn
        // it into a real account rather than erroring or creating a duplicate.
        existing.fullName = fullName;
        existing.password = password;
        if (phone) existing.phone = phone;
        if (address) existing.address = address;
        await existing.save();
        return issueCustomerAuthPayload(existing);
      }

      const customer = new Customer({
        fullName,
        email: normalizedEmail,
        password,
        phone: phone || "",
        address: address || "",
      });
      await customer.save();
      return issueCustomerAuthPayload(customer);
    },

    loginCustomer: async (_p, { input }) => {
      const { email, password } = input;
      const customer = await Customer.findOne({ email: email.trim().toLowerCase() }).select("+password");

      if (!customer || !customer.password || !(await customer.comparePassword(password))) {
        throw new GraphQLError("Invalid email or password.", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      if (!customer.isActive) {
        throw new GraphQLError("This account has been deactivated.", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      return issueCustomerAuthPayload(customer);
    },

    customerRefreshToken: async (_p, { refreshToken }) => {
      let decoded;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch {
        throw new GraphQLError("Invalid or expired refresh token.", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const customer = await Customer.findById(decoded.customerId).select("+refreshTokenHash");
      if (!customer || !customer.compareRefreshToken(refreshToken)) {
        throw new GraphQLError("Refresh token is no longer valid.", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      return issueCustomerAuthPayload(customer);
    },

    customerLogout: async (_p, _a, context) => {
      const customer = requireCustomerAuth(context);
      await customer.setRefreshToken(null);
      return { success: true, message: "Logged out successfully." };
    },
  },
};
