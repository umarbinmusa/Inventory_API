import mongoose from "mongoose";

// Tracks the reorder workflow (Pending -> Ordered -> Received) for a
// low-stock product. This is a lightweight status tracker only - actually
// crediting stock back in still goes through the existing stockIn mutation
// (models/StockMovement.js), so there's exactly one code path that ever
// changes product.quantity.
const reorderSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },

    // Snapshots taken when the reorder request was created, so the record
    // still makes sense even after stock moves around later.
    quantityAtRequest: { type: Number, required: true, min: 0 },
    reorderLevelAtRequest: { type: Number, required: true, min: 0 },
    suggestedQuantity: { type: Number, required: true, min: 1 },

    status: {
      type: String,
      enum: ["PENDING", "ORDERED", "RECEIVED"],
      default: "PENDING",
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

reorderSchema.index({ status: 1, createdAt: -1 });
reorderSchema.index({ product: 1 });

export default mongoose.model("Reorder", reorderSchema);
