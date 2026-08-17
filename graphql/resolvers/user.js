import { GraphQLError } from "graphql";
import User from "../../models/User.js";
import { ROLES, ALL_ROLES } from "../../config/roles.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/generateTokens.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { sendEmail, passwordResetEmailTemplate } from "../../utils/sendEmail.js";

const issueAuthPayload = async (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await user.setRefreshToken(refreshToken);
  return { user: user.toSafeObject(), accessToken, refreshToken };
};

export const userResolvers = {
  Query: {
    currentUser: async (_parent, _args, context) => {
      if (!context.user) return null;
      return context.user.toSafeObject();
    },

    users: async (_parent, { role }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER]);
      const filter = role ? { role } : {};
      const users = await User.find(filter).sort({ createdAt: -1 });
      return users.map((u) => u.toSafeObject());
    },

    user: async (_parent, { id }, context) => {
      requireRole(context, [ROLES.ADMIN, ROLES.MANAGER]);
      const user = await User.findById(id);
      if (!user) return null;
      return user.toSafeObject();
    },
  },

  Mutation: {
    register: async (_parent, { input }, context) => {
      // Only an authenticated ADMIN can create MANAGER/ADMIN/STORE_KEEPER/CASHIER
      // accounts directly, EXCEPT when there are no users yet (initial bootstrap).
      const existingUserCount = await User.countDocuments();
      if (existingUserCount > 0) {
        requireRole(context, [ROLES.ADMIN]);
      }

      const { fullName, email, password, role, phone } = input;

      if (role && !ALL_ROLES.includes(role)) {
        throw new GraphQLError("Invalid role provided.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        throw new GraphQLError("An account with this email already exists.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const user = new User({
        fullName,
        email,
        password,
        phone,
        // First-ever user becomes ADMIN automatically; otherwise use requested role.
        role: existingUserCount === 0 ? ROLES.ADMIN : role || ROLES.CASHIER,
      });

      await user.save();
      return issueAuthPayload(user);
    },

    login: async (_parent, { input }, _context) => {
      const { email, password } = input;

      const user = await User.findOne({ email: email.toLowerCase() }).select(
        "+password"
      );

      if (!user || !(await user.comparePassword(password))) {
        throw new GraphQLError("Invalid email or password.", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      if (!user.isActive) {
        throw new GraphQLError("This account has been deactivated.", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      user.lastLoginAt = new Date();
      await user.save({ validateBeforeSave: false });

      return issueAuthPayload(user);
    },

    logout: async (_parent, _args, context) => {
      const user = requireAuth(context);
      await user.setRefreshToken(null);
      return { success: true, message: "Logged out successfully." };
    },

    refreshToken: async (_parent, { refreshToken }, _context) => {
      let decoded;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch (err) {
        throw new GraphQLError("Invalid or expired refresh token.", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const user = await User.findById(decoded.userId).select(
        "+refreshTokenHash"
      );

      if (!user || !user.compareRefreshToken(refreshToken)) {
        throw new GraphQLError("Refresh token is no longer valid.", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Rotate the refresh token on every use to limit replay-attack windows.
      return issueAuthPayload(user);
    },

    changePassword: async (_parent, { input }, context) => {
      const authUser = requireAuth(context);
      const user = await User.findById(authUser._id).select("+password");

      const valid = await user.comparePassword(input.currentPassword);
      if (!valid) {
        throw new GraphQLError("Current password is incorrect.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      user.password = input.newPassword;
      await user.save();
      await user.setRefreshToken(null); // force re-login on all devices

      return { success: true, message: "Password changed successfully. Please log in again." };
    },

    forgotPassword: async (_parent, { email }, _context) => {
      const user = await User.findOne({ email: email.toLowerCase() });

      // Always respond with success to avoid leaking which emails are registered.
      const genericResponse = {
        success: true,
        message: "If an account exists for that email, a reset link has been sent.",
      };

      if (!user) return genericResponse;

      const resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

      await sendEmail({
        to: user.email,
        subject: "Reset your Inventory System password",
        html: passwordResetEmailTemplate(resetUrl, user.fullName),
      });

      return genericResponse;
    },

    resetPassword: async (_parent, { token, newPassword }, _context) => {
      const crypto = await import("crypto");
      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const user = await User.findOne({
        passwordResetTokenHash: hashedToken,
        passwordResetExpires: { $gt: new Date() },
      }).select("+passwordResetTokenHash +passwordResetExpires");

      if (!user) {
        throw new GraphQLError("Reset token is invalid or has expired.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      user.password = newPassword;
      user.passwordResetTokenHash = null;
      user.passwordResetExpires = null;
      await user.save();
      await user.setRefreshToken(null);

      return { success: true, message: "Password has been reset. Please log in." };
    },

    updateProfile: async (_parent, { input }, context) => {
      const authUser = requireAuth(context);
      const user = await User.findById(authUser._id);

      if (input.fullName !== undefined) user.fullName = input.fullName;
      if (input.phone !== undefined) user.phone = input.phone;
      if (input.avatar !== undefined) user.avatar = input.avatar;

      await user.save();
      return user.toSafeObject();
    },

    updateUserStatus: async (_parent, { id, isActive, role }, context) => {
      requireRole(context, [ROLES.ADMIN]);

      const user = await User.findById(id);
      if (!user) {
        throw new GraphQLError("User not found.", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      if (isActive !== undefined) user.isActive = isActive;
      if (role !== undefined) user.role = role;

      await user.save();
      return user.toSafeObject();
    },

    deleteUser: async (_parent, { id }, context) => {
      const admin = requireRole(context, [ROLES.ADMIN]);

      if (admin._id.toString() === id) {
        throw new GraphQLError("You cannot delete your own account.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const result = await User.findByIdAndDelete(id);
      if (!result) {
        throw new GraphQLError("User not found.", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return { success: true, message: "User deleted successfully." };
    },
  },
};
