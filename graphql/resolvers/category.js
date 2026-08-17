import { GraphQLError } from "graphql";
import Category from "../../models/Category.js";
import Product from "../../models/Product.js";
import { ROLES } from "../../config/roles.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const categoryResolvers = {
  Category: {
    id: (parent) => parent._id.toString(),
    productCount: async (parent) => Product.countDocuments({ category: parent._id }),
  },

  Query: {
    categories: async (_p, _a, context) => {
      requireAuth(context);
      return Category.find().sort({ name: 1 });
    },
    category: async (_p, { id }, context) => {
      requireAuth(context);
      return Category.findById(id);
    },
    shopCategories: async () => {
      return Category.find().sort({ name: 1 });
    },
  },

  Mutation: {
    createCategory: async (_p, { input }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER]);
      const existing = await Category.findOne({ name: input.name });
      if (existing) {
        throw new GraphQLError("A category with this name already exists.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return Category.create(input);
    },

    updateCategory: async (_p, { id, input }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER]);
      const category = await Category.findByIdAndUpdate(id, input, {
        new: true,
        runValidators: true,
      });
      if (!category) {
        throw new GraphQLError("Category not found.", { extensions: { code: "NOT_FOUND" } });
      }
      return category;
    },

    deleteCategory: async (_p, { id }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER]);
      const productCount = await Product.countDocuments({ category: id });
      if (productCount > 0) {
        throw new GraphQLError("Can't delete a category that still has products in it.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const result = await Category.findByIdAndDelete(id);
      if (!result) {
        throw new GraphQLError("Category not found.", { extensions: { code: "NOT_FOUND" } });
      }
      return { success: true, message: "Category deleted." };
    },
  },
};
