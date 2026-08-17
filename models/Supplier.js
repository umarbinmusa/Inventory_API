import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Supplier", supplierSchema);
