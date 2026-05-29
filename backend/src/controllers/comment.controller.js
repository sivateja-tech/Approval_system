const asyncHandler = require('../middleware/async.middleware');
const prisma = require('../config/db');
const { success } = require('../utils/response.util');

exports.addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) throw Object.assign(new Error('Comment content is required'), { statusCode: 400 });

  const comment = await prisma.comment.create({
    data: { fundRequestId: parseInt(req.params.id), userId: req.user.id, content },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  return success(res, comment, 'Comment added', 201);
});

exports.getComments = asyncHandler(async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { fundRequestId: parseInt(req.params.id), isDeleted: false },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return success(res, comments, 'Comments fetched');
});