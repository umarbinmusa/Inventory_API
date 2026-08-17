import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    // sparse: true so the many guest/admin-created customer records with no
    // email (or a blank one) don't collide on the unique index - only
    // self-registered customers are required to have a real, unique email.
    email: { type: String, trim: true, lowercase: true, default: "", unique: true, sparse: true },
    address: { type: String, trim: true, default: "" },

    // Only present for customers who self-registered via the storefront.
    // Customers created by staff (walk-ins, converted from an order, etc.)
    // have no password and simply can't log in - that's fine, they're not
    // meant to.
    password: { type: String, minlength: 8, select: false, default: null },
    isActive: { type: Boolean, default: true },
    refreshTokenHash: { type: String, select: false, default: null },
  },
  { timestamps: true }
);

customerSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

customerSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

customerSchema.methods.setRefreshToken = async function setRefreshToken(token) {
  this.refreshTokenHash = token
    ? crypto.createHash("sha256").update(token).digest("hex")
    : null;
  await this.save({ validateBeforeSave: false });
};

customerSchema.methods.compareRefreshToken = function compareRefreshToken(token) {
  if (!this.refreshTokenHash || !token) return false;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return hash === this.refreshTokenHash;
};

export default mongoose.model("Customer", customerSchema);
