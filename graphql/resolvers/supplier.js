import { GraphQLError } from "graphql";
import Supplier from "../../models/Supplier.js";
import Product from "../../models/Product.js";
import { ROLES } from "../../config/roles.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const supplierResolvers = {
  Supplier: {
    id: (parent) => parent._id.toString(),
    productCount: async (parent) => Product.countDocuments({ supplier: parent._id }),
  },

  Query: {
    suppliers: async (_p, _a, context) => {
      requireAuth(context);
      return Supplier.find().sort({ companyName: 1 });
    },
    supplier: async (_p, { id }, context) => {
      requireAuth(context);
      return Supplier.findById(id);
    },
  },

  Mutation: {
    createSupplier: async (_p, { input }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER]);
      return Supplier.create(input);
    },

    updateSupplier: async (_p, { id, input }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER]);
      const supplier = await Supplier.findByIdAndUpdate(id, input, {
        new: true,
        runValidators: true,
      });
      if (!supplier) {
        throw new GraphQLError("Supplier not found.", { extensions: { code: "NOT_FOUND" } });
      }
      return supplier;
    },

    deleteSupplier: async (_p, { id }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER]);
      const productCount = await Product.countDocuments({ supplier: id });
      if (productCount > 0) {
        throw new GraphQLError("Can't delete a supplier linked to existing products.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const result = await Supplier.findByIdAndDelete(id);
      if (!result) {
        throw new GraphQLError("Supplier not found.", { extensions: { code: "NOT_FOUND" } });
      }
      return { success: true, message: "Supplier deleted." };
    },
  },
};
