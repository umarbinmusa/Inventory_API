import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true, unique: true, uppercase: true },
    barcode: { type: String, trim: true, default: "" },
    productName: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    minimumStock: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, trim: true, default: "piece" },
    // Stores a URL (from the /api/upload endpoint) rather than binary data.
    image: { type: String, default: null },
    description: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "DISCONTINUED"],
      default: "ACTIVE",
    },
    // Optional - powers the "Expiring Products" notification. Not every
    // product (e.g. electronics) needs one, so it's nullable.
    expiryDate: { type: Date, default: null },
  },
  { timestamps: true }
);

productSchema.index({ productName: "text", sku: "text", barcode: "text" });
productSchema.index({ category: 1 });

productSchema.virtual("stockStatus").get(function stockStatus() {
  if (this.quantity === 0) return "OUT_OF_STOCK";
  if (this.quantity <= this.minimumStock) return "LOW_STOCK";
  return "IN_STOCK";
});
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

export default mongoose.model("Product", productSchema);
