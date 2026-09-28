require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./db");

async function createAdmin() {
  try {
    const password = "Admin@123";

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users
       (name, email, password_hash, role_id)
       VALUES ($1, $2, $3, 
         (SELECT id FROM roles WHERE name = 'Admin')
       )
       RETURNING id, name, email`,
      [
        "System Admin",
        "admin@militaryasset.com",
        passwordHash,
      ]
    );

    console.log("Admin created successfully:");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("Error creating admin:", error);
  } finally {
    await pool.end();
  }
}

createAdmin();