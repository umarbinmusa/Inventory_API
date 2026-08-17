import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // price at time of sale
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    // sparse: true so a unique index doesn't choke on pre-existing Sale
    // documents (from before this field existed) that don't have one yet -
    // see the migration note in the project README/summary.
    receiptNumber: { type: String, required: true, unique: true, sparse: true, uppercase: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    items: {
      type: [saleItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "A sale needs at least one line item.",
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    change: { type: Number, default: 0, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["CASH", "CARD", "TRANSFER"],
      default: "CASH",
    },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Set when this sale was created by staff converting an online
    // booking/order into a completed sale, rather than a walk-in POS sale.
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Sale", saleSchema);
