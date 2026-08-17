import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // sellingPrice snapshot at order time
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, uppercase: true },

    // Simple contact info captured directly on the order - customers don't
    // need an account to book a product, matching the "keep it simple"
    // requirement. Optionally links to an existing Customer record if one
    // is matched/created by staff later.
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true, lowercase: true, default: "" },
    customerAddress: { type: String, trim: true, default: "" },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },

    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "An order needs at least one line item.",
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "PROCESSING", "READY", "COMPLETED", "CANCELLED"],
      default: "PENDING",
    },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PAID"],
      default: "UNPAID",
    },
    notes: { type: String, trim: true, default: "" },

    // Set once staff converts this booking into an actual completed Sale.
    // Stock is deducted exactly once, at that point - never when the order
    // is merely placed, confirmed, or marked ready.
    convertedSale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null },

    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ customerPhone: 1 });

export default mongoose.model("Order", orderSchema);
