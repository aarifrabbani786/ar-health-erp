// Check if user is logged in
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({ success: false, message: 'Please log in to continue' });
};

// Check User Roles (Super Admin / Admin / Staff)
const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const userRole = req.session.user.role_name;

        if (allowedRoles.includes(userRole)) {
            return next();
        }

        return res.status(403).json({ 
            success: false, 
            message: 'Access Denied: Aapko is section ka access nahi hai' 
        });
    };
};

module.exports = { isAuthenticated, checkRole };