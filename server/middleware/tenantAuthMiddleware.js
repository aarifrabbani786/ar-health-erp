const jwt = require('jsonwebtoken');

const verifyTenant = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    req.tenant = verified; // Isme tenantId, organizationName, etc. mil jayega
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

module.exports = verifyTenant;