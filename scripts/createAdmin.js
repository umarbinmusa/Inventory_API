// Run once to create (or promote) an admin account, e.g.:
//   node scripts/createAdmin.js "Admin Name" admin@example.com "ChangeMe123!"
//
// Uses the project's own User model, so password hashing happens exactly
// the way it normally would on register/login (see models/User.js's
// pre-save hook) - this script never touches the hash itself.

import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import { ROLES } from "../config/roles.js";

const [, , fullName, email, password] = process.argv;

if (!fullName || !email || !password) {
  console.error('Usage: node scripts/createAdmin.js "Full Name" email@example.com "Password123!"');
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    existing.role = ROLES.ADMIN;
    existing.isActive = true;
    await existing.save({ validateBeforeSave: false });
    console.log(`Existing user ${email} promoted to ADMIN.`);
  } else {
    const user = new User({
      fullName,
      email,
      password,
      role: ROLES.ADMIN,
    });
    await user.save();
    console.log(`Admin user created: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
