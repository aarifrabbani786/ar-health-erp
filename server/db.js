const mysql = require('mysql2');
require('dotenv').config();

// Agar DATABASE_URL diya hai toh usse connect karega, warna individual variables se
const connectionConfig = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL 
  : {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3307,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };

const pool = mysql.createPool(connectionConfig);

const promisePool = pool.promise();

// Connection Test
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database Connection Failed:', err.message);
  } else {
    console.log('✅ Connected to Database successfully!');
    connection.release();
  }
});

module.exports = promisePool;