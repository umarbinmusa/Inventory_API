import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "LOW_STOCK",
        "OUT_OF_STOCK",
        "EXPIRING_PRODUCT",
        "NEW_ORDER",
        "NEW_BOOKING",
        "BOOKING_CANCELLED",
      ],
      required: true,
    },
    message: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ read: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
