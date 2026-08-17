import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    type: {
      type: String,
      enum: ["PURCHASE", "SALE", "STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "TRANSFER"],
      required: true,
    },
    // Signed: positive increases stock, negative decreases it.
    quantity: { type: Number, required: true },
    reason: { type: String, trim: true, default: "" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

stockMovementSchema.index({ product: 1, createdAt: -1 });

export default mongoose.model("StockMovement", stockMovementSchema);
