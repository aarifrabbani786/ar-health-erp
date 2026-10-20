const jwt = require('jsonwebtoken');

const verifySuperAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided!' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    req.admin = verified; // Save admin info in request
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired token!' });
  }
};

module.exports = verifySuperAdmin;