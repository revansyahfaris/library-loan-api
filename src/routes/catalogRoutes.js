const express = require('express');

const controller = require('../controllers/catalogController');
const { validateBody } = require('../middlewares/validate');
const {
  createMemberSchema,
  createBookSchema,
} = require('../validators/loanValidator');

const router = express.Router();

router.get('/members', controller.listMembers);
router.post('/members', validateBody(createMemberSchema), controller.createMember);

router.get('/books', controller.listBooks);
router.post('/books', validateBody(createBookSchema), controller.createBook);

module.exports = router;
