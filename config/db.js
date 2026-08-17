import mongoose from "mongoose";

/**
 * Connects to MongoDB using Mongoose.
 * Exits the process on failure so the server never runs against a broken DB connection.
 */
const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: process.env.NODE_ENV !== "production",
    });

    console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on("error", (err) => {
      console.error("[db] MongoDB connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("[db] MongoDB disconnected");
    });

    return conn;
  } catch (error) {
    console.error("[db] Failed to connect to MongoDB:", error.message);
    process.exit(1);
  }
};

export default connectDB;
