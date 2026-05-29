const router = require('express').Router();
const prisma = require('../config/db');
const { success } = require('../utils/response.util');
const asyncHandler = require('../middleware/async.middleware');

router.get('/', asyncHandler(async (req, res) => {
  const departments = await prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  });
  return success(res, departments);
}));

module.exports = router;