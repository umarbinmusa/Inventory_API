import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { ALL_ROLES, ROLES } from "../config/roles.js";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      default: ROLES.CASHIER,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Store only a hash of the current valid refresh token so a stolen DB
    // dump can't be used to mint new access tokens.
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

// Hash password before saving whenever it's new or modified
userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.setRefreshToken = async function setRefreshToken(token) {
  this.refreshTokenHash = token
    ? crypto.createHash("sha256").update(token).digest("hex")
    : null;
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.compareRefreshToken = function compareRefreshToken(token) {
  if (!this.refreshTokenHash || !token) return false;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return hash === this.refreshTokenHash;
};

// Generates a plain reset token to email to the user, storing only its hash.
userSchema.methods.createPasswordResetToken = function createPasswordResetToken() {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetTokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const minutes = Number(process.env.RESET_TOKEN_EXPIRES_MIN || 30);
  this.passwordResetExpires = new Date(Date.now() + minutes * 60 * 1000);

  return resetToken;
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    fullName: this.fullName,
    email: this.email,
    role: this.role,
    phone: this.phone,
    avatar: this.avatar,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const User = mongoose.model("User", userSchema);
export default User;
