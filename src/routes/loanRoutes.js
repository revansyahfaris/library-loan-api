const express = require('express');

const controller = require('../controllers/loanController');
const { validateBody } = require('../middlewares/validate');
const {
  createLoanSchema,
  updateLoanSchema,
  returnLoanSchema,
} = require('../validators/loanValidator');

const router = express.Router();

router.get('/', controller.listLoans);
router.get('/:id', controller.getLoanById);
router.post('/', validateBody(createLoanSchema), controller.createLoan);
router.put('/:id', validateBody(updateLoanSchema), controller.updateLoan);
router.patch('/:id/return', validateBody(returnLoanSchema), controller.returnLoan);
router.delete('/:id', controller.deleteLoan);

module.exports = router;
