const mysql = require('mysql2');
require('dotenv').config();

const connectionConfig = process.env.DATABASE_URL ? {
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
} : {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ar_healthcare',
    port: process.env.DB_PORT || 3307,
    ssl: { rejectUnauthorized: false },
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