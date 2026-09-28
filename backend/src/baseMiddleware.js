function authorizeBase(req, res, next) {
  // Admin can access all bases
  if (req.user.role === "Admin") {
    return next();
  }

  // Base Commander must have an assigned base
  if (req.user.role === "Base Commander" && !req.user.baseId) {
    return res.status(403).json({
      message: "No base assigned to this user.",
    });
  }

  // Get base ID from request
  const requestedBaseId =
    req.params.baseId ||
    req.body.baseId ||
    req.query.baseId;

  // If no base was specified, let the route handle it
  if (!requestedBaseId) {
    return next();
  }

  if (Number(requestedBaseId) !== Number(req.user.baseId)) {
    return res.status(403).json({
      message: "You do not have access to this base.",
    });
  }

  next();
}

module.exports = authorizeBase;