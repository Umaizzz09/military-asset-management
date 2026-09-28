const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "military_asset_db",
  password: "5432",
  port: 5432,
});

module.exports = pool;