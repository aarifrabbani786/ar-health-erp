const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3307,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

// Connection Test
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database Connection Failed:', err.message);
  } else {
    console.log('✅ Connected to MySQL Database successfully!');
    connection.release();
  }
});

module.exports = promisePool;